import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token || typeof token !== "string") {
    return NextResponse.json(
      { error: "token query parameter is required" },
      { status: 400 }
    );
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token },
    include: {
      developer: {
        include: {
          domainVerifications: {
            where: { verified: true },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!record) {
    return NextResponse.json(
      { error: "Invalid verification token." },
      { status: 400 }
    );
  }

  if (record.usedAt !== null) {
    return NextResponse.json(
      {
        error:
          "This verification link has already been used. If you need a new one, request a resend via POST /api/resend-verification.",
      },
      { status: 400 }
    );
  }

  if (record.expiresAt < new Date()) {
    return NextResponse.json(
      {
        error:
          "This verification link has expired (links are valid for 24 hours). Request a new one via POST /api/resend-verification.",
      },
      { status: 400 }
    );
  }

  const developer = record.developer;
  const isCompanyFlow = developer.verificationMethod === "company";
  const domainAlreadyVerified = developer.domainVerifications.length > 0;

  // Mark token used + record emailVerifiedAt in one transaction
  await prisma.$transaction([
    prisma.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.developer.update({
      where: { id: developer.id },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);

  await writeAuditLog({
    action: "EMAIL_VERIFIED",
    metadata: {
      developerId: developer.id,
      email: developer.email,
      verificationMethod: developer.verificationMethod,
      domainAlreadyVerified,
    },
  });

  // ── Company flow: both gates required ──────────────────────────────────────
  if (isCompanyFlow) {
    if (!domainAlreadyVerified) {
      // Email done, domain still outstanding — don't return API key yet
      return NextResponse.json({
        message:
          "Email verified. Your domain verification is still pending. " +
          "Once your DNS TXT record propagates, call POST /api/verify-domain to complete setup and receive your API key.",
        emailVerified: true,
        domainVerified: false,
      });
    }

    // Both gates done — promote to tier 3 and hand over the key
    await prisma.developer.update({
      where: { id: developer.id },
      data: { status: "verified", verificationTier: 3 },
    });

    await writeAuditLog({
      action: "DEVELOPER_FULLY_VERIFIED",
      metadata: {
        developerId: developer.id,
        email: developer.email,
        verificationTier: 3,
        trigger: "email_verified_after_domain",
      },
    });

    return NextResponse.json({
      apiKey: developer.apiKey,
      message: "Email and domain both verified. Your API key is active.",
      verificationTier: 3,
    });
  }

  // ── Individual / email-only flow ──────────────────────────────────────────
  await prisma.developer.update({
    where: { id: developer.id },
    data: { status: "verified" },
  });

  return NextResponse.json({
    apiKey: developer.apiKey,
    message: "Email verified. Your API key is active.",
    verificationTier: developer.verificationTier,
  });
}
