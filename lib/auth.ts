import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import type { Developer } from "@prisma/client";

export async function authenticate(
  req: NextRequest
): Promise<Developer | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKey = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!apiKey) return null;

  return prisma.developer.findUnique({ where: { apiKey } });
}
