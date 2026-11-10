import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalEmail, checkAdminAction, presenceOf, ONLINE_MS, IDLE_MS } from "./identity";

test("canonicalEmail collapses gmail tricks so a banned inbox cannot sign up again", () => {
  assert.equal(canonicalEmail("John.Doe+spam@Gmail.com"), "johndoe@gmail.com");
  assert.equal(canonicalEmail("j.o.h.n.doe@googlemail.com"), "johndoe@gmail.com");
  assert.equal(canonicalEmail("a.b+x@company.com"), "a.b@company.com"); // dots kept outside Gmail
  assert.equal(canonicalEmail(" USER@Example.COM "), "user@example.com");
});

test("presence: online <=2 min, idle <=15 min, otherwise offline", () => {
  const now = Date.now();
  assert.equal(presenceOf(new Date(now - 30_000), now), "online");
  assert.equal(presenceOf(new Date(now - ONLINE_MS - 1000), now), "idle");
  assert.equal(presenceOf(new Date(now - IDLE_MS - 1000), now), "offline");
  assert.equal(presenceOf(null, now), "offline");
});

const admin = { id: "a1" };
const user = (over: object = {}) => ({ id: "u1", status: "active" as const, role: "user" as const, ...over });

test("approve / reject only apply to the right states", () => {
  assert.equal(checkAdminAction("approve", admin, user({ status: "pending" }), 1), null);
  assert.equal(checkAdminAction("approve", admin, user({ status: "rejected" }), 1), null);
  assert.ok(checkAdminAction("approve", admin, user(), 1));
  assert.equal(checkAdminAction("reject", admin, user({ status: "pending" }), 1), null);
  assert.ok(checkAdminAction("reject", admin, user({ status: "active" }), 1));
});

test("ban: not yourself, not another admin, not twice", () => {
  assert.equal(checkAdminAction("ban", admin, user(), 1), null);
  assert.ok(checkAdminAction("ban", admin, user({ id: "a1" }), 1));
  assert.ok(checkAdminAction("ban", admin, user({ role: "admin" }), 2));
  assert.ok(checkAdminAction("ban", admin, user({ status: "banned" }), 1));
  assert.equal(checkAdminAction("unban", admin, user({ status: "banned" }), 1), null);
  assert.ok(checkAdminAction("unban", admin, user(), 1));
});

test("admin rights: only active accounts, never remove your own, never the last admin", () => {
  assert.equal(checkAdminAction("make-admin", admin, user(), 1), null);
  assert.ok(checkAdminAction("make-admin", admin, user({ status: "pending" }), 1));
  assert.ok(checkAdminAction("make-admin", admin, user({ role: "admin" }), 2));
  assert.ok(checkAdminAction("remove-admin", admin, user({ id: "a1", role: "admin" }), 3));
  assert.ok(checkAdminAction("remove-admin", admin, user({ role: "admin" }), 1));
  assert.equal(checkAdminAction("remove-admin", admin, user({ role: "admin" }), 2), null);
});
