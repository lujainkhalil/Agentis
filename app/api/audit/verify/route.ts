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
    const meta = r.metadata as Record<string, unknown>;

    // Use the stored hash content string for genesis records
    // For other records use __hashContent stored in metadata
    let content: string;

    if (r.action === "GENESIS") {
      content = JSON.stringify({
        agentDid: null,
        action: "GENESIS",
        metadata: { note: "Chain initialised" },
        previousHash: GENESIS_HASH,
      });
    } else {
      const hashContent_ = meta.__hashContent as string | undefined;
      if (!hashContent_) {
        return NextResponse.json({
          valid: false,
          brokenAt: i,
          recordId: r.id,
          reason: "Missing __hashContent — cannot verify record",
        });
      }
      content = hashContent_;
    }

    const recomputed = hashContent(content);

    if (recomputed !== r.recordHash) {
      return NextResponse.json({
        valid: false,
        brokenAt: i,
        recordId: r.id,
        reason: "recordHash mismatch — record may have been tampered with",
      });
    }

    if (r.previousHash !== expectedPreviousHash) {
      return NextResponse.json({
        valid: false,
        brokenAt: i,
        recordId: r.id,
        reason: "previousHash does not match preceding record",
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
