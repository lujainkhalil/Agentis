import { createHash } from "crypto";
import * as ed from "@noble/ed25519";
import { prisma } from "./prisma";

const GENESIS_HASH = "0".repeat(64);

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function signRecord(content: string): Promise<string> {
  const signingKeyHex = process.env.AGENTIS_SIGNING_KEY;
  if (!signingKeyHex) throw new Error("AGENTIS_SIGNING_KEY not set");
  const privateKeyBytes = Buffer.from(signingKeyHex, "hex");
  const messageBytes = Buffer.from(content, "utf8");
  const signature = await ed.signAsync(messageBytes, privateKeyBytes);
  return Buffer.from(signature).toString("hex");
}

export async function writeAuditLog(params: {
  agentDid?: string;
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { agentDid, action, metadata = {} } = params;

  const latest = await prisma.auditLog.findFirst({
    orderBy: { timestamp: "desc" },
    select: { recordHash: true },
  });

  let previousHash: string;

  if (!latest) {
    const genesisMetadata = { note: "Chain initialised" };
    const genesisContent = JSON.stringify({
      agentDid: null,
      action: "GENESIS",
      metadata: genesisMetadata,
      previousHash: GENESIS_HASH,
    });
    const genesisHash = hashContent(genesisContent);
    const genesisSignature = await signRecord(genesisContent);

    await prisma.auditLog.create({
      data: {
        agentDid: null,
        action: "GENESIS",
        metadata: genesisMetadata,
        previousHash: GENESIS_HASH,
        recordHash: genesisHash,
        signature: genesisSignature,
        timestamp: new Date(0),
      },
    });

    previousHash = genesisHash;
  } else {
    previousHash = latest.recordHash;
  }

  // Serialise metadata once — this exact string is what gets hashed
  const serialisedMetadata = JSON.parse(JSON.stringify(metadata));
  const content = JSON.stringify({
    agentDid: agentDid ?? null,
    action,
    metadata: serialisedMetadata,
    previousHash,
  });

  const recordHash = hashContent(content);
  const signature = await signRecord(content);

  // Store the hash content string in signature field prefix so verify can use it
  // Actually store it in metadata under a reserved key
  await prisma.auditLog.create({
    data: {
      agentDid: agentDid ?? null,
      action,
      metadata: {
        ...serialisedMetadata,
        __hashContent: content,
      } as object,
      previousHash,
      recordHash,
      signature,
    },
  });
}
