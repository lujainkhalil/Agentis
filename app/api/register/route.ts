import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { generateApiKey } from "@/lib/apiKey";
import { createVerificationToken } from "@/lib/token";
import { sendVerificationEmail, sendOperatorNotification } from "@/lib/email";

const CH_BASE = "https://api.company-information.service.gov.uk";
const TIMEOUT_MS = 8000;

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

function emailDomainMatches(email: string, companyName: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const words = companyName
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .split(" ")
    .filter((w) => w.length > 3);
  return words.some((w) => domain.includes(w));
}

function buildVerificationUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
    "https://agentis.dev";
  return `${base}/api/verify-email?token=${token}`;
}

export async function POST(req: NextRequest) {
  let body: {
    email?: string;
    fullName?: string;
    companyName?: string;
    companyNumber?: string;
    jurisdiction?: string;
    website?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, fullName, companyName, companyNumber, jurisdiction, website } =
    body;

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

    const normalised = companyNumber.trim().toUpperCase();
    const chResult = await verifyCompanyInternal(normalised);

    let verifiedName: string | null = null;
    let resolvedJurisdiction: string | null = jurisdiction ?? null;
    let verificationTier = 2;

    if (chResult && chResult.status === "active") {
      verifiedName = chResult.name;
      resolvedJurisdiction = chResult.jurisdiction ?? jurisdiction ?? null;
      if (emailDomainMatches(email, chResult.name)) {
        verificationTier = 3;
      }
    }

    // Always start as "pending" until email is verified
    const developer = await prisma.developer.create({
      data: {
        email,
        companyName,
        companyNumber: normalised,
        jurisdiction: resolvedJurisdiction,
        website: website ?? null,
        status: "pending",
        apiKey,
        verificationTier,
        verificationMethod: "company",
        verifiedName,
      },
    });

    const token = await createVerificationToken(developer.id);
    const verificationUrl = buildVerificationUrl(token);

    // Fire both emails concurrently; don't fail registration if email bounces
    await Promise.allSettled([
      sendVerificationEmail({ to: email, verificationUrl }),
      sendOperatorNotification({
        email,
        companyName,
        companyNumber: normalised,
        verificationMethod: "company",
        verificationTier,
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
        companyNumber: normalised,
        verificationTier,
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

  const token = await createVerificationToken(developer.id);
  const verificationUrl = buildVerificationUrl(token);

  await Promise.allSettled([
    sendVerificationEmail({ to: email, verificationUrl }),
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
