/**
 * Checks your e-mail settings: sends one test message.
 *   npm run mail:test -- you@gmail.com
 * Uses the SMTP_* values from .env. Exits with an error if SMTP is missing or fails verification.
 */
import "../src/config/env";
import { sendMail, checkMailSetup } from "../src/utils/mailer";

async function main() {
  const to = process.argv[2];
  if (!to) throw new Error("Usage: npm run mail:test -- you@example.com");
  if (!(await checkMailSetup())) {
    throw new Error("SMTP is not ready; no test email was sent. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, then restart the backend.");
  }
  await sendMail({ to, subject: "Pacewise test e-mail", text: "If you can read this, your SMTP settings work.", html: "<p>If you can read this, your SMTP settings work.</p>" });
  console.log("Done. Check the inbox (and spam) of", to);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
