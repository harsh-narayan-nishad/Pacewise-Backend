import nodemailer from "nodemailer";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { COLORS, FONT, MONO, button, esc, layout } from "@/utils/mailLayout";
import type { WeeklyReport } from "@/modules/weekly/weekly.compute";

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


/** Checks the SMTP login once at start-up and logs the result (never stops the server). */
export async function checkMailSetup(): Promise<boolean> {
  if (!transport) {
    logger.warn("E-mail: SMTP_HOST / SMTP_USER / SMTP_PASS are not set. E-mails (links and one-time codes) are PRINTED in this log instead of being sent.");
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

/** Apple-style one-time-code mail: the code leads the subject (it shows in the notification preview), one clear code block, a short security note. */
function codeMail(o: { name: string; title: string; lead: string; otp: string; minutes: number; link: string; linkLabel: string; linkNote: string; ignoreNote: string }): Omit<Mail, "to"> {
  const text = `${o.title}\n\nHi ${o.name},\n${o.lead}\n\n${o.otp}\n\nThis code expires in ${o.minutes} minutes. Do not share it with anyone: Pacewise will never ask you for it.\n\n${o.linkLabel}: ${o.link}\n(${o.linkNote})\n\n${o.ignoreNote}`;
  const body = `<h1 style="margin:0 0 12px;font-size:32px;line-height:38px;font-weight:300;letter-spacing:-0.03em;color:${COLORS.ink}">${esc(o.title)}</h1>
<p style="margin:0 0 28px;font-size:16px;line-height:24px;color:${COLORS.muted}">Hi ${esc(o.name)}, ${esc(o.lead)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="background:${COLORS.raised};border:1px solid ${COLORS.line};border-radius:24px;padding:28px 12px">
<div style="font-family:${MONO};font-size:40px;line-height:48px;font-weight:500;letter-spacing:12px;padding-left:12px;color:${COLORS.ink}">${esc(o.otp)}</div></td></tr></table>
<p style="margin:20px 0 0;font-size:14px;line-height:22px;color:${COLORS.muted}">This code expires in ${o.minutes} minutes. Do not share it with anyone. Pacewise will never ask you for it.</p>
<p style="margin:28px 0 0;font-size:14px;line-height:22px;color:${COLORS.muted}">Prefer a link? <a href="${esc(o.link)}" style="color:${COLORS.ink};text-decoration:underline">${esc(o.linkLabel)}</a> <span style="color:${COLORS.faint}">(${esc(o.linkNote)})</span></p>`;
  return { subject: `${o.otp} is your Pacewise verification code`, text, html: layout({ preheader: `${o.otp} is your Pacewise verification code. It expires in ${o.minutes} minutes.`, body, footer: esc(o.ignoreNote) }) };
}

export function verifyEmailMail(name: string, link: string, otp: string): Omit<Mail, "to"> {
  return codeMail({ name, title: "Verify your email", lead: "enter this code to confirm your email address and finish creating your account.", otp, minutes: 10, link, linkLabel: "Confirm email", linkNote: "valid for 24 hours", ignoreNote: "If you did not create a Pacewise account, you can safely ignore this email." });
}

export function resetPasswordMail(name: string, link: string, otp: string): Omit<Mail, "to"> {
  return codeMail({ name, title: "Reset your password", lead: "enter this code to choose a new password for your account.", otp, minutes: 10, link, linkLabel: "Reset password", linkNote: "valid for 1 hour", ignoreNote: "If you did not ask to reset your password, you can ignore this email. Your password has not changed." });
}

/** Sent once, right after a brand-new account is created. Says what happens next, depending on the server's switches. */
export function welcomeMail(name: string, next: "confirm-email" | "wait-approval" | "sign-in", appUrl: string): Omit<Mail, "to"> {
  const line = next === "confirm-email"
    ? "One more step: enter the confirmation code from our other e-mail to activate your account."
    : next === "wait-approval"
      ? "Your account is waiting for approval. We will e-mail you as soon as it is approved."
      : "Your account is ready. You can sign in now.";
  return {
    subject: "Welcome to Pacewise",
    text: `Hi ${name},\n\nWelcome to Pacewise! Read at the speed of thought.\n\n${line}\n\n${appUrl}`,
    html: `<p>Hi ${esc(name)},</p><p><strong>Welcome to Pacewise!</strong> Read at the speed of thought.</p><p>${esc(line)}</p><p><a href="${esc(appUrl)}">Open Pacewise</a></p>`,
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

// ---- Weekly progress report ------------------------------------------------------------------------------------

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const signed = (n: number | null, unit: string) => (n === null ? "" : `${n >= 0 ? "+" : "\u2212"}${Math.abs(n)}${unit} vs last week`);

function tile(label: string, value: string, note: string): string {
  return `<td width="50%" valign="top" style="padding:6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:${COLORS.raised};border:1px solid ${COLORS.line};border-radius:20px;padding:18px 20px">
<div style="font-size:12px;line-height:16px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.06em">${esc(label)}</div>
<div style="margin-top:6px;font-size:30px;line-height:36px;font-weight:300;letter-spacing:-0.03em;color:${COLORS.ink}">${value}</div>
<div style="margin-top:2px;font-size:12px;line-height:16px;color:${COLORS.faint}">${note ? esc(note) : "&nbsp;"}</div></td></tr></table></td>`;
}

function chips(list: { topic: string; accuracy: number }[], fg: string, bg: string): string {
  return list.slice(0, 6).map((t) => `<span style="display:inline-block;margin:0 6px 6px 0;padding:5px 12px;border-radius:999px;background:${bg};color:${fg};font-size:13px;line-height:18px;font-weight:500">${esc(t.topic)} &middot; ${t.accuracy}%</span>`).join("");
}

function topicRow(title: string, list: { topic: string; accuracy: number }[], fg: string, bg: string): string {
  if (!list.length) return "";
  return `<tr><td style="padding:10px 0 4px;font-size:13px;line-height:18px;font-weight:500;color:${COLORS.ink}">${title} <span style="color:${COLORS.faint};font-weight:400">${list.length}</span></td></tr><tr><td>${chips(list, fg, bg)}</td></tr>`;
}

/** Weekly report: headline, four tiles, a 7-day activity strip, strong / medium / weak topics, one focus line. */
export function weeklyReportMail(name: string, r: WeeklyReport, appUrl: string): Omit<Mail, "to"> {
  const range = `${fmtDay(r.range.from)} \u2013 ${fmtDay(r.range.to)}`;
  const top = Math.max(1, ...r.days.map((d) => d.minutes));
  const strip = r.days.map((d) => {
    const h = d.minutes > 0 ? Math.max(6, Math.round((d.minutes / top) * 56)) : 3;
    return `<td align="center" valign="bottom" style="padding:0 3px"><div style="height:${h}px;background:${d.active ? COLORS.ink : COLORS.line};border-radius:6px"></div><div style="margin-top:6px;font-size:11px;line-height:14px;color:${COLORS.faint}">${d.label}</div></td>`;
  }).join("");
  const anyTopics = r.topics.strong.length + r.topics.medium.length + r.topics.weak.length > 0;
  const topicsHtml = anyTopics
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${topicRow("Strong", r.topics.strong, COLORS.strong, COLORS.strongBg)}${topicRow("Medium", r.topics.medium, COLORS.medium, COLORS.mediumBg)}${topicRow("Needs work", r.topics.weak, COLORS.weak, COLORS.weakBg)}</table>`
    : `<p style="margin:0;font-size:14px;line-height:22px;color:${COLORS.muted}">Take a test with topic labels to see your strong and weak areas here.</p>`;

  const body = `<h1 style="margin:0 0 6px;font-size:32px;line-height:38px;font-weight:300;letter-spacing:-0.03em;color:${COLORS.ink}">Your week in review.</h1>
<p style="margin:0 0 6px;font-size:13px;line-height:18px;color:${COLORS.faint}">${range}</p>
<p style="margin:0 0 22px;font-size:16px;line-height:24px;color:${COLORS.muted}">Hi ${esc(name)}. ${esc(r.headline)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -6px 8px"><tr>
${tile("Reading time", `${r.minutes}<span style="font-size:15px;color:${COLORS.muted}"> min</span>`, `${r.sessions} session${r.sessions === 1 ? "" : "s"}`)}
${tile("Avg speed", r.avgWpm === null ? "&ndash;" : `${r.avgWpm}<span style="font-size:15px;color:${COLORS.muted}"> WPM</span>`, r.bestWpm === null ? "" : `Best ${r.bestWpm} WPM`)}
</tr><tr>
${tile("Tests", `${r.testsTaken}`, r.avgAccuracy === null ? "" : `${r.avgAccuracy}% accuracy ${r.accuracyDelta === null ? "" : "(" + signed(r.accuracyDelta, " pts") + ")"}`.trim())}
${tile("Consistency", `${r.activeDays}<span style="font-size:15px;color:${COLORS.muted}"> / 7 days</span>`, `${r.streak}-day streak`)}
</tr></table>
${r.wpmDelta === null ? "" : `<p style="margin:0 0 8px;font-size:12px;line-height:18px;color:${COLORS.faint}">Speed ${esc(signed(r.wpmDelta, " WPM"))}.</p>`}
<h2 style="margin:26px 0 10px;font-size:18px;line-height:24px;font-weight:500;letter-spacing:-0.01em;color:${COLORS.ink}">Daily activity</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${strip}</tr></table>
<h2 style="margin:30px 0 8px;font-size:18px;line-height:24px;font-weight:500;letter-spacing:-0.01em;color:${COLORS.ink}">Topics this week</h2>
${topicsHtml}
${r.focus ? `<p style="margin:18px 0 0;padding:14px 18px;background:${COLORS.raised};border:1px solid ${COLORS.line};border-radius:16px;font-size:14px;line-height:22px;color:${COLORS.ink}">${esc(r.focus)}</p>` : ""}
<div style="margin-top:30px">${button("Open Pacewise", appUrl)}</div>`;

  const lines = [
    `Your week in review (${range})`, "", `Hi ${name}. ${r.headline}`, "",
    `Reading time: ${r.minutes} min (${r.sessions} sessions)`,
    `Average speed: ${r.avgWpm ?? "-"} WPM${r.bestWpm === null ? "" : ` (best ${r.bestWpm})`}${r.wpmDelta === null ? "" : `, ${signed(r.wpmDelta, " WPM")}`}`,
    `Tests: ${r.testsTaken}${r.avgAccuracy === null ? "" : `, ${r.avgAccuracy}% accuracy`}`,
    `Consistency: ${r.activeDays}/7 days, ${r.streak}-day streak`, "",
    ...(r.topics.strong.length ? [`Strong: ${r.topics.strong.map((t) => `${t.topic} ${t.accuracy}%`).join(", ")}`] : []),
    ...(r.topics.medium.length ? [`Medium: ${r.topics.medium.map((t) => `${t.topic} ${t.accuracy}%`).join(", ")}`] : []),
    ...(r.topics.weak.length ? [`Needs work: ${r.topics.weak.map((t) => `${t.topic} ${t.accuracy}%`).join(", ")}`] : []),
    ...(r.focus ? ["", r.focus] : []), "", appUrl,
  ];
  return { subject: `Your Pacewise week: ${r.activeDays} of 7 days, ${r.minutes} min`, text: lines.join("\n"), html: layout({ preheader: r.headline, body, width: 600, footer: "You get this summary once a week. Pacewise &middot; Read at the speed of thought." }) };
}
