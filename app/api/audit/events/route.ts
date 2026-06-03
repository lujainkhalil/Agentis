import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { authenticate } from "@/lib/auth";

// Actions must be SCREAMING_SNAKE_CASE and cannot use the reserved prefix
const ACTION_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const ACTION_MAX_LENGTH = 100;
const RESERVED_PREFIX = "AGENTIS_";

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const developer = await authenticate(req);
  if (!developer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only fully verified developers can write to the ledger. Pending accounts
  // haven't completed identity verification, so their records would carry no
  // trust anchor — which defeats the point of a verified audit chain.
  if (developer.status === "pending") {
    return NextResponse.json(
      {
        error:
          "Your account is still pending verification. Complete email (and domain, if applicable) verification before writing audit events.",
      },
      { status: 403 }
    );
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: {
    agentDid?: unknown;
    action?: unknown;
    metadata?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { agentDid, action, metadata } = body;

  // ── Validate agentDid ──────────────────────────────────────────────────────
  if (!agentDid || typeof agentDid !== "string") {
    return NextResponse.json(
      { error: "agentDid is required and must be a string" },
      { status: 400 }
    );
  }

  // ── Validate action ────────────────────────────────────────────────────────
  if (!action || typeof action !== "string") {
    return NextResponse.json(
      { error: "action is required and must be a string" },
      { status: 400 }
    );
  }

  if (action.length > ACTION_MAX_LENGTH) {
    return NextResponse.json(
      { error: `action must be ${ACTION_MAX_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  if (!ACTION_PATTERN.test(action)) {
    return NextResponse.json(
      {
        error:
          "action must be uppercase with underscores only (e.g. INVOICE_PROCESSED). " +
          "It must start with a letter.",
      },
      { status: 400 }
    );
  }

  if (action.startsWith(RESERVED_PREFIX)) {
    return NextResponse.json(
      {
        error: `action cannot start with "${RESERVED_PREFIX}" — that prefix is reserved for platform events`,
      },
      { status: 400 }
    );
  }

  // ── Validate metadata ──────────────────────────────────────────────────────
  if (metadata !== undefined) {
    if (
      typeof metadata !== "object" ||
      metadata === null ||
      Array.isArray(metadata)
    ) {
      return NextResponse.json(
        { error: "metadata must be a plain object if provided" },
        { status: 400 }
      );
    }
  }

  // ── Ownership check ────────────────────────────────────────────────────────
  // The agent must exist AND belong to the authenticated developer.
  // We do a single targeted query rather than two round-trips.
  const agent = await prisma.agent.findUnique({
    where: { did: agentDid },
    select: { developerId: true, status: true },
  });

  if (!agent) {
    return NextResponse.json(
      { error: "Agent not found" },
      { status: 404 }
    );
  }

  if (agent.developerId !== developer.id) {
    // Return 404 rather than 403 — don't confirm that the DID exists for
    // developers who don't own it.
    return NextResponse.json(
      { error: "Agent not found" },
      { status: 404 }
    );
  }

  if (agent.status === "revoked") {
    return NextResponse.json(
      { error: "Cannot write audit events for a revoked agent" },
      { status: 400 }
    );
  }

  // ── Write to the chain ─────────────────────────────────────────────────────
  const receipt = await writeAuditLog({
    agentDid,
    action,
    metadata: metadata as Record<string, unknown> | undefined,
  });

  return NextResponse.json(
    {
      recorded: true,
      recordHash: receipt.recordHash,
      agentDid,
      action,
      timestamp: receipt.timestamp.toISOString(),
    },
    { status: 201 }
  );
}
