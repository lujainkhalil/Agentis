import dns from "dns/promises";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

// dns/promises is a Node.js built-in — must not run in Edge runtime
export const runtime = "nodejs";

const DNS_RECORD_PREFIX = "agentis-verify=";
const LOOKUP_HOST_PREFIX = "_agentis-verify.";

async function lookupTxtRecord(domain: string): Promise<string[]> {
  const host = `${LOOKUP_HOST_PREFIX}${domain}`;
  try {
    // resolveTxt returns string[][] — each inner array is a multi-string chunk
    // of a single TXT record. Join chunks and flatten to a list of full values.
    const records = await dns.resolveTxt(host);
    return records.map((chunks) => chunks.join(""));
  } catch {
    // ENODATA / ENOTFOUND both mean no record present yet
    return [];
  }
}

export async function POST(req: NextRequest) {
  let body: { developerId?: string; domain?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { developerId, domain } = body;

  if (!developerId || typeof developerId !== "string") {
    return NextResponse.json(
      { error: "developerId is required" },
      { status: 400 }
    );
  }
  if (!domain || typeof domain !== "string") {
    return NextResponse.json(
      { error: "domain is required" },
      { status: 400 }
    );
  }

  const normalisedDomain = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");

  // Load the developer and their active domain verification record together
  const developer = await prisma.developer.findUnique({
    where: { id: developerId },
    include: {
      domainVerifications: {
        where: { domain: normalisedDomain, verified: false },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!developer) {
    return NextResponse.json(
      { error: "Developer not found" },
      { status: 404 }
    );
  }

  if (developer.verificationMethod !== "company") {
    return NextResponse.json(
      { error: "Domain verification is only available for company registrations" },
      { status: 400 }
    );
  }

  if (developer.status === "verified" && developer.verificationTier === 3) {
    return NextResponse.json(
      { error: "This account is already fully verified" },
      { status: 400 }
    );
  }

  const domainRecord = developer.domainVerifications[0];

  if (!domainRecord) {
    return NextResponse.json(
      {
        error:
          "No pending domain verification found for that domain. " +
          "Register first via POST /api/register to receive DNS instructions.",
      },
      { status: 404 }
    );
  }

  if (domainRecord.expiresAt < new Date()) {
    return NextResponse.json(
      {
        error:
          "The domain verification token has expired (tokens are valid for 7 days). " +
          "Please contact support to issue a new token.",
        expired: true,
      },
      { status: 400 }
    );
  }

  // ── DNS lookup ─────────────────────────────────────────────────────────────
  const expectedValue = `${DNS_RECORD_PREFIX}${domainRecord.token}`;
  const txtValues = await lookupTxtRecord(normalisedDomain);

  const found = txtValues.some((v) => v.trim() === expectedValue);

  if (!found) {
    return NextResponse.json(
      {
        verified: false,
        domain: normalisedDomain,
        lookingFor: {
          host: `${LOOKUP_HOST_PREFIX}${normalisedDomain}`,
          value: expectedValue,
        },
        message:
          "TXT record not found yet. DNS propagation can take up to 48 hours. " +
          "Try again once the record has propagated.",
      },
      { status: 202 } // 202 Accepted: request understood, verification pending
    );
  }

  // ── Record found — mark domain verified ────────────────────────────────────
  await prisma.domainVerification.update({
    where: { id: domainRecord.id },
    data: { verified: true, verifiedAt: new Date() },
  });

  await writeAuditLog({
    action: "DOMAIN_VERIFIED",
    metadata: {
      developerId: developer.id,
      domain: normalisedDomain,
    },
  });

  // Check if email is also verified — emailVerifiedAt is non-null if so
  const emailVerified = developer.emailVerifiedAt !== null;

  if (!emailVerified) {
    // Domain done, email still outstanding
    return NextResponse.json({
      verified: true,
      domain: normalisedDomain,
      domainVerified: true,
      emailVerified: false,
      message:
        "Domain verified. Your email verification is still pending. " +
        "Click the link in the verification email sent at registration to complete setup and receive your API key. " +
        "Need a new email? Call POST /api/resend-verification.",
    });
  }

  // ── Both gates done — promote to Tier 3 and hand over the API key ──────────
  await prisma.developer.update({
    where: { id: developer.id },
    data: { status: "verified", verificationTier: 3 },
  });

  await writeAuditLog({
    action: "DEVELOPER_FULLY_VERIFIED",
    metadata: {
      developerId: developer.id,
      email: developer.email,
      domain: normalisedDomain,
      verificationTier: 3,
      trigger: "domain_verified_after_email",
    },
  });

  return NextResponse.json({
    verified: true,
    domain: normalisedDomain,
    apiKey: developer.apiKey,
    message: "Domain and email both verified. Your API key is active.",
    verificationTier: 3,
  });
}
