"use client";

import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TxtRecord {
  host: string;
  value: string;
  instructions: string;
}

interface CompanySuccess {
  developerId: string;
  domain: string;
  txtRecord: TxtRecord;
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function PrimaryButton({
  children,
  loading,
  onClick,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  loading?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md bg-[#111827] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading ? (
        <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      ) : null}
      {children}
    </button>
  );
}

function InputField({
  label,
  id,
  type = "text",
  placeholder,
  value,
  onChange,
  required,
}: {
  label: string;
  id: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-[#374151]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#111827] placeholder-[#9ca3af] outline-none transition focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/20"
      />
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
      {message}
    </p>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#111827]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <span className="text-lg font-bold tracking-tight text-white">
          Agentis
        </span>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/lujainkhalil/Agentis"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-white/70 transition hover:text-white"
          >
            GitHub
          </a>
          <a
            href="#register"
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-[#111827] transition hover:bg-white/90"
          >
            Register for beta
          </a>
        </div>
      </div>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="bg-[#111827] px-6 py-24 text-center">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0F6E56]" />
          Early access
        </div>
        <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
          Trust infrastructure
          <br />
          for AI agents
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/60">
          Organisations and developers register on Agentis and issue
          cryptographic identities to their agents. Any counterparty can verify
          who owns an agent and whether to trust it — before interacting with
          it.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#register"
            className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-[#111827] transition hover:bg-white/90"
          >
            Register for beta
          </a>
          <a
            href="https://github.com/lujainkhalil/Agentis"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
          >
            <GitHubIcon />
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Problem ───────────────────────────────────────────────────────────────────

const PROBLEMS = [
  {
    icon: "⚠",
    title: "No attribution",
    body: "Agents call APIs with shared tokens. There's no standard way to know which agent made a request or who is accountable for it.",
  },
  {
    icon: "⚠",
    title: "No proof",
    body: "Bearer tokens can be stolen and replayed. There's no cryptographic proof that a request actually came from a specific agent.",
  },
  {
    icon: "⚠",
    title: "No audit trail",
    body: "When something goes wrong, you can't reconstruct what your agents did, under what authority, or whether the record has been tampered with.",
  },
];

function ProblemSection() {
  return (
    <section className="bg-white px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-12 text-center text-2xl font-bold text-[#111827] sm:text-3xl">
          The problem with agent credentials today
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {PROBLEMS.map((p) => (
            <div
              key={p.title}
              className="rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-sm"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-lg">
                {p.icon}
              </div>
              <h3 className="mb-2 text-base font-semibold text-[#111827]">
                {p.title}
              </h3>
              <p className="text-sm leading-relaxed text-[#6b7280]">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    title: "Verify your organisation",
    body: "Register your company or individual identity. UK companies are verified against Companies House. Domain ownership is confirmed via DNS TXT record.",
  },
  {
    n: "02",
    title: "Issue agent identities",
    body: "Each agent gets an Ed25519 keypair and a W3C DID (did:web:agentis.dev:agents:…). The private key is returned once and never stored. Use it with proveyouragent to sign every request.",
  },
  {
    n: "03",
    title: "Verify any agent, anywhere",
    body: "Any counterparty calls GET /api/agents/[did] to verify an agent's identity, capabilities, and the organisation behind it — before interacting with it.",
  },
];

function HowItWorksSection() {
  return (
    <section className="bg-[#f9fafb] px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-12 text-center text-2xl font-bold text-[#111827] sm:text-3xl">
          How Agentis works
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
              <div
                className="mb-4 font-[family-name:var(--font-geist-mono)] text-3xl font-bold text-[#e5e7eb]"
              >
                {s.n}
              </div>
              <h3 className="mb-2 text-base font-semibold text-[#111827]">
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed text-[#6b7280]">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Code snippet ──────────────────────────────────────────────────────────────

const CURL = `curl https://agentis.dev/api/agents/did:web:agentis.dev:agents:28e83dff641920ad`;

const RESPONSE = `{
  "did": "did:web:agentis.dev:agents:28e83dff641920ad",
  "name": "billing-agent",
  "capabilities": ["invoices:read", "payments:write"],
  "status": "active",
  "verifiedName": "Acme Ltd",
  "verificationTier": 3,
  "verificationMethod": "company",
  "verifiedDomain": "acme.com"
}`;

function CodeSection() {
  return (
    <section className="bg-white px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-3 text-center text-2xl font-bold text-[#111827] sm:text-3xl">
          One endpoint to verify any agent
        </h2>
        <p className="mb-10 text-center text-sm text-[#6b7280]">
          Public, unauthenticated, designed to be called by counterparties at
          runtime.
        </p>

        <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] shadow-xl">
          {/* Request */}
          <div className="border-b border-[#2a2a2a] px-5 py-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#6b7280]">
              Request
            </span>
          </div>
          <div className="overflow-x-auto px-5 py-4">
            <pre className="font-[family-name:var(--font-geist-mono)] text-sm leading-relaxed text-[#a3e635]">
              <span className="text-[#6b7280]">$ </span>
              {CURL}
            </pre>
          </div>

          {/* Response */}
          <div className="border-b border-t border-[#2a2a2a] px-5 py-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#6b7280]">
              Response
            </span>
          </div>
          <div className="overflow-x-auto px-5 py-4">
            <pre className="font-[family-name:var(--font-geist-mono)] text-sm leading-relaxed">
              {RESPONSE.split("\n").map((line, i) => {
                // Colour keys teal, strings white, numbers/booleans amber
                const keyMatch = line.match(/^(\s*)"([^"]+)":/);
                const rest = keyMatch
                  ? line.slice(keyMatch[0].length)
                  : line;
                return (
                  <span key={i} className="block">
                    {keyMatch ? (
                      <>
                        <span className="text-[#9ca3af]">
                          {keyMatch[1]}
                        </span>
                        <span className="text-[#7dd3fc]">
                          &quot;{keyMatch[2]}&quot;
                        </span>
                        <span className="text-[#9ca3af]">: </span>
                        <CodeValue value={rest.trim()} />
                      </>
                    ) : (
                      <span className="text-[#9ca3af]">{line}</span>
                    )}
                  </span>
                );
              })}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function CodeValue({ value }: { value: string }) {
  if (value.startsWith('"'))
    return <span className="text-[#86efac]">{value}</span>;
  if (value === "true" || value === "false" || /^\d/.test(value))
    return <span className="text-[#fb923c]">{value}</span>;
  // array or object bracket
  return <span className="text-[#9ca3af]">{value}</span>;
}

// ── Tiers table ───────────────────────────────────────────────────────────────

const TIERS = [
  {
    tier: 1,
    label: "Email only",
    who: "Anyone",
    detail: "Agents marked unverified",
    badge: "bg-[#f3f4f6] text-[#6b7280]",
    active: true,
  },
  {
    tier: 2,
    label: "Individual",
    who: "Solo developers",
    detail: "Real person confirmed",
    badge: "bg-blue-50 text-blue-700",
    active: true,
  },
  {
    tier: 3,
    label: "Organisation",
    who: "UK registered companies",
    detail: "Companies House + domain verified",
    badge: "bg-[#0F6E56]/10 text-[#0F6E56]",
    active: true,
  },
  {
    tier: 4,
    label: "Compliance ready",
    who: "Regulated industries",
    detail: "Coming soon",
    badge: "bg-[#f3f4f6] text-[#9ca3af]",
    active: false,
  },
];

function TiersSection() {
  return (
    <section className="bg-[#f9fafb] px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-12 text-center text-2xl font-bold text-[#111827] sm:text-3xl">
          Verification tiers
        </h2>

        <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-4 border-b border-[#e5e7eb] bg-[#f9fafb] px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
            <span>Tier</span>
            <span>Method</span>
            <span>Who</span>
            <span>What you get</span>
          </div>

          {TIERS.map((t, i) => (
            <div
              key={t.tier}
              className={`grid grid-cols-4 items-center px-6 py-4 text-sm ${
                i < TIERS.length - 1 ? "border-b border-[#f3f4f6]" : ""
              } ${!t.active ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${t.badge}`}
                >
                  {t.tier}
                </span>
              </div>
              <span className="font-medium text-[#111827]">{t.label}</span>
              <span className="text-[#6b7280]">{t.who}</span>
              <span className="text-[#6b7280]">
                {t.detail}
                {!t.active && (
                  <span className="ml-2 rounded-full border border-[#e5e7eb] px-2 py-0.5 text-xs text-[#9ca3af]">
                    Coming soon
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── proveyouragent ────────────────────────────────────────────────────────────

function ProveYourAgentSection() {
  return (
    <section className="bg-white px-6 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0F6E56]/20 bg-[#0F6E56]/5 px-3 py-1 text-xs font-medium text-[#0F6E56]">
          Layer 5 — Request signing
        </div>
        <h2 className="mb-4 text-2xl font-bold text-[#111827] sm:text-3xl">
          Built to work with proveyouragent
        </h2>
        <p className="mb-8 text-base leading-relaxed text-[#6b7280]">
          Agentis handles identity registration and verification. proveyouragent
          handles request-level signing with Ed25519 and DPoP. Together they
          give your agents cryptographic identity from registration to every
          single request.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="https://github.com/lujainkhalil/Agentis"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-[#e5e7eb] px-5 py-2.5 text-sm font-semibold text-[#374151] transition hover:border-[#111827] hover:text-[#111827]"
          >
            <GitHubIcon className="text-[#111827]" />
            View Agentis on GitHub
          </a>
          <a
            href="https://pypi.org/project/proveyouragent/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-[#0F6E56]/30 px-5 py-2.5 text-sm font-semibold text-[#0F6E56] transition hover:border-[#0F6E56] hover:bg-[#0F6E56]/5"
          >
            <PyPiIcon />
            View proveyouragent on PyPI
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Register section ──────────────────────────────────────────────────────────

function IndividualForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed. Please try again.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0F6E56]/10 text-2xl">
          ✓
        </div>
        <p className="font-semibold text-[#111827]">Check your email</p>
        <p className="text-sm text-[#6b7280]">
          We sent a verification link to{" "}
          <span className="font-medium text-[#111827]">{email}</span>. Click it
          to activate your API key.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <InputField
        label="Full name"
        id="ind-name"
        placeholder="Alice Smith"
        value={fullName}
        onChange={setFullName}
        required
      />
      <InputField
        label="Email address"
        id="ind-email"
        type="email"
        placeholder="alice@example.com"
        value={email}
        onChange={setEmail}
        required
      />
      {error && <InlineError message={error} />}
      <PrimaryButton type="submit" loading={loading} className="mt-1 w-full">
        Register as individual
      </PrimaryButton>
    </form>
  );
}

function CompanyForm() {
  const [companyName, setCompanyName] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CompanySuccess | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, companyName, companyNumber, domain }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed. Please try again.");
      } else {
        setSuccess(data);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-lg bg-[#0F6E56]/5 p-4">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0F6E56] text-xs text-white">
            ✓
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0F6E56]">
              Registered — two steps remaining
            </p>
            <p className="mt-1 text-xs text-[#374151]">
              Verify your email (check your inbox) and add the DNS record below
              to verify domain ownership.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
            Add this DNS TXT record
          </p>
          <div className="mb-2 flex flex-col gap-1">
            <span className="text-xs text-[#6b7280]">Host</span>
            <code className="break-all rounded border border-[#e5e7eb] bg-white px-3 py-2 font-[family-name:var(--font-geist-mono)] text-xs text-[#111827]">
              {success.txtRecord.host}
            </code>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#6b7280]">Value</span>
            <code className="break-all rounded border border-[#e5e7eb] bg-white px-3 py-2 font-[family-name:var(--font-geist-mono)] text-xs text-[#111827]">
              {success.txtRecord.value}
            </code>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-[#6b7280]">
          Once the record has propagated (up to 48 hours), call{" "}
          <code className="rounded bg-[#f3f4f6] px-1 py-0.5 font-[family-name:var(--font-geist-mono)] text-xs">
            POST /api/verify-domain
          </code>{" "}
          with your <code className="rounded bg-[#f3f4f6] px-1 py-0.5 font-[family-name:var(--font-geist-mono)] text-xs">developerId</code>:{" "}
          <code className="rounded bg-[#f3f4f6] px-1 py-0.5 font-[family-name:var(--font-geist-mono)] text-xs break-all">
            {success.developerId}
          </code>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <InputField
        label="Company name"
        id="co-name"
        placeholder="Acme Ltd"
        value={companyName}
        onChange={setCompanyName}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <InputField
          label="Companies House number"
          id="co-number"
          placeholder="12345678"
          value={companyNumber}
          onChange={setCompanyNumber}
          required
        />
        <InputField
          label="Domain"
          id="co-domain"
          placeholder="acme.com"
          value={domain}
          onChange={setDomain}
          required
        />
      </div>
      <InputField
        label="Email address"
        id="co-email"
        type="email"
        placeholder="you@acme.com"
        value={email}
        onChange={setEmail}
        required
      />
      {error && <InlineError message={error} />}
      <PrimaryButton type="submit" loading={loading} className="mt-1 w-full">
        Register organisation
      </PrimaryButton>
    </form>
  );
}

function RegisterSection() {
  return (
    <section id="register" className="bg-[#f9fafb] px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-2xl font-bold text-[#111827] sm:text-3xl">
            Register for the beta
          </h2>
          <p className="text-base text-[#6b7280]">
            Agentis is in early access. Register your organisation and start
            issuing agent identities today.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Individual */}
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
            <div className="mb-5">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  Tier 2
                </span>
                <span className="rounded-full bg-[#f3f4f6] px-2.5 py-0.5 text-xs font-medium text-[#6b7280]">
                  Individual
                </span>
              </div>
              <h3 className="text-base font-semibold text-[#111827]">
                Solo developer
              </h3>
              <p className="mt-1 text-sm text-[#6b7280]">
                For individual developers building agents. Verified via email.
              </p>
            </div>
            <IndividualForm />
          </div>

          {/* Organisation */}
          <div className="rounded-xl border border-[#0F6E56]/20 bg-white p-6 shadow-sm ring-1 ring-[#0F6E56]/10">
            <div className="mb-5">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="rounded-full bg-[#0F6E56]/10 px-2.5 py-0.5 text-xs font-semibold text-[#0F6E56]">
                  Tier 3
                </span>
                <span className="rounded-full bg-[#f3f4f6] px-2.5 py-0.5 text-xs font-medium text-[#6b7280]">
                  Organisation
                </span>
              </div>
              <h3 className="text-base font-semibold text-[#111827]">
                Registered company
              </h3>
              <p className="mt-1 text-sm text-[#6b7280]">
                For UK companies. Verified via Companies House and DNS domain
                ownership.
              </p>
            </div>
            <CompanyForm />
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-[#e5e7eb] bg-white px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold text-[#111827]">Agentis</p>
            <p className="text-sm text-[#6b7280]">
              Trust infrastructure for AI agents
            </p>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/lujainkhalil/Agentis"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-[#6b7280] transition hover:text-[#111827]"
            >
              <GitHubIcon />
              GitHub
            </a>
            <a
              href="https://pypi.org/project/proveyouragent/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-[#6b7280] transition hover:text-[#0F6E56]"
            >
              <PyPiIcon />
              proveyouragent
            </a>
          </div>
        </div>
        <div className="mt-8 border-t border-[#f3f4f6] pt-6 text-center">
          <p className="font-[family-name:var(--font-geist-mono)] text-xs text-[#9ca3af]">
            Built on Ed25519 · DPoP (RFC 9449) · W3C DIDs
          </p>
        </div>
      </div>
    </footer>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function GitHubIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function PyPiIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M11.914.002c-.963.007-1.886.088-2.693.23-2.384.422-2.816 1.304-2.816 2.932v2.15h5.632v.716H4.33c-1.636 0-3.067.983-3.516 2.853-.516 2.136-.539 3.469 0 5.7.4 1.661 1.356 2.853 2.992 2.853h1.933v-2.574c0-1.858 1.608-3.498 3.516-3.498h5.627c1.565 0 2.816-1.29 2.816-2.858V3.164c0-1.523-1.284-2.667-2.816-2.932-.967-.161-1.97-.237-2.968-.23zM9.04 1.83c.583 0 1.057.47 1.057 1.053a1.05 1.05 0 01-1.057 1.048A1.048 1.048 0 017.98 2.883c0-.584.476-1.053 1.059-1.053z" />
      <path d="M18.699 7.03v2.5c0 1.938-1.643 3.569-3.516 3.569h-5.627c-1.539 0-2.816 1.318-2.816 2.858v5.36c0 1.524 1.325 2.419 2.816 2.858 1.784.523 3.494.617 5.627 0 1.419-.41 2.816-1.236 2.816-2.858v-2.148h-5.622v-.717h8.443c1.637 0 2.247-1.143 2.816-2.854.587-1.762.562-3.457 0-5.7-.403-1.624-1.178-2.854-2.816-2.854h-2.121zm-3.163 12.74c.584 0 1.057.472 1.057 1.054a1.05 1.05 0 01-1.057 1.05 1.047 1.047 0 01-1.054-1.05c0-.582.471-1.054 1.054-1.054z" />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <div className="min-h-screen bg-white font-[family-name:var(--font-geist-sans)]">
      <Navbar />
      <Hero />
      <ProblemSection />
      <HowItWorksSection />
      <CodeSection />
      <TiersSection />
      <ProveYourAgentSection />
      <RegisterSection />
      <Footer />
    </div>
  );
}
