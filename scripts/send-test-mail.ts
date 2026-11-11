/**
 * Checks your e-mail settings: sends one test message.
 *   npm run mail:test -- you@gmail.com
 * Uses the SMTP_* values from .env. Without them it only prints the message.
 */
import "../src/config/env";
import { sendMail, checkMailSetup } from "../src/utils/mailer";

async function main() {
  const to = process.argv[2];
  if (!to) throw new Error("Usage: npm run mail:test -- you@example.com");
  if (!(await checkMailSetup())) throw new Error("SMTP is not configured or the login failed. Fill SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in .env (see docs/SETUP_CREDENTIALS.md).");
  await sendMail({ to, subject: "Pacewise test e-mail", text: "If you can read this, your SMTP settings work.", html: "<p>If you can read this, your SMTP settings work.</p>" });
  console.log("Done. Check the inbox (and spam) of", to);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
