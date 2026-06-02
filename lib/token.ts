import { randomBytes } from "crypto";
import { prisma } from "./prisma";

const TOKEN_TTL_HOURS = 24;

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createVerificationToken(
  developerId: string
): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(
    Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000
  );

  await prisma.verificationToken.create({
    data: { developerId, token, expiresAt },
  });

  return token;
}

/** Invalidate all unused tokens for a developer (called before issuing a fresh one). */
export async function invalidateUnusedTokens(
  developerId: string
): Promise<void> {
  await prisma.verificationToken.updateMany({
    where: { developerId, usedAt: null },
    data: { usedAt: new Date() },
  });
}

/** Returns the timestamp of the most recently created token for rate-limiting. */
export async function latestTokenCreatedAt(
  developerId: string
): Promise<Date | null> {
  const token = await prisma.verificationToken.findFirst({
    where: { developerId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return token?.createdAt ?? null;
}
