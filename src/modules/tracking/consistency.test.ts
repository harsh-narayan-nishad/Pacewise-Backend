import test from "node:test";
import assert from "node:assert/strict";
import { addDays, computeConsistency, dayDiff } from "./consistency";

const MIN = 60_000;
const rows = (days: string[], ms = 5 * MIN) => days.map((day) => ({ day, readMs: ms }));

test("date helpers cross month and leap boundaries", () => {
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(dayDiff("2026-12-31", "2027-01-01"), 1);
});

test("current streak counts back from today", () => {
  const c = computeConsistency(rows(["2026-11-03", "2026-11-04", "2026-11-05"]), "2026-11-05");
  assert.equal(c.currentStreak, 3);
  assert.equal(c.todayActive, true);
});

test("streak survives until the end of today (yesterday still counts)", () => {
  const c = computeConsistency(rows(["2026-11-03", "2026-11-04"]), "2026-11-05");
  assert.equal(c.currentStreak, 2);
  assert.equal(c.todayActive, false);
});

test("a missed day breaks the current streak but not the longest", () => {
  const c = computeConsistency(rows(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-11-05"]), "2026-11-05");
  assert.equal(c.currentStreak, 1);
  assert.equal(c.longestStreak, 4);
  assert.equal(c.activeDays, 5);
});

test("days under the minimum reading time do not count", () => {
  const c = computeConsistency([{ day: "2026-11-05", readMs: 10_000 }], "2026-11-05");
  assert.equal(c.currentStreak, 0);
  assert.equal(c.activeDays, 0);
  assert.equal(c.totalMs, 10_000);
});

test("duplicate rows for a day are summed", () => {
  const c = computeConsistency([{ day: "2026-11-05", readMs: 30_000 }, { day: "2026-11-05", readMs: 40_000 }], "2026-11-05");
  assert.equal(c.todayActive, true);
});

test("last 7 days window and 30-day count", () => {
  const c = computeConsistency(rows(["2026-11-01", "2026-11-05", "2026-09-01"]), "2026-11-05");
  assert.equal(c.last7Days.length, 7);
  assert.equal(c.last7Days[6].day, "2026-11-05");
  assert.equal(c.last30ActiveDays, 2);
});

test("empty history", () => {
  const c = computeConsistency([], "2026-11-05");
  assert.deepEqual([c.currentStreak, c.longestStreak, c.activeDays], [0, 0, 0]);
});
