import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { authenticate } from "@/lib/auth";
import { fetchAndParseAgentCard } from "@/lib/agentCard";

function decodeDid(raw: string): string {
  return decodeURIComponent(raw);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { did: string } }
) {
  const developer = await authenticate(req);
  if (!developer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const did = decodeDid(params.did);

  const agent = await prisma.agent.findUnique({
    where: { did },
    select: {
      id: true,
      developerId: true,
      agentCardUrl: true,
      publicKey: true,
      status: true,
      capabilities: true,
    },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Ownership check -- return 404 to avoid confirming the DID exists
  if (agent.developerId !== developer.id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (agent.status === "revoked") {
    return NextResponse.json(
      { error: "Cannot refresh the card of a revoked agent" },
      { status: 400 }
    );
  }

  // Allow overriding the card URL in the request body for the first time a
  // card is added to an existing agent, or when the URL has moved.
  let body: { agentCardUrl?: string } = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cardUrl = body.agentCardUrl?.trim() ?? agent.agentCardUrl;

  if (!cardUrl) {
    return NextResponse.json(
      {
        error:
          "This agent has no agentCardUrl. Provide one in the request body: { \"agentCardUrl\": \"https://...\" }",
      },
      { status: 400 }
    );
  }

  // Fetch and parse -- pass the agent's public key so the card signature can
  // be verified if the developer has added one since registration.
  const cardResult = await fetchAndParseAgentCard(cardUrl, agent.publicKey);

  if ("error" in cardResult) {
    return NextResponse.json(
      { error: `Could not load Agent Card: ${cardResult.error}` },
      { status: 422 }
    );
  }

  const updatedCapabilities =
    cardResult.capabilities.length > 0
      ? cardResult.capabilities.map((c) => c.id)
      : agent.capabilities; // keep existing IDs if card has no capabilities

  const updated = await prisma.agent.update({
    where: { did },
    data: {
      agentCardUrl: cardUrl,
      agentCardData: cardResult.raw as object,
      agentCardSigned: cardResult.signed,
      capabilities: updatedCapabilities,
      // Update name and description only if they came from the card originally
      // (i.e. don't clobber manually-set values with stale card values).
      // We use the card values unconditionally here -- refresh-card implies
      // the developer wants the card to be the source of truth.
      name: cardResult.name,
      description: cardResult.description ?? undefined,
    },
    select: {
      id: true,
      did: true,
      name: true,
      capabilities: true,
      agentCardUrl: true,
      agentCardSigned: true,
    },
  });

  await writeAuditLog({
    agentDid: did,
    action: "AGENT_CARD_REFRESHED",
    metadata: {
      agentId: agent.id,
      agentCardUrl: cardUrl,
      agentCardSigned: cardResult.signed,
      capabilitiesCount: updatedCapabilities.length,
    },
  });

  return NextResponse.json({
    refreshed: true,
    did: updated.did,
    name: updated.name,
    agentCardUrl: updated.agentCardUrl,
    agentCardSigned: updated.agentCardSigned,
    capabilities: updatedCapabilities,
  });
}
