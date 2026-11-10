import test from "node:test";
import assert from "node:assert/strict";
import { authorize, canRead, ownerOf, audienceOf } from "./policy";

const ref = (collection: string, ownerId: string, audience: string[] = [], data: Record<string, unknown> = {}) => ({ collection, ownerId, audience, data });

test("a user can create their own reaction but not someone else's", () => {
  const mine = { op: "put" as const, collection: "reactions", id: "r1", data: { userId: "u1", contentId: "s1", type: "like" } };
  assert.equal(authorize("u1", mine, null).ok, true);
  assert.equal(authorize("u2", mine, null).ok, false);
});

test("only the owner may update or delete", () => {
  const ex = ref("comments", "u1");
  assert.equal(authorize("u1", { op: "delete", collection: "comments", id: "c1" }, ex).ok, true);
  assert.equal(authorize("u2", { op: "delete", collection: "comments", id: "c1" }, ex).ok, false);
  assert.equal(authorize("u2", { op: "put", collection: "comments", id: "c1", data: { userId: "u2", text: "hijack" } }, ex).ok, false);
});

test("a user cannot take over a record by claiming a different owner", () => {
  const ex = ref("comments", "u1");
  assert.equal(authorize("u1", { op: "put", collection: "comments", id: "c1", data: { userId: "u2" } }, ex).ok, false);
});

test("notification: sender creates, recipient may mark read but not redirect it", () => {
  const data = { senderId: "a", recipientId: "b", read: false };
  assert.equal(authorize("a", { op: "put", collection: "notifications", id: "n1", data }, null).ok, true);
  assert.equal(authorize("c", { op: "put", collection: "notifications", id: "n1", data }, null).ok, false);
  const ex = ref("notifications", "a", ["b"], data);
  assert.equal(authorize("b", { op: "put", collection: "notifications", id: "n1", data: { ...data, read: true } }, ex).ok, true);
  assert.equal(authorize("b", { op: "put", collection: "notifications", id: "n1", data: { ...data, senderId: "b" } }, ex).ok, false);
  assert.equal(authorize("b", { op: "delete", collection: "notifications", id: "n1" }, ex).ok, true);
  assert.equal(authorize("c", { op: "delete", collection: "notifications", id: "n1" }, ex).ok, false);
});

test("avatar id must be the caller's own id", () => {
  assert.equal(authorize("u1", { op: "put", collection: "avatars", id: "u1", data: { dataUrl: "x" } }, null).ok, true);
  assert.equal(authorize("u1", { op: "put", collection: "avatars", id: "u2", data: { dataUrl: "x" } }, null).ok, false);
});

test("unknown collections are rejected", () => {
  assert.equal(authorize("u1", { op: "put", collection: "users", id: "u1", data: { userId: "u1" } }, null).ok, false);
});

test("read visibility", () => {
  assert.equal(canRead(ref("notifications", "a", ["b"]), "b"), true);
  assert.equal(canRead(ref("notifications", "a", ["b"]), "c"), false);
  assert.equal(canRead(ref("saves", "a"), "c"), false);
  assert.equal(canRead(ref("saves", "a"), "a"), true);
  assert.equal(canRead(ref("playlists", "a", [], { isPublic: false }), "c"), false);
  assert.equal(canRead(ref("playlists", "a", [], { isPublic: true }), "c"), true);
  assert.equal(canRead(ref("shares", "a", ["b"]), "c"), false);
  assert.equal(canRead(ref("reactions", "a"), "c"), true);
});

test("owner/audience helpers", () => {
  assert.equal(ownerOf("shares", "x", { senderId: "a", receiverId: "b" }), "a");
  assert.deepEqual(audienceOf("shares", { senderId: "a", receiverId: "b" }), ["b"]);
  assert.equal(ownerOf("follows", "x", { followerId: "a", followingId: "b" }), "a");
});
