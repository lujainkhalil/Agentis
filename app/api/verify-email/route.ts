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
    include: { developer: true },
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
          "This verification link has already been used. If you need a new one, request a resend.",
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

  // Determine the final tier:
  // - Company flow that hit tier 3 stays at 3
  // - Everything else resolves to tier 1 (email-only baseline)
  //   Individual (tier 2) stays tier 2 — email verification unlocks the API
  //   key but full individual verification is still manual review
  const developer = record.developer;
  const finalTier = developer.verificationTier; // already set correctly at registration

  // Mark token as used and upgrade developer status in one transaction
  await prisma.$transaction([
    prisma.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.developer.update({
      where: { id: developer.id },
      data: {
        status: "verified",
        // Tier 1 is set for email-only registrations (verificationTier was
        // left at 1 from the default). For individual/company flows the tier
        // was already set higher at registration — we don't downgrade it here.
      },
    }),
  ]);

  await writeAuditLog({
    action: "EMAIL_VERIFIED",
    metadata: {
      developerId: developer.id,
      email: developer.email,
      verificationTier: finalTier,
    },
  });

  return NextResponse.json({
    apiKey: developer.apiKey,
    message: "Email verified. Your API key is active.",
    verificationTier: finalTier,
  });
}
