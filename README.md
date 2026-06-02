# Agentis

Trust and identity infrastructure for AI agents. Organisations and developers register on Agentis, verify their identity, and issue cryptographic identifiers to their agents. Any counterparty can verify an agent's identity, who owns it, and whether it's trustworthy before interacting with it.

---

## What it does

Every agent registered on Agentis:

- Traces to a verified human or legal entity — there is always an accountable party behind it
- Has a unique DID (Decentralised Identifier) and Ed25519 public key
- Has every action recorded in a cryptographically chained audit log that cannot be silently altered, including by Agentis itself

Any service receiving a request from an Agentis-registered agent can call the public DID endpoint to verify its identity, capabilities, and who owns it — without any prior relationship.

---

## How it connects to proveyouragent

Agentis handles identity registration and verification. [proveyouragent](https://github.com/lujainkhalil/proveyouragent) handles request-level signing.

The flow:

1. Developer registers on Agentis and creates an agent
2. Agentis returns a DID and a private key — the private key is returned once and never stored
3. The agent uses proveyouragent to sign every HTTP request with that private key via DPoP
4. Any service receiving the request calls `GET /api/agents/[did]` to get the public key and verify the signature

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
  "registeredAddress": { ... },
  "jurisdiction": "england-wales",
  "incorporatedOn": "2020-01-15"
}
```

Returns `202` with `pending: true` if Companies House times out — verification falls back to manual review.

---

### POST /api/register

Registers a developer or organisation. Supports two flows.

**Company flow:**
```json
{
  "email": "founder@acme.com",
  "companyName": "Acme Ltd",
  "companyNumber": "12345678",
  "jurisdiction": "england-wales",
  "website": "https://acme.com"
}
```

Auto-verifies to Tier 3 if Companies House confirms the company is active and the email domain matches the registered company name. Otherwise sets status to pending for manual review.

**Individual flow:**
```json
{
  "email": "developer@gmail.com",
  "fullName": "Jane Smith"
}
```

Sets verificationTier to 2, status to pending manual review. API key is returned immediately so you can start building.

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
  "capabilities": ["invoices:read", "payments:write"]
}
```

**Response:**
```json
{
  "did": "did:web:agentis.dev:agents:a7f3c2d1e8b4f920",
  "publicKey": "a7f3c2d1e8b4f920...",
  "privateKey": "3d9f1a2b...",
  "name": "billing-agent",
  "capabilities": ["invoices:read", "payments:write"]
}
```

The private key is returned once and never stored. There is no recovery path. Store it in a secrets manager immediately.

---

### GET /api/agents/[did]

Public endpoint. No authentication required. Returns full agent identity for verification.

**Response:**
```json
{
  "did": "did:web:agentis.dev:agents:a7f3c2d1e8b4f920",
  "name": "billing-agent",
  "capabilities": ["invoices:read", "payments:write"],
  "status": "active",
  "publicKey": "a7f3c2d1e8b4f920...",
  "verifiedName": "Acme Ltd",
  "verificationTier": 3,
  "verificationMethod": "company",
  "companyNumber": "12345678",
  "jurisdiction": "england-wales",
  "createdAt": "2026-06-01T10:00:00Z"
}
```

The `verificationMethod` field tells any counterparty exactly what kind of trust they are getting:
- `email` — email verified only, Tier 1
- `individual` — real person verified, Tier 2
- `company` — registered legal entity verified, Tier 3

---

### GET /api/audit/[agentDid]

Returns the full cryptographic audit chain for a given agent. Authenticated via API key.

Every record includes `previousHash` and `recordHash` so an external auditor can verify chain integrity independently without trusting Agentis.

---

### GET /api/audit/verify

Verifies the integrity of the entire audit chain. Returns pass/fail and the first broken link if any. Authenticated via API key.

---

## Verification tiers

| Tier | Method | Who | Agents status |
|---|---|---|---|
| 1 | Email only | Anyone | Unverified |
| 2 | Individual ID | Solo developers | Individually verified |
| 3 | Companies House | UK registered companies | Organisation verified |
| 4 | Full KYB | Regulated industries | Compliance ready (coming soon) |

---

## The audit layer

Every action on the platform is recorded in a cryptographically chained audit log. This is not a regular log — it is a verifiable record.

Each entry includes:
- `previousHash` — SHA-256 hash of the previous record
- `recordHash` — SHA-256 hash of this record's content
- `signature` — the record signed by Agentis's Ed25519 private key

The chain starts with a genesis record. Altering any record breaks every subsequent hash. An external auditor can verify the entire chain without trusting Agentis as the operator.

This is the difference between an audit log and institutional-grade evidence.

---

## Setup

**1. Install dependencies:**
```bash
npm install
```

**2. Set environment variables** — copy `.env.example` to `.env`:
```
DATABASE_URL=postgresql://...
COMPANIES_HOUSE_API_KEY=...
API_KEY_SECRET=...
AGENTIS_SIGNING_KEY=<64-char hex Ed25519 private key>
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

Add all four environment variables in the Vercel dashboard under Project Settings > Environment Variables. The `DATABASE_URL` should point to your Supabase connection string.

---

## Tech stack

- Next.js 14 App Router with TypeScript
- Supabase (Postgres)
- Prisma ORM
- @noble/ed25519 for cryptographic operations
- Tailwind CSS
- Vercel for deployment

---

## Part of the Agentis ecosystem

**Agentis** (this repo) — identity registration, DID issuance, public verification, verifiable audit

**[proveyouragent](https://github.com/lujainkhalil/proveyouragent)** — request-level signing with DPoP, delegation chains, per-token revocation
