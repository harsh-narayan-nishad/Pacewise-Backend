import nodemailer from "nodemailer";
import { env } from "@/config/env";
import { logger } from "@/config/logger";

const transport = env.smtpEnabled
  ? nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS?.replace(/\s+/g, "") } })
  : null;

export interface Mail { to: string; subject: string; text: string; html: string }

/** Sends through SMTP, or (no SMTP_* set) prints the e-mail in the log so development works without a mail account. */
export async function sendMail(mail: Mail): Promise<void> {
  if (!transport) {
    logger.warn({ to: mail.to, subject: mail.subject }, `SMTP is not configured — e-mail NOT sent. Body:\n${mail.text}`);
    return;
  }
  await transport.sendMail({ from: env.MAIL_FROM, ...mail });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/** Checks the SMTP login once at start-up and logs the result (never stops the server). */
export async function checkMailSetup(): Promise<boolean> {
  if (!transport) {
    logger.warn("E-mail: SMTP_HOST, SMTP_USER, and SMTP_PASS must all be set. E-mails (links and one-time codes) are PRINTED in this log instead of being sent.");
    return false;
  }
  try {
    await transport.verify();
    logger.info({ host: env.SMTP_HOST, user: env.SMTP_USER }, "E-mail: SMTP login OK");
    return true;
  } catch (err) {
    logger.error({ err }, "E-mail: SMTP login FAILED. Check SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS (Gmail needs an App password).");
    return false;
  }
}

// export function verifyEmailMail(name: string, link: string, otp: string): Omit<Mail, "to"> {
//   return {
//     subject: `Your confirmation code is ${otp}`,
//     text: `Hi ${name},\n\nYour confirmation code: ${otp}\n(valid 10 minutes)\n\nOr confirm with this link:\n${link}\n\nThe link works for 24 hours. If you did not sign up, ignore this message.`,
//     html: `<p>Hi ${esc(name)},</p><p>Your confirmation code:</p><p style="font-size:28px;letter-spacing:6px;font-weight:600">${esc(otp)}</p><p>It is valid for 10 minutes.</p><p>Or confirm with this link: <a href="${esc(link)}">Confirm email</a> (works for 24 hours).</p><p>If you did not sign up, ignore this message.</p>`,
//   };
// }

export function verifyEmailMail(name: string, link: string, otp: string): Omit<Mail, "to"> {
  return {
    subject: `Your confirmation code is ${otp}`,
    text: `Hi ${name},\n\nYour confirmation code: ${otp}\n(valid 10 minutes)\n\nOr confirm with this link:\n${link}\n\nThe link works for 24 hours. If you did not sign up, ignore this message.\n\nRegards,\nTeam Pacewise`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Pacewise</title>
<style>
  @media (max-width: 600px) {
    .container { width: 100% !important; }
    .card { padding: 32px 24px !important; }
    .otp { font-size: 32px !important; letter-spacing: 8px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .bg { background-color: #000000 !important; }
    .card { background-color: #1c1c1e !important; }
    .title, .strong, .otp { color: #f5f5f7 !important; }
    .body { color: #d1d1d6 !important; }
    .muted { color: #98989d !important; }
    .otp-box { background-color: #2c2c2e !important; }
    .divider { border-top-color: #3a3a3c !important; }
  }
</style>
</head>
<body class="bg" style="margin:0;padding:0;background-color:#f5f5f7;-webkit-text-size-adjust:100%;">

  <!-- Preheader (inbox preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Your confirmation code is ${esc(otp)}. It is valid for 10 minutes.
  </div>

  <table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f7;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:0 0 24px 0;font-family:'Century Gothic',CenturyGothic,'Apple Gothic','Avenir Next',Avenir,'URW Gothic',Futura,'Trebuchet MS',sans-serif;font-size:26px;line-height:32px;font-weight:400;letter-spacing:0;text-transform:none;">
              <span class="title" style="color:#1d1d1f;font-weight:400;text-transform:none;">pacewise</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td class="card" align="left" style="background-color:#ffffff;border-radius:18px;padding:44px 44px 40px 44px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;text-align:left;">

              <!-- Title -->
              <h1 class="title" style="margin:0 0 28px 0;font-size:28px;line-height:34px;font-weight:600;letter-spacing:-0.4px;color:#1d1d1f;">
                Confirm your email
              </h1>

              <!-- Greeting -->
              <p class="strong" style="margin:0 0 12px 0;font-size:16px;line-height:24px;color:#1d1d1f;">
                Hi ${esc(name)},
              </p>
              <p class="body" style="margin:0 0 24px 0;font-size:16px;line-height:24px;color:#424245;">
                Your confirmation code:
              </p>

              <!-- Code -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="otp-box" align="center" style="background-color:#f5f5f7;border-radius:14px;padding:24px 16px;">
                    <span class="otp" style="font-family:'Century Gothic',CenturyGothic,'Apple Gothic','Avenir Next',Avenir,'URW Gothic',Futura,'Trebuchet MS',sans-serif;font-size:38px;line-height:44px;font-weight:400;letter-spacing:12px;color:#1d1d1f;">${esc(otp)}</span>
                  </td>
                </tr>
              </table>
              <p class="muted" style="margin:12px 0 0 0;font-size:14px;line-height:20px;color:#6e6e73;">
                It is valid for 10 minutes.
              </p>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0;">
                <tr><td class="divider" style="border-top:1px solid #e5e5ea;font-size:0;line-height:0;height:1px;">&nbsp;</td></tr>
              </table>

              <!-- Link alternative -->
              <p class="body" style="margin:0 0 20px 0;font-size:16px;line-height:24px;color:#424245;">
                Or confirm with this link:
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#0071e3" style="background-color:#0071e3;border-radius:12px;">
                    <a href="${esc(link)}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:22px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">Confirm email</a>
                  </td>
                </tr>
              </table>
              <p class="muted" style="margin:12px 0 0 0;font-size:14px;line-height:20px;color:#6e6e73;">
                The link works for 24 hours.
              </p>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0;">
                <tr><td class="divider" style="border-top:1px solid #e5e5ea;font-size:0;line-height:0;height:1px;">&nbsp;</td></tr>
              </table>

              <!-- Safety note -->
              <p class="body" style="margin:0 0 28px 0;font-size:16px;line-height:24px;color:#424245;">
                If you did not sign up, ignore this message.
              </p>

              <!-- Sign-off -->
              <p class="body" style="margin:0;font-size:16px;line-height:24px;color:#424245;">
                Regards,<br>
                <span class="strong" style="font-weight:600;color:#1d1d1f;">Team Pacewise</span>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 16px 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
              <p class="muted" style="margin:0 0 6px 0;font-size:12px;line-height:18px;color:#6e6e73;text-align:center;">
                You received this email because this address was used to sign up for a Pacewise account.
              </p>
              <p class="muted" style="margin:0;font-size:12px;line-height:18px;color:#86868b;text-align:center;">
                This is an automated message, please do not reply.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

// export function resetPasswordMail(name: string, link: string, otp: string): Omit<Mail, "to"> {
//   return {
//     subject: `Your password reset code is ${otp}`,
//     text: `Hi ${name},\n\nSomeone asked to reset your password. Your code: ${otp}\n(valid 10 minutes)\n\nOr choose a new password with this link:\n${link}\n\nThe link works for 1 hour. If this was not you, ignore this message; your password stays the same.`,
//     html: `<p>Hi ${esc(name)},</p><p>Someone asked to reset your password. Your code:</p><p style="font-size:28px;letter-spacing:6px;font-weight:600">${esc(otp)}</p><p>It is valid for 10 minutes.</p><p>Or choose a new password with this link: <a href="${esc(link)}">Reset password</a> (works for 1 hour).</p><p>If this was not you, ignore this message; your password stays the same.</p>`,
//   };
// }

export function resetPasswordMail(name: string, link: string, otp: string): Omit<Mail, "to"> {
  return {
    subject: `Your Password Reset Code`,
    text: `Hi ${name},\n\nSomeone asked to reset your password. Your code: ${otp}\n(valid 10 minutes)\n\nOr choose a new password with this link:\n${link}\n\nThe link works for 1 hour. If this was not you, ignore this message; your password stays the same.\n\nRegards,\nTeam Pacewise`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Pacewise</title>
<style>
  @media (max-width: 600px) {
    .container { width: 100% !important; }
    .card { padding: 32px 24px !important; }
    .otp { font-size: 32px !important; letter-spacing: 8px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .bg { background-color: #000000 !important; }
    .card { background-color: #1c1c1e !important; }
    .title, .strong, .otp { color: #f5f5f7 !important; }
    .body { color: #d1d1d6 !important; }
    .muted { color: #98989d !important; }
    .otp-box { background-color: #2c2c2e !important; }
    .divider { border-top-color: #3a3a3c !important; }
  }
</style>
</head>
<body class="bg" style="margin:0;padding:0;background-color:#f5f5f7;-webkit-text-size-adjust:100%;">

  <!-- Preheader (inbox preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Your code is ${esc(otp)}. It is valid for 10 minutes.
  </div>

  <table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f7;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:0 0 24px 0;font-family:'Century Gothic',CenturyGothic,'Apple Gothic','Avenir Next',Avenir,'URW Gothic',Futura,'Trebuchet MS',sans-serif;font-size:26px;line-height:32px;font-weight:400;letter-spacing:0;text-transform:none;">
              <span class="title" style="color:#1d1d1f;font-weight:400;text-transform:none;">pacewise</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td class="card" align="left" style="background-color:#ffffff;border-radius:18px;padding:44px 44px 40px 44px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;text-align:left;">

              <!-- Title -->
              <h1 class="title" style="margin:0 0 28px 0;font-size:28px;line-height:34px;font-weight:600;letter-spacing:-0.4px;color:#1d1d1f;">
                Reset your password
              </h1>

              <!-- Greeting -->
              <p class="strong" style="margin:0 0 12px 0;font-size:16px;line-height:24px;color:#1d1d1f;">
                Hi ${esc(name)},
              </p>
              <p class="body" style="margin:0 0 24px 0;font-size:16px;line-height:24px;color:#424245;">
               A password reset was requested for your account. Your code is:
              </p>

              <!-- Code -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="otp-box" align="center" style="background-color:#f5f5f7;border-radius:14px;padding:24px 16px;">
                    <span class="otp" style="font-family:'Century Gothic',CenturyGothic,'Apple Gothic','Avenir Next',Avenir,'URW Gothic',Futura,'Trebuchet MS',sans-serif;font-size:38px;line-height:44px;font-weight:400;letter-spacing:12px;color:#1d1d1f;">${esc(otp)}</span>                  </td>
                </tr>
              </table>
              <p class="muted" style="margin:12px 0 0 0;font-size:14px;line-height:20px;color:#6e6e73;">
                It is valid for 10 minutes.
              </p>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0;">
                <tr><td class="divider" style="border-top:1px solid #e5e5ea;font-size:0;line-height:0;height:1px;">&nbsp;</td></tr>
              </table>

              <!-- Link alternative -->
              <p class="body" style="margin:0 0 20px 0;font-size:16px;line-height:24px;color:#424245;">
                Or choose a new password with this link:
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#0071e3" style="background-color:#0071e3;border-radius:12px;">
                    <a href="${esc(link)}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:22px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">Reset password</a>
                  </td>
                </tr>
              </table>
              <p class="muted" style="margin:12px 0 0 0;font-size:14px;line-height:20px;color:#6e6e73;">
                The link works for 1 hour.
              </p>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0;">
                <tr><td class="divider" style="border-top:1px solid #e5e5ea;font-size:0;line-height:0;height:1px;">&nbsp;</td></tr>
              </table>

              <!-- Safety note -->
              <p class="body" style="margin:0 0 28px 0;font-size:16px;line-height:24px;color:#424245;">
                If this was not you, ignore this message; your password stays the same.
              </p>

              <!-- Sign-off -->
              <p class="body" style="margin:0;font-size:16px;line-height:24px;color:#424245;">
                Regards,<br>
                <span class="strong" style="font-weight:600;color:#1d1d1f;">Team Pacewise</span>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 16px 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
              <p class="muted" style="margin:0 0 6px 0;font-size:12px;line-height:18px;color:#6e6e73;text-align:center;">
                You received this email because a password reset was requested for your Pacewise account.
              </p>
              <p class="muted" style="margin:0;font-size:12px;line-height:18px;color:#86868b;text-align:center;">
                This is an automated message, please do not reply.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}
export function accountApprovedMail(name: string, signInUrl: string): Omit<Mail, "to"> {
  return {
    subject: "Your Pacewise account is approved",
    text: `Hi ${name},\n\nGood news: your account has been approved. You can sign in now:\n${signInUrl}`,
    html: `<p>Hi ${esc(name)},</p><p>Good news: your account has been approved.</p><p><a href="${esc(signInUrl)}">Sign in to Pacewise</a></p>`,
  };
}

export function accountDeclinedMail(name: string): Omit<Mail, "to"> {
  return {
    subject: "About your Pacewise account request",
    text: `Hi ${name},\n\nWe could not approve your account request at this time.`,
    html: `<p>Hi ${esc(name)},</p><p>We could not approve your account request at this time.</p>`,
  };
}
