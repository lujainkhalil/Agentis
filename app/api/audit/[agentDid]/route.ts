import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { agentDid: string } }
) {
  const developer = await authenticate(req);
  if (!developer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentDid = decodeURIComponent(params.agentDid);

  // Confirm the agent belongs to this developer
  const agent = await prisma.agent.findUnique({
    where: { did: agentDid },
    select: { developerId: true },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (agent.developerId !== developer.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const records = await prisma.auditLog.findMany({
    where: { agentDid },
    orderBy: { timestamp: "asc" },
  });

  return NextResponse.json({ agentDid, count: records.length, records });
}
