import { DailyActivity, ReadingSession, User } from "@/models";
import { env } from "@/config/env";
import { NotFoundError } from "@/utils/AppError";
import { sendMail, weeklyReportMail } from "@/utils/mailer";
import { buildWeeklyReport, dayKey, lastDays, type WeeklyReport } from "@/modules/weekly/weekly.compute";

/** The 7 days ending today (UTC), compared with the 7 days before. */
export async function weeklyReportFor(userId: string, endDay: string = dayKey(new Date())): Promise<WeeklyReport> {
  const days = lastDays(endDay, 14);
  const from = new Date(`${days[0]}T00:00:00Z`);
  const to = new Date(Date.parse(`${endDay}T00:00:00Z`) + 86_400_000);
  const [rows, activity] = await Promise.all([
    ReadingSession.find({ userId, createdAt: { $gte: from, $lt: to } }).lean(),
    DailyActivity.find({ userId, day: { $in: days } }).lean(),
  ]);
  const prevDays = new Set(days.slice(0, 7));
  const lite = rows.map((r) => ({ createdAt: r.createdAt as Date, wpm: r.wpm, minutes: r.minutes, accuracy: r.accuracy, totalQuestions: r.totalQuestions, correctAnswers: r.correctAnswers, topics: r.topics }));
  return buildWeeklyReport({
    endDay,
    sessions: lite.filter((s) => !prevDays.has(dayKey(s.createdAt))),
    prevSessions: lite.filter((s) => prevDays.has(dayKey(s.createdAt))),
    activity,
  });
}

export async function sendWeeklyReport(userId: string) {
  const user = await User.findById(userId).select("email name").lean();
  if (!user) throw new NotFoundError("User not found");
  const report = await weeklyReportFor(userId);
  await sendMail({ to: user.email, ...weeklyReportMail(user.name, report, env.APP_URL) });
  return { sent: true, to: user.email, range: report.range };
}
