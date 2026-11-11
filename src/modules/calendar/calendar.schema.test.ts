import { test } from "node:test";
import assert from "node:assert/strict";
import { createEventSchema, updateEventSchema } from "./calendar.schema";

test("a valid event gets defaults and real dates", () => {
  const r = createEventSchema.parse({ title: "  Revise OS  ", start: "2026-11-12T09:00:00Z", end: "2026-11-12T10:00:00Z" });
  assert.equal(r.title, "Revise OS");
  assert.equal(r.allDay, false);
  assert.equal(r.variant, "primary");
  assert.ok(r.start instanceof Date);
});

test("an event cannot end before it starts, or have an empty title", () => {
  assert.equal(createEventSchema.safeParse({ title: "x", start: "2026-11-12T10:00:00Z", end: "2026-11-12T09:00:00Z" }).success, false);
  assert.equal(createEventSchema.safeParse({ title: "  ", start: "2026-11-12T09:00:00Z", end: "2026-11-12T10:00:00Z" }).success, false);
  assert.equal(createEventSchema.safeParse({ title: "x", variant: "red", start: "2026-11-12T09:00:00Z", end: "2026-11-12T10:00:00Z" }).success, false);
});

test("an update needs at least one field and keeps the order rule", () => {
  assert.equal(updateEventSchema.safeParse({}).success, false);
  assert.equal(updateEventSchema.safeParse({ title: "New" }).success, true);
  assert.equal(updateEventSchema.safeParse({ start: "2026-11-12T10:00:00Z", end: "2026-11-12T09:00:00Z" }).success, false);
});
