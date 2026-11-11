/**
 * Sends the weekly progress e-mail to everyone who was active in the last 14 days.
 *   npm run report:weekly
 * Run it once a week from a scheduler (cron, a hosting "cron job", GitHub Actions), e.g. Sunday 18:00:
 *   0 18 * * 0  cd /path/to/speed-reader-backend && npm run report:weekly
 * Without SMTP_* in .env it only prints the e-mails.
 */
import "../src/config/env";
import mongoose from "mongoose";
import { connectDb } from "../src/config/db";
import { DailyActivity, ReadingSession, User } from "../src/models";
import { sendWeeklyReport } from "../src/modules/weekly/weekly.service";
import { dayKey, lastDays } from "../src/modules/weekly/weekly.compute";

async function main() {
  await connectDb();
  const days = lastDays(dayKey(new Date()), 14);
  const since = new Date(`${days[0]}T00:00:00Z`);
  const [a, b] = await Promise.all([
    ReadingSession.distinct("userId", { createdAt: { $gte: since } }),
    DailyActivity.distinct("userId", { day: { $in: days } }),
  ]);
  const ids = [...new Set([...a, ...b])];
  const users = await User.find({ _id: { $in: ids }, emailVerified: true, $or: [{ status: "active" }, { status: { $exists: false } }] }).select("_id email").lean();
  let sent = 0, failed = 0;
  for (const u of users) {
    try { await sendWeeklyReport(u._id); sent += 1; } catch (err) { failed += 1; console.error("Failed for", u.email, err); }
  }
  console.log(`Weekly reports: ${sent} sent, ${failed} failed, ${users.length} eligible.`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
