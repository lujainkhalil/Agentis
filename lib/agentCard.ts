import * as ed from "@noble/ed25519";

const FETCH_TIMEOUT_MS = 5000;
const MAX_CARD_BYTES = 64 * 1024; // 64 KB

// ── Public types ─────────────────────────────────────────────────────────────

export interface StructuredCapability {
  id: string;
  description?: string;
}

export interface AgentCardResult {
  name: string;
  description: string | null;
  url: string;
  version: string;
  capabilities: StructuredCapability[];
  raw: Record<string, unknown>;
  signed: boolean;
}

export type AgentCardError = { error: string };

// ── Fetch + parse ─────────────────────────────────────────────────────────────

export async function fetchAndParseAgentCard(
  cardUrl: string,
  agentPublicKeyHex?: string
): Promise<AgentCardResult | AgentCardError> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let text: string;
  try {
    const res = await fetch(cardUrl, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { error: `Agent Card URL returned HTTP ${res.status}` };
    }

    text = await res.text();
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return { error: "Agent Card URL timed out after 5 seconds" };
    }
    return {
      error: `Failed to fetch Agent Card: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (text.length > MAX_CARD_BYTES) {
    return { error: "Agent Card exceeds the 64 KB size limit" };
  }

  let card: Record<string, unknown>;
  try {
    card = JSON.parse(text);
  } catch {
    return { error: "Agent Card is not valid JSON" };
  }

  if (typeof card !== "object" || card === null || Array.isArray(card)) {
    return { error: "Agent Card must be a JSON object" };
  }

  // Required A2A fields
  const REQUIRED = ["name", "description", "url", "version", "capabilities"] as const;
  const missing = REQUIRED.filter((f) => !(f in card));
  if (missing.length > 0) {
    return { error: `Agent Card missing required fields: ${missing.join(", ")}` };
  }

  if (typeof card.name !== "string" || card.name.trim() === "") {
    return { error: "Agent Card 'name' must be a non-empty string" };
  }

  const capabilities = parseCapabilities(card.capabilities);

  // Verify signature when present. The signature must be an Ed25519 signature
  // over the canonical JSON of the card with the 'signature' key removed,
  // hex-encoded. This requires the agent's public key from Agentis.
  let signed = false;
  if (agentPublicKeyHex && typeof card.signature === "string") {
    signed = await verifyCardSignature(card, agentPublicKeyHex);
  }

  return {
    name: (card.name as string).trim(),
    description: typeof card.description === "string" ? card.description : null,
    url: card.url as string,
    version: typeof card.version === "string" ? card.version : String(card.version),
    capabilities,
    raw: card,
    signed,
  };
}

// ── Capability parsing ────────────────────────────────────────────────────────

function parseCapabilities(raw: unknown): StructuredCapability[] {
  const result: StructuredCapability[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string" && item.trim()) {
        result.push({ id: item.trim() });
      } else if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        // Accept 'id' or 'name' as the capability identifier
        const id = typeof obj.id === "string" ? obj.id : typeof obj.name === "string" ? obj.name : null;
        if (id && id.trim()) {
          result.push({
            id: id.trim(),
            ...(typeof obj.description === "string" ? { description: obj.description } : {}),
          });
        }
      }
    }
    return result;
  }

  // A2A spec also allows capabilities as an object keyed by capability name
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    for (const key of Object.keys(raw as Record<string, unknown>)) {
      result.push({ id: key });
    }
    return result;
  }

  return result;
}

// ── Signature verification ────────────────────────────────────────────────────

async function verifyCardSignature(
  card: Record<string, unknown>,
  publicKeyHex: string
): Promise<boolean> {
  try {
    // Remove the signature field before re-serialising
    const { signature, ...rest } = card;
    if (typeof signature !== "string") return false;

    // Canonical serialisation: sorted keys for determinism
    const canonical = JSON.stringify(sortKeys(rest));
    const pubKeyBytes = Buffer.from(publicKeyHex, "hex");
    const sigBytes = Buffer.from(signature, "hex");
    const msgBytes = Buffer.from(canonical, "utf8");

    return await ed.verifyAsync(sigBytes, msgBytes, pubKeyBytes);
  } catch {
    return false;
  }
}

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (typeof obj === "object" && obj !== null) {
    return Object.fromEntries(
      Object.keys(obj as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((obj as Record<string, unknown>)[k])])
    );
  }
  return obj;
}

// ── Response shaping helper ───────────────────────────────────────────────────

/**
 * Shape the capabilities for a public API response.
 * If the agent has card data, return structured objects.
 * If not, return the plain string IDs.
 */
export function shapeCapabilities(
  capabilities: string[],
  agentCardData: unknown
): StructuredCapability[] | string[] {
  if (agentCardData == null) {
    return capabilities;
  }

  // Try to extract structured capabilities from the stored card
  try {
    const card = agentCardData as Record<string, unknown>;
    const parsed = parseCapabilities(card.capabilities);
    if (parsed.length > 0) return parsed;
  } catch {
    // Fall through to returning plain IDs as structured objects
  }

  // Card present but capabilities couldn't be parsed: wrap IDs in objects
  return capabilities.map((id) => ({ id }));
}
