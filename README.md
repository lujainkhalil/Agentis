# Agentis

Trust and identity infrastructure for AI agents. Organisations and developers register on Agentis, verify their identity, and issue cryptographic identifiers to their agents. Any counterparty can verify an agent's identity, who owns it, and whether it's trustworthy before interacting with it.

---

## What it does

Every agent registered on Agentis:

- Traces to a verified human or legal entity — there is always an accountable party behind it
- Has a unique DID (Decentralised Identifier) and Ed25519 public key
- Supports A2A Agent Cards for structured capability declarations
- Has every action recorded in a cryptographically chained audit log that cannot be silently altered, including by Agentis itself

Any service receiving a request from an Agentis-registered agent can call the public DID endpoint to verify its identity, capabilities, and who owns it — without any prior relationship.

---

## API

### POST /api/verify-company

Verifies a UK company against Companies House. Used internally by `/api/register` but also available standalone.

**Request:**
```json
{
  "companyNumber": "12345678"
}
```

**Response:**
```json
{
  "companyNumber": "12345678",
  "companyName": "Acme Ltd",
  "status": "active",
  "type": "ltd",
  "registeredAddress": { },
  "jurisdiction": "england-wales",
  "incorporatedOn": "2020-01-15"
}
```

Returns `202` with `pending: true` if Companies House times out. Verification falls back to manual review.

---

### POST /api/register

Registers a developer or organisation. Supports two flows.

**Company flow:**
```json
{
  "email": "founder@acme.com",
  "companyName": "Acme Ltd",
  "companyNumber": "12345678",
  "domain": "acme.com",
  "jurisdiction": "england-wales",
  "website": "https://acme.com"
}
```

Two gates must both complete before the API key is issued: email verification and DNS domain ownership (via TXT record). Auto-verifies to Tier 3 once both are confirmed.

**Individual flow:**
```json
{
  "email": "developer@gmail.com",
  "fullName": "Jane Smith"
}
```

Sets verificationTier to 2, status to pending manual review. Email verification required before the API key is issued.

**Response (both flows):**
```json
{
  "apiKey": "agentis_...",
  "developerId": "clx...",
  "status": "verified",
  "verificationTier": 3,
  "verificationMethod": "company",
  "verifiedName": "Acme Ltd"
}
```

---

### POST /api/agents

Creates an agent. Authenticated via API key.

**Headers:**
```
Authorization: Bearer agentis_...
```

**Request:**
```json
{
  "name": "billing-agent",
  "description": "Handles invoice processing and payment reconciliation",
  "capabilities": ["invoices:read", "payments:write"],
  "agentCardUrl": "https://acme.com/.well-known/agent-card.json"
}
```

`agentCardUrl` is optional. When provided, Agentis fetches the A2A Agent Card and imports structured capabilities from it automatically.

**Response:**
```json
{
  "did": "did:web:agentis.dev:agents:a7f3c2d1e8b4f920",
  "publicKey": "a7f3c2d1e8b4f920...",
  "privateKey": "3d9f1a2b...",
  "name": "billing-agent",
  "capabilities": ["invoices:read", "payments:write"],
  "agentCardUrl": "https://acme.com/.well-known/agent-card.json",
  "agentCardSigned": false
}
```

The private key is returned once and never stored. There is no recovery path. Store it in a secrets manager immediately.

---

### POST /api/agents/[did]/refresh-card

Re-fetches the agent card from `agentCardUrl` and updates stored capabilities. If the card contains a signature matching the agent's public key, `agentCardSigned` is set to `true`. Authenticated via API key.

Use this after registering to sign your card and verify it:

```python
import json
from proveyouragent.keypair import load_private_key

def sign_card(card: dict, private_key_hex: str) -> dict:
    def sort_keys(obj):
        if isinstance(obj, dict):
            return {k: sort_keys(v) for k, v in sorted(obj.items())}
        if isinstance(obj, list):
            return [sort_keys(i) for i in obj]
        return obj

    card_without_sig = {k: v for k, v in card.items() if k != "signature"}
    canonical = json.dumps(sort_keys(card_without_sig), separators=(',', ':'))
    private_key = load_private_key(bytes.fromhex(private_key_hex))
    sig = private_key.sign(canonical.encode())
    return {**card, "signature": sig.hex()}
```

---

### GET /api/agents/[did]

Public endpoint. No authentication required. Returns full agent identity for verification.

**Response:**
```json
{
  "did": "did:web:agentis.dev:agents:a7f3c2d1e8b4f920",
  "name": "billing-agent",
  "capabilities": [
    {
      "id": "invoices:read",
      "description": "Read and list invoices"
    },
    {
      "id": "payments:write",
      "description": "Process payments"
    }
  ],
  "status": "active",
  "publicKey": "a7f3c2d1e8b4f920...",
  "verifiedName": "Acme Ltd",
  "verificationTier": 3,
  "verificationMethod": "company",
  "companyNumber": "12345678",
  "verifiedDomain": "acme.com",
  "jurisdiction": "england-wales",
  "agentCardUrl": "https://acme.com/.well-known/agent-card.json",
  "agentCardSigned": true,
  "createdAt": "2026-06-01T10:00:00Z"
}
```

Capabilities are returned as structured objects when imported from an A2A Agent Card, and as plain strings when declared directly.

The `verificationMethod` field tells any counterparty exactly what kind of trust they are getting:

- `email` — email verified only, Tier 1
- `individual` — real person verified, Tier 2
- `company` — registered legal entity verified via Companies House and domain ownership, Tier 3

---

### POST /api/audit/events

Appends a custom event to the agent's audit chain. Authenticated via API key.

```json
{
  "agentDid": "did:web:agentis.dev:agents:abc123",
  "action": "INVOICE_PROCESSED",
  "metadata": {
    "invoiceId": "inv_456",
    "amount": 1200,
    "authorisedBy": "alice@acme.com"
  }
}
```

Action must be uppercase with underscores. The `AGENTIS_` prefix is reserved for platform events.

Returns the `recordHash` so you can reference this specific record.

---

### GET /api/audit/[agentDid]

Returns the full cryptographic audit chain for a given agent. Authenticated via API key.

Every record includes `previousHash` and `recordHash` so an external auditor can verify chain integrity independently without trusting Agentis.

---

### GET /api/audit/verify

Verifies the integrity of the entire audit chain. Returns pass/fail and the first broken link if any. Authenticated via API key.

---

## Verification tiers

| Tier | Method | Who | Agent status |
|---|---|---|---|
| 1 | Email only | Anyone | Unverified |
| 2 | Individual | Solo developers | Individually verified |
| 3 | Companies House + domain | UK registered companies | Organisation verified |
| 4 | Full KYB | Regulated industries | Compliance ready (coming soon) |

---

## The audit layer

Every action on the platform is recorded in a cryptographically chained audit log. This is not a regular log — it is a verifiable record.

Each entry includes:

- `previousHash` — SHA-256 hash of the previous record
- `recordHash` — SHA-256 hash of this record's content
- `signature` — the record signed by Agentis's Ed25519 private key

The chain starts with a genesis record. Altering any record breaks every subsequent hash. An external auditor can verify the entire chain without trusting Agentis as the operator.

Developers can write their own events using `POST /api/audit/events` — making the audit chain a complete record of everything the agent did, not just platform activity.

---

## A2A Agent Card support

Agentis supports A2A Agent Cards for structured capability declarations. When you register an agent with an `agentCardUrl`, Agentis fetches the card and imports structured capabilities automatically.

After registration, sign your card with your agent's private key and call `POST /api/agents/[did]/refresh-card` to have Agentis verify the signature. Verified cards are marked `agentCardSigned: true` in all registry responses.

The card format follows the A2A protocol specification. Capabilities are imported as structured objects with `id` and `description` fields.

---

## Setup

**1. Install dependencies:**
```bash
npm install
```

**2. Set environment variables — copy `.env.example` to `.env`:**
```
DATABASE_URL=postgresql://...
COMPANIES_HOUSE_API_KEY=...
API_KEY_SECRET=...
AGENTIS_SIGNING_KEY=<64-char hex Ed25519 private key>
RESEND_API_KEY=...
OPERATOR_EMAIL=...
NEXT_PUBLIC_BASE_URL=https://your-deployment-url
```

Generate a signing key:
```bash
node -e "const {randomBytes} = require('crypto'); console.log(randomBytes(32).toString('hex'))"
```

**3. Run database migrations:**
```bash
npx prisma migrate dev
npx prisma generate
```

**4. Run locally:**
```bash
npm run dev
```

---

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add all environment variables in the Vercel dashboard under Project Settings > Environment Variables. Use the Supabase connection pooler URL for `DATABASE_URL` with `?pgbouncer=true` appended.

---

## Tech stack

- Next.js 14 App Router with TypeScript
- Supabase (Postgres)
- Prisma ORM
- @noble/ed25519 for cryptographic operations
- Tailwind CSS
- Vercel for deployment

---

## The Agentis ecosystem

**Agentis** (this repo) — identity registration, DID issuance, A2A card support, public verification, verifiable audit

**[proveyouragent](https://pypi.org/project/proveyouragent/)** — request-level signing with Ed25519 and DPoP, delegation chains, per-token revocation

**[agentis-verify](https://pypi.org/project/agentis-verify/)** — FastAPI middleware that verifies incoming agent requests against the Agentis registry

**[agentis-quickstart](https://github.com/lujainkhalil/agentis-quickstart)** — complete working example showing all components end to end in under 10 minutes
