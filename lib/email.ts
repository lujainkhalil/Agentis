import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "noreply@agentis.dev";

// ── Verification email ────────────────────────────────────────────────────────

export async function sendVerificationEmail(params: {
  to: string;
  verificationUrl: string;
}): Promise<void> {
  const { to, verificationUrl } = params;

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Verify your Agentis email",
    html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
               background: #f9fafb; margin: 0; padding: 40px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0"
                 style="background: #fff; border-radius: 8px;
                        border: 1px solid #e5e7eb; padding: 48px 40px;">
            <tr>
              <td>
                <h1 style="margin: 0 0 8px; font-size: 24px; color: #111827;">
                  Agentis
                </h1>
                <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280;">
                  Cryptographic identity for AI agents
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 32px;" />

                <h2 style="margin: 0 0 12px; font-size: 18px; color: #111827;">
                  Verify your email address
                </h2>
                <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
                  You registered for Agentis — the platform where developers
                  issue cryptographic identities to AI agents so any counterparty
                  can verify who owns them and whether to trust them.
                </p>
                <p style="margin: 0 0 32px; font-size: 15px; color: #374151; line-height: 1.6;">
                  Click the button below to verify your email and activate your
                  API key. This link expires in 24 hours.
                </p>

                <a href="${verificationUrl}"
                   style="display: inline-block; background: #111827; color: #fff;
                          text-decoration: none; font-size: 15px; font-weight: 600;
                          padding: 12px 28px; border-radius: 6px;">
                  Verify email
                </a>

                <p style="margin: 32px 0 0; font-size: 13px; color: #9ca3af; line-height: 1.6;">
                  If the button doesn't work, copy and paste this link into your browser:<br/>
                  <a href="${verificationUrl}"
                     style="color: #6b7280; word-break: break-all;">
                    ${verificationUrl}
                  </a>
                </p>

                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 24px;" />
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                  If you didn't create an Agentis account, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    text: `Verify your Agentis email\n\nClick the link below to verify your email and activate your API key (expires in 24 hours):\n\n${verificationUrl}\n\nIf you didn't create an Agentis account, ignore this email.`,
  });
}

// ── Operator notification ─────────────────────────────────────────────────────

export async function sendOperatorNotification(params: {
  email: string;
  fullName?: string | null;
  companyName?: string | null;
  companyNumber?: string | null;
  verificationMethod: string;
  verificationTier: number;
  developerId: string;
  registeredAt: string;
}): Promise<void> {
  const operatorEmail = process.env.OPERATOR_EMAIL;
  if (!operatorEmail) return; // silently skip if not configured

  const {
    email,
    fullName,
    companyName,
    companyNumber,
    verificationMethod,
    verificationTier,
    developerId,
    registeredAt,
  } = params;

  const rows = [
    ["Email", email],
    ["Name", fullName ?? "—"],
    ["Company", companyName ?? "—"],
    ["Company number", companyNumber ?? "—"],
    ["Verification method", verificationMethod],
    ["Verification tier", `Tier ${verificationTier}`],
    ["Developer ID", developerId],
    ["Registered at", registeredAt],
  ]
    .map(
      ([k, v]) =>
        `<tr>
           <td style="padding:8px 12px;color:#6b7280;font-size:13px;white-space:nowrap">${k}</td>
           <td style="padding:8px 12px;color:#111827;font-size:13px">${v}</td>
         </tr>`
    )
    .join("");

  await resend.emails.send({
    from: FROM,
    to: operatorEmail,
    subject: `New Agentis registration: ${email}`,
    html: `
<!DOCTYPE html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
               background:#f9fafb;margin:0;padding:40px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:40px;">
          <tr><td>
            <h2 style="margin:0 0 24px;font-size:18px;color:#111827;">
              New registration — ${email}
            </h2>
            <table cellpadding="0" cellspacing="0" width="100%"
                   style="border:1px solid #e5e7eb;border-radius:6px;border-collapse:collapse;">
              ${rows}
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
    text: `New Agentis registration\n\nEmail: ${email}\nName: ${fullName ?? "—"}\nCompany: ${companyName ?? "—"}\nCompany number: ${companyNumber ?? "—"}\nVerification method: ${verificationMethod}\nTier: ${verificationTier}\nDeveloper ID: ${developerId}\nRegistered at: ${registeredAt}`,
  });
}
