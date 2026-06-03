import { NextRequest, NextResponse } from "next/server";
import * as ed from "@noble/ed25519";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { authenticate } from "@/lib/auth";

const MAX_CAPABILITIES = 20;
const MAX_CAPABILITY_LENGTH = 100;
const CAPABILITY_PATTERN = /^[a-zA-Z0-9:_\-\.]+$/;

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

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (name.length > 100) {
    return NextResponse.json(
      { error: "name must be 100 characters or fewer" },
      { status: 400 }
    );
  }

  if (capabilities !== undefined) {
    if (!Array.isArray(capabilities)) {
      return NextResponse.json(
        { error: "capabilities must be an array of strings" },
        { status: 400 }
      );
    }
    if (capabilities.length > MAX_CAPABILITIES) {
      return NextResponse.json(
        { error: `capabilities must have ${MAX_CAPABILITIES} items or fewer` },
        { status: 400 }
      );
    }
    for (const cap of capabilities) {
      if (typeof cap !== "string") {
        return NextResponse.json(
          { error: "each capability must be a string" },
          { status: 400 }
        );
      }
      if (cap.length > MAX_CAPABILITY_LENGTH) {
        return NextResponse.json(
          { error: `each capability must be ${MAX_CAPABILITY_LENGTH} characters or fewer` },
          { status: 400 }
        );
      }
      if (!CAPABILITY_PATTERN.test(cap)) {
        return NextResponse.json(
          { error: `invalid capability format: ${cap}. Use alphanumeric characters, colons, hyphens, underscores, and dots only.` },
          { status: 400 }
        );
      }
    }
  }

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
      name: name.trim(),
      publicKey: publicKeyHex,
      privateKey: privateKeyHex,
      status: agentStatus,
      warning:
        "Store your private key securely. It cannot be recovered. Use it with proveyouragent to sign HTTP requests.",
    },
    { status: 201 }
  );
}
