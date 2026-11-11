import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWeeklyReport, lastDays } from "./weekly.compute";

const at = (day: string) => new Date(`${day}T10:00:00Z`);

test("lastDays returns 7 days ending on the given day", () => {
  assert.deepEqual(lastDays("2026-11-09", 3), ["2026-11-07", "2026-11-08", "2026-11-09"]);
  assert.equal(lastDays("2026-11-09", 7)[0], "2026-11-03");
});

test("weekly numbers: active days, streak, deltas and topic levels", () => {
  const r = buildWeeklyReport({
    endDay: "2026-11-09",
    sessions: [
      { createdAt: at("2026-11-08"), wpm: 300, minutes: 10, accuracy: 80, totalQuestions: 5, correctAnswers: 4, topics: [{ topic: "Graphs", correct: 3, total: 3 }, { topic: "DP", correct: 1, total: 2 }] },
      { createdAt: at("2026-11-09"), wpm: 340, minutes: 12, accuracy: 60, totalQuestions: 5, correctAnswers: 3, topics: [{ topic: "graphs", correct: 1, total: 2 }, { topic: "DP", correct: 0, total: 3 }] },
      { createdAt: at("2026-10-01"), wpm: 999, minutes: 99 }, // outside the week: ignored
    ],
    prevSessions: [{ createdAt: at("2026-11-02"), wpm: 280, minutes: 5, accuracy: 50, totalQuestions: 4, correctAnswers: 2 }],
    activity: [],
  });
  assert.equal(r.days.length, 7);
  assert.deepEqual(r.days.slice(-2).map((d) => [d.label, d.minutes, d.active]), [["Sun", 10, true], ["Mon", 12, true]]);
  assert.equal(r.activeDays, 2);
  assert.equal(r.streak, 2);
  assert.equal(r.minutes, 22);
  assert.equal(r.avgWpm, 320);
  assert.equal(r.bestWpm, 340);
  assert.equal(r.wpmDelta, 40);
  assert.equal(r.avgAccuracy, 70);
  assert.equal(r.accuracyDelta, 20);
  assert.equal(r.testsTaken, 2);
  assert.equal(r.consistencyPercent, 29);
  assert.deepEqual(r.topics.strong.map((t) => [t.topic, t.accuracy]), [["Graphs", 80]]); // 4 of 5
  assert.deepEqual(r.topics.weak.map((t) => [t.topic, t.accuracy]), [["DP", 20]]); // 1 of 5
  assert.match(r.focus ?? "", /DP/);
});

test("an empty week still produces a valid report", () => {
  const r = buildWeeklyReport({ endDay: "2026-11-09", sessions: [], prevSessions: [], activity: [] });
  assert.equal(r.activeDays, 0);
  assert.equal(r.streak, 0);
  assert.equal(r.avgWpm, null);
  assert.equal(r.focus, null);
});
