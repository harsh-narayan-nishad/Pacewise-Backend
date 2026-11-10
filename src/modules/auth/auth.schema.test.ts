import test from "node:test";
import assert from "node:assert/strict";
import { signupSchema, changePasswordSchema } from "./auth.schema";

const base = { email: "a@b.co", username: "alice_1", name: "Alice" };

test("password rule: 8-72 chars with a letter and a number", () => {
  assert.equal(signupSchema.safeParse({ ...base, password: "abc12345" }).success, true);
  assert.equal(signupSchema.safeParse({ ...base, password: "short1" }).success, false);
  assert.equal(signupSchema.safeParse({ ...base, password: "onlyletters" }).success, false);
  assert.equal(signupSchema.safeParse({ ...base, password: "12345678" }).success, false);
  assert.equal(signupSchema.safeParse({ ...base, password: "a1".repeat(40) }).success, false);
});

test("username and email rules", () => {
  assert.equal(signupSchema.safeParse({ ...base, username: "ab", password: "abc12345" }).success, false);
  assert.equal(signupSchema.safeParse({ ...base, username: "bad name!", password: "abc12345" }).success, false);
  assert.equal(signupSchema.safeParse({ ...base, email: "nope", password: "abc12345" }).success, false);
});

test("change-password applies the same rule to the new password", () => {
  assert.equal(changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "weak" }).success, false);
  assert.equal(changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "better123" }).success, true);
});

import { verifyOtpSchema, resetOtpSchema } from "./auth.schema";

test("one-time codes are exactly 6 digits", () => {
  assert.equal(verifyOtpSchema.safeParse({ email: "a@b.co", otp: "123456" }).success, true);
  assert.equal(verifyOtpSchema.safeParse({ email: "a@b.co", otp: "12345" }).success, false);
  assert.equal(verifyOtpSchema.safeParse({ email: "a@b.co", otp: "12345a" }).success, false);
  assert.equal(resetOtpSchema.safeParse({ email: "a@b.co", otp: "123456", newPassword: "weak" }).success, false);
  assert.equal(resetOtpSchema.safeParse({ email: "a@b.co", otp: "123456", newPassword: "better123" }).success, true);
});
