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

  const previousHash = latest ? latest.recordHash : GENESIS_HASH;

  // Auto-create genesis record when the table is empty
  if (!latest) {
    const genesisContent = JSON.stringify({
      agentDid: null,
      action: "GENESIS",
      metadata: { note: "Chain initialised" },
      previousHash: GENESIS_HASH,
      timestamp: new Date(0).toISOString(),
    });
    const genesisHash = hashContent(genesisContent);
    const genesisSignature = await signRecord(genesisContent);

    await prisma.auditLog.create({
      data: {
        agentDid: null,
        action: "GENESIS",
        metadata: { note: "Chain initialised" },
        previousHash: GENESIS_HASH,
        recordHash: genesisHash,
        signature: genesisSignature,
        timestamp: new Date(0),
      },
    });
  }

  const timestamp = new Date().toISOString();
  const contentForHash = JSON.stringify({
    agentDid: agentDid ?? null,
    action,
    metadata,
    previousHash,
    timestamp,
  });

  const recordHash = hashContent(contentForHash);
  const signature = await signRecord(contentForHash);

  await prisma.auditLog.create({
    data: {
      agentDid: agentDid ?? null,
      action,
      metadata: metadata as object,
      previousHash,
      recordHash,
      signature,
    },
  });
}
