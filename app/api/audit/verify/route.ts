import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { authenticate } from "@/lib/auth";

const GENESIS_HASH = "0".repeat(64);

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function GET(req: NextRequest) {
  const developer = await authenticate(req);
  if (!developer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const records = await prisma.auditLog.findMany({
    orderBy: { timestamp: "asc" },
  });

  if (records.length === 0) {
    return NextResponse.json({ valid: true, message: "Audit log is empty" });
  }

  let expectedPreviousHash = GENESIS_HASH;

  for (let i = 0; i < records.length; i++) {
    const r = records[i];

    // Re-compute the recordHash from the stored fields
    const contentForHash = JSON.stringify({
      agentDid: r.agentDid ?? null,
      action: r.action,
      metadata: r.metadata,
      previousHash: r.previousHash,
      timestamp: r.timestamp.toISOString(),
    });

    const recomputed = hashContent(contentForHash);

    // 1. Does the stored recordHash match our recomputation?
    if (recomputed !== r.recordHash) {
      return NextResponse.json({
        valid: false,
        brokenAt: i,
        recordId: r.id,
        reason: "recordHash mismatch — record may have been tampered with",
      });
    }

    // 2. Does previousHash chain correctly?
    if (r.previousHash !== expectedPreviousHash) {
      return NextResponse.json({
        valid: false,
        brokenAt: i,
        recordId: r.id,
        reason: "previousHash does not match preceding record's hash — chain is broken",
      });
    }

    expectedPreviousHash = r.recordHash;
  }

  return NextResponse.json({
    valid: true,
    recordsChecked: records.length,
    chainTip: records[records.length - 1].recordHash,
  });
}
