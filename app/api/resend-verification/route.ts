import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createVerificationToken,
  invalidateUnusedTokens,
  latestTokenCreatedAt,
} from "@/lib/token";
import { sendVerificationEmail } from "@/lib/email";

const RATE_LIMIT_SECONDS = 60;

function buildVerificationUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
    "https://agentis.dev";
  return `${base}/api/verify-email?token=${token}`;
}

export async function POST(req: NextRequest) {
  let body: { developerId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { developerId } = body;
  if (!developerId || typeof developerId !== "string") {
    return NextResponse.json(
      { error: "developerId is required" },
      { status: 400 }
    );
  }

  const developer = await prisma.developer.findUnique({
    where: { id: developerId },
  });

  if (!developer) {
    // Return the same shape as a success to avoid developer-ID enumeration
    return NextResponse.json({
      message:
        "If that account exists and is unverified, a new verification email has been sent.",
    });
  }

  if (developer.status !== "pending") {
    return NextResponse.json(
      { error: "This account is already verified." },
      { status: 400 }
    );
  }

  // Rate limit: reject if a token was created within the last 60 seconds
  const lastCreated = await latestTokenCreatedAt(developerId);
  if (lastCreated) {
    const secondsElapsed = (Date.now() - lastCreated.getTime()) / 1000;
    if (secondsElapsed < RATE_LIMIT_SECONDS) {
      const retryAfter = Math.ceil(RATE_LIMIT_SECONDS - secondsElapsed);
      return NextResponse.json(
        {
          error: `Please wait ${retryAfter} second${retryAfter !== 1 ? "s" : ""} before requesting another verification email.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        }
      );
    }
  }

  // Invalidate existing unused tokens, issue a fresh one
  await invalidateUnusedTokens(developerId);
  const token = await createVerificationToken(developerId);
  const verificationUrl = buildVerificationUrl(token);

  await sendVerificationEmail({ to: developer.email, verificationUrl });

  return NextResponse.json({
    message:
      "A new verification email has been sent. Check your inbox (and spam folder).",
  });
}
