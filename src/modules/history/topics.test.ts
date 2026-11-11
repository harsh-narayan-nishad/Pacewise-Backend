import { test } from "node:test";
import assert from "node:assert/strict";
import { levelFor, mergeTopics, topicsMatchResult, editState, withLevel, EDIT_WINDOW_MS } from "./topics";

test("level bands: >=75 strong, >=50 medium, else weak", () => {
  assert.equal(levelFor(3, 4), "strong");
  assert.equal(levelFor(2, 4), "medium");
  assert.equal(levelFor(1, 4), "weak");
  assert.equal(levelFor(0, 0), "weak");
  assert.equal(withLevel({ topic: "Graphs", correct: 7, total: 10 }).accuracy, 70);
});

test("renaming topics merges ones that differ only by case or spacing", () => {
  const merged = mergeTopics([{ topic: " Graphs ", correct: 2, total: 3 }, { topic: "graphs", correct: 1, total: 2 }, { topic: "  ", correct: 1, total: 1 }]);
  assert.deepEqual(merged, [{ topic: "Graphs", correct: 3, total: 5 }]);
});

test("topic counts must add up to the test result", () => {
  const t = [{ topic: "A", correct: 2, total: 3 }, { topic: "B", correct: 1, total: 2 }];
  assert.equal(topicsMatchResult(t, 5, 3), true);
  assert.equal(topicsMatchResult(t, 5, 4), false); // cannot raise the score by editing topics
  assert.equal(topicsMatchResult(t, 6, 3), false);
  assert.equal(topicsMatchResult(t, undefined, undefined), true);
});

test("editing is open for exactly 2 days after the attempt", () => {
  const at = new Date("2026-11-01T10:00:00Z");
  assert.equal(editState(at, at.getTime() + EDIT_WINDOW_MS - 1).locked, false);
  assert.equal(editState(at, at.getTime() + EDIT_WINDOW_MS + 1).locked, true);
});
