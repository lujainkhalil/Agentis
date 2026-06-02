import { NextRequest, NextResponse } from "next/server";

const CH_BASE = "https://api.company-information.service.gov.uk";
const TIMEOUT_MS = 8000;

export async function POST(req: NextRequest) {
  let body: { companyNumber?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { companyNumber } = body;
  if (!companyNumber || typeof companyNumber !== "string") {
    return NextResponse.json(
      { error: "companyNumber is required" },
      { status: 400 }
    );
  }

  const normalised = companyNumber.trim().toUpperCase();
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Companies House API key not configured" },
      { status: 500 }
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const chRes = await fetch(
      `${CH_BASE}/company/${encodeURIComponent(normalised)}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timer);

    if (chRes.status === 404) {
      return NextResponse.json(
        { error: "Company not found", companyNumber: normalised },
        { status: 404 }
      );
    }

    if (!chRes.ok) {
      return NextResponse.json(
        { error: "Companies House returned an error", status: chRes.status },
        { status: 502 }
      );
    }

    const data = await chRes.json();

    return NextResponse.json({
      companyNumber: data.company_number,
      companyName: data.company_name,
      status: data.company_status,          // "active" | "dissolved" | etc.
      type: data.type,
      registeredAddress: data.registered_office_address ?? null,
      jurisdiction: data.jurisdiction ?? null,
      incorporatedOn: data.date_of_creation ?? null,
    });
  } catch (err: unknown) {
    clearTimeout(timer);

    if (err instanceof Error && err.name === "AbortError") {
      // Graceful timeout — caller should treat this as pending
      return NextResponse.json(
        {
          pending: true,
          error:
            "Companies House API timed out. Verification is pending manual review.",
        },
        { status: 202 }
      );
    }

    console.error("[verify-company]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
