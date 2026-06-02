import { createHmac, randomBytes } from "crypto";

export function generateApiKey(): string {
  const secret = process.env.API_KEY_SECRET ?? "fallback-secret";
  const random = randomBytes(32).toString("hex");
  const hmac = createHmac("sha256", secret).update(random).digest("hex");
  // Format: agentis_<random_prefix>_<hmac_suffix>
  return `agentis_${random.slice(0, 16)}_${hmac.slice(0, 32)}`;
}
