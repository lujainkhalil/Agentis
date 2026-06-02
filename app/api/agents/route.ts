import { NextRequest, NextResponse } from "next/server";
import * as ed from "@noble/ed25519";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { authenticate } from "@/lib/auth";

function makeDid(publicKeyHex: string): string {
  return `did:web:agentis.dev:agents:${publicKeyHex.slice(0, 32)}`;
}

export async function POST(req: NextRequest) {
  const developer = await authenticate(req);
  if (!developer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; description?: string; capabilities?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, description, capabilities } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (capabilities !== undefined && !Array.isArray(capabilities)) {
    return NextResponse.json(
      { error: "capabilities must be an array of strings" },
      { status: 400 }
    );
  }

  // Generate Ed25519 keypair
  const privateKeyBytes = ed.utils.randomSecretKey();
  const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);

  const privateKeyHex = Buffer.from(privateKeyBytes).toString("hex");
  const publicKeyHex = Buffer.from(publicKeyBytes).toString("hex");

  const did = makeDid(publicKeyHex);

  // Tier 1 (email-only) agents are marked unverified in the public registry
  const agentStatus =
    developer.verificationTier >= 2 ? "active" : "unverified";

  const agent = await prisma.agent.create({
    data: {
      name,
      description: description ?? null,
      did,
      publicKey: publicKeyHex,
      capabilities: capabilities ?? [],
      status: agentStatus,
      developerId: developer.id,
    },
  });

  await writeAuditLog({
    agentDid: did,
    action: "AGENT_CREATED",
    metadata: {
      agentId: agent.id,
      name,
      developerId: developer.id,
      verificationTier: developer.verificationTier,
    },
  });

  return NextResponse.json(
    {
      did,
      agentId: agent.id,
      name,
      publicKey: publicKeyHex,
      privateKey: privateKeyHex, // returned ONCE — never stored
      status: agentStatus,
      warning:
        "Store your private key securely. It cannot be recovered. Use it with proveyouragent to sign HTTP requests.",
    },
    { status: 201 }
  );
}
