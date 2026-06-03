import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { generateApiKey } from "@/lib/apiKey";
import { createVerificationToken } from "@/lib/token";
import { sendVerificationEmail, sendOperatorNotification } from "@/lib/email";

const CH_BASE = "https://api.company-information.service.gov.uk";
const TIMEOUT_MS = 8000;
const DOMAIN_TOKEN_TTL_DAYS = 7;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function verifyCompanyInternal(
  companyNumber: string
): Promise<{ name: string; status: string; jurisdiction: string | null } | null> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(
      `${CH_BASE}/company/${encodeURIComponent(companyNumber)}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      name: data.company_name,
      status: data.company_status,
      jurisdiction: data.jurisdiction ?? null,
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function normaliseDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "") // strip accidental protocol
    .replace(/\/.*$/, "")        // strip path
    .replace(/^www\./, "");      // strip www
}

function buildEmailVerificationUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
    "https://agentis.dev";
  return `${base}/api/verify-email?token=${token}`;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    email?: string;
    fullName?: string;
    companyName?: string;
    companyNumber?: string;
    domain?: string;
    jurisdiction?: string;
    website?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    email,
    fullName,
    companyName,
    companyNumber,
    domain,
    jurisdiction,
    website,
  } = body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json(
      { error: "A valid email is required" },
      { status: 400 }
    );
  }

  const existing = await prisma.developer.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Email already registered" },
      { status: 409 }
    );
  }

  const apiKey = generateApiKey();

  // ── Company flow ─────────────────────────────────────────────────────────────
  if (companyNumber) {
    if (!companyName) {
      return NextResponse.json(
        { error: "companyName is required for the company flow" },
        { status: 400 }
      );
    }
    if (!domain || typeof domain !== "string") {
      return NextResponse.json(
        { error: "domain is required for the company flow (e.g. \"tesco.com\")" },
        { status: 400 }
      );
    }

    const normalisedCompanyNumber = companyNumber.trim().toUpperCase();
    const normalisedDomain = normaliseDomain(domain);

    if (!normalisedDomain.includes(".")) {
      return NextResponse.json(
        { error: "domain must be a valid domain name (e.g. \"tesco.com\")" },
        { status: 400 }
      );
    }

    const chResult = await verifyCompanyInternal(normalisedCompanyNumber);

    let verifiedName: string | null = null;
    let resolvedJurisdiction: string | null = jurisdiction ?? null;

    if (chResult && chResult.status === "active") {
      verifiedName = chResult.name;
      resolvedJurisdiction = chResult.jurisdiction ?? jurisdiction ?? null;
    }
    // If CH is unreachable (null) we still allow registration — status stays
    // pending and the operator will see it. Domain verification happens async.

    const developer = await prisma.developer.create({
      data: {
        email,
        companyName,
        companyNumber: normalisedCompanyNumber,
        domain: normalisedDomain,
        jurisdiction: resolvedJurisdiction,
        website: website ?? null,
        status: "pending",
        apiKey,
        verificationTier: 2,       // promoted to 3 only when BOTH verifications pass
        verificationMethod: "company",
        verifiedName,
      },
    });

    // ── Domain verification record ──────────────────────────────────────────
    const dnsToken = randomBytes(16).toString("hex");
    const expiresAt = new Date(
      Date.now() + DOMAIN_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
    );
    await prisma.domainVerification.create({
      data: {
        developerId: developer.id,
        domain: normalisedDomain,
        token: dnsToken,
        expiresAt,
      },
    });

    // ── Email verification (sent silently — failure doesn't break registration)
    const emailToken = await createVerificationToken(developer.id);
    const emailVerificationUrl = buildEmailVerificationUrl(emailToken);

    await Promise.allSettled([
      sendVerificationEmail({ to: email, verificationUrl: emailVerificationUrl }),
      sendOperatorNotification({
        email,
        companyName,
        companyNumber: normalisedCompanyNumber,
        verificationMethod: "company",
        verificationTier: 2,
        developerId: developer.id,
        registeredAt: developer.createdAt.toISOString(),
      }),
    ]);

    await writeAuditLog({
      action: "DEVELOPER_REGISTERED",
      metadata: {
        developerId: developer.id,
        email,
        flow: "company",
        companyNumber: normalisedCompanyNumber,
        domain: normalisedDomain,
        chConfirmed: chResult?.status === "active",
      },
    });

    return NextResponse.json(
      {
        developerId: developer.id,
        status: "domain_verification_pending",
        domain: normalisedDomain,
        txtRecord: {
          host: `_agentis-verify.${normalisedDomain}`,
          value: `agentis-verify=${dnsToken}`,
          instructions:
            "Add this TXT record to your domain DNS. Propagation can take up to 48 hours. " +
            "Call POST /api/verify-domain once the record is live. " +
            "A verification email has also been sent — both must be completed to activate your API key.",
        },
      },
      { status: 201 }
    );
  }

  // ── Individual flow ───────────────────────────────────────────────────────────
  if (!fullName || typeof fullName !== "string") {
    return NextResponse.json(
      {
        error:
          "fullName is required for individual registration (no companyNumber provided)",
      },
      { status: 400 }
    );
  }

  const developer = await prisma.developer.create({
    data: {
      email,
      fullName,
      status: "pending",
      apiKey,
      verificationTier: 2,
      verificationMethod: "individual",
      verifiedName: fullName,
    },
  });

  const emailToken = await createVerificationToken(developer.id);
  const emailVerificationUrl = buildEmailVerificationUrl(emailToken);

  await Promise.allSettled([
    sendVerificationEmail({ to: email, verificationUrl: emailVerificationUrl }),
    sendOperatorNotification({
      email,
      fullName,
      verificationMethod: "individual",
      verificationTier: 2,
      developerId: developer.id,
      registeredAt: developer.createdAt.toISOString(),
    }),
  ]);

  await writeAuditLog({
    action: "DEVELOPER_REGISTERED",
    metadata: {
      developerId: developer.id,
      email,
      flow: "individual",
      verificationTier: 2,
    },
  });

  return NextResponse.json(
    {
      message:
        "Check your email to verify your address before your API key is activated.",
      developerId: developer.id,
    },
    { status: 201 }
  );
}
