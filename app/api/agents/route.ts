import { NextRequest, NextResponse } from "next/server";
import * as ed from "@noble/ed25519";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { authenticate } from "@/lib/auth";
import { fetchAndParseAgentCard } from "@/lib/agentCard";

const MAX_CAPABILITIES = 20;
const MAX_CAPABILITY_LENGTH = 100;
const CAPABILITY_PATTERN = /^[a-zA-Z0-9:_\-.]+$/;

function makeDid(publicKeyHex: string): string {
  return `did:web:agentis.dev:agents:${publicKeyHex.slice(0, 32)}`;
}

function validateCapabilityStrings(caps: unknown): string | null {
  if (!Array.isArray(caps)) return "capabilities must be an array of strings";
  if (caps.length > MAX_CAPABILITIES)
    return `capabilities must have ${MAX_CAPABILITIES} items or fewer`;
  for (const cap of caps) {
    if (typeof cap !== "string") return "each capability must be a string";
    if (cap.length > MAX_CAPABILITY_LENGTH)
      return `each capability must be ${MAX_CAPABILITY_LENGTH} characters or fewer`;
    if (!CAPABILITY_PATTERN.test(cap))
      return `invalid capability format: ${cap}. Use alphanumeric characters, colons, hyphens, underscores, and dots only.`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const developer = await authenticate(req);
  if (!developer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    name?: string;
    description?: string;
    capabilities?: string[];
    agentCardUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { agentCardUrl } = body;
  let { name, description, capabilities } = body;

  // ── Agent Card path ───────────────────────────────────────────────────────
  let agentCardData: Record<string, unknown> | null = null;
  const agentCardSigned = false; // always false at creation; set via refresh-card after key issuance

  if (agentCardUrl !== undefined) {
    if (typeof agentCardUrl !== "string" || agentCardUrl.trim() === "") {
      return NextResponse.json(
        { error: "agentCardUrl must be a non-empty string" },
        { status: 400 }
      );
    }

    // We don't have the public key yet at this stage (it's generated below),
    // so signature verification happens in refresh-card after first issuance.
    // On creation, agentCardSigned is always false.
    const cardResult = await fetchAndParseAgentCard(agentCardUrl.trim());

    if ("error" in cardResult) {
      return NextResponse.json(
        { error: `Could not load Agent Card: ${cardResult.error}` },
        { status: 422 }
      );
    }

    agentCardData = cardResult.raw;

    // Card fields fill in blanks left by the request body
    if (!name || name.trim() === "") name = cardResult.name;
    if (!description) description = cardResult.description ?? undefined;

    // Capabilities from card override request-body capabilities
    if (cardResult.capabilities.length > 0) {
      capabilities = cardResult.capabilities.map((c) => c.id);
    }
  }

  // ── Validate name ─────────────────────────────────────────────────────────
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (name.length > 100) {
    return NextResponse.json(
      { error: "name must be 100 characters or fewer" },
      { status: 400 }
    );
  }

  // ── Validate capabilities (only when supplied without a card) ─────────────
  if (capabilities !== undefined && agentCardData === null) {
    const capError = validateCapabilityStrings(capabilities);
    if (capError) {
      return NextResponse.json({ error: capError }, { status: 400 });
    }
  }

  // ── Generate keypair ──────────────────────────────────────────────────────
  const privateKeyBytes = ed.utils.randomSecretKey();
  const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);
  const privateKeyHex = Buffer.from(privateKeyBytes).toString("hex");
  const publicKeyHex = Buffer.from(publicKeyBytes).toString("hex");

  const did = makeDid(publicKeyHex);

  const agentStatus =
    developer.verificationTier >= 2 ? "active" : "unverified";

  const agent = await prisma.agent.create({
    data: {
      name: name.trim(),
      description: description ?? null,
      did,
      publicKey: publicKeyHex,
      capabilities: capabilities ?? [],
      agentCardUrl: agentCardUrl?.trim() ?? null,
      agentCardData: agentCardData as object ?? null,
      agentCardSigned,
      status: agentStatus,
      developerId: developer.id,
    },
  });

  await writeAuditLog({
    agentDid: did,
    action: "AGENT_CREATED",
    metadata: {
      agentId: agent.id,
      name: agent.name,
      developerId: developer.id,
      verificationTier: developer.verificationTier,
      agentCardUrl: agentCardUrl ?? null,
    },
  });

  return NextResponse.json(
    {
      did,
      agentId: agent.id,
      name: agent.name,
      publicKey: publicKeyHex,
      privateKey: privateKeyHex,
      status: agentStatus,
      agentCardUrl: agent.agentCardUrl,
      agentCardSigned: agent.agentCardSigned,
      capabilities: agent.capabilities,
      warning:
        "Store your private key securely. It cannot be recovered. Use it with proveyouragent to sign HTTP requests.",
    },
    { status: 201 }
  );
}
