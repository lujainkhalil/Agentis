import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

// DIDs contain colons, which Next.js receives URL-encoded as %3A
function decodeDid(raw: string): string {
  return decodeURIComponent(raw);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { did: string } }
) {
  const did = decodeDid(params.did);

  const agent = await prisma.agent.findUnique({
    where: { did },
    include: {
      developer: {
        select: {
          verifiedName: true,
          verificationTier: true,
          verificationMethod: true,
          companyNumber: true,
          jurisdiction: true,
        },
      },
    },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Fire-and-forget audit log — don't block the response
  writeAuditLog({
    agentDid: did,
    action: "AGENT_VERIFIED",
    metadata: { did },
  }).catch(console.error);

  const body = {
    did: agent.did,
    name: agent.name,
    capabilities: agent.capabilities,
    status: agent.status,
    publicKey: agent.publicKey,
    verifiedName: agent.developer.verifiedName,
    verificationTier: agent.developer.verificationTier,
    verificationMethod: agent.developer.verificationMethod,
    companyNumber:
      agent.developer.verificationMethod === "company"
        ? agent.developer.companyNumber
        : undefined,
    jurisdiction: agent.developer.jurisdiction,
    createdAt: agent.createdAt,
  };

  return NextResponse.json(body, {
    headers: {
      // 60s shared cache, 300s stale-while-revalidate
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
