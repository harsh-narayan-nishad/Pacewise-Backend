import { Router } from "express";
import * as authController from "@/modules/auth/auth.controller";
import { validate } from "@/middleware/validate";
import { availabilityQuerySchema, changePasswordSchema, emailBodySchema, googleSchema, loginSchema, refreshSchema, resetOtpSchema, resetPasswordSchema, signupSchema, tokenBodySchema, verifyOtpSchema } from "@/modules/auth/auth.schema";
import { rateLimit } from "@/middleware/rateLimit";

export const authRouter = Router();

// Tighter rate limit specifically on credential-guessing routes —
// shared across every instance via Redis (see middleware/rateLimit.ts),
// so a distributed deployment doesn't accidentally multiply the
// effective limit by the number of replicas.
const authRateLimit = rateLimit({ windowSeconds: 60, max: 20, keyPrefix: "auth" });

authRouter.post("/signup", authRateLimit, validate({ body: signupSchema }), authController.signup);
// Per-ACCOUNT limit as well: 10 wrong guesses in 15 minutes for one email/username, whatever IP they come from.
const loginGuess = rateLimit({ windowSeconds: 15 * 60, max: 10, keyPrefix: "login-id", key: (req) => String(req.body?.identifier ?? "").toLowerCase().trim() || "none" });

authRouter.post("/login", authRateLimit, loginGuess, validate({ body: loginSchema }), authController.login);
authRouter.post("/google", authRateLimit, validate({ body: googleSchema }), authController.google);
authRouter.post("/refresh", authRateLimit, validate({ body: refreshSchema }), authController.refresh);
authRouter.post("/logout", validate({ body: refreshSchema }), authController.logout);
authRouter.post("/logout-all", ...authController.logoutAll);
authRouter.get("/me", ...authController.me);
authRouter.post("/change-password", authRateLimit, validate({ body: changePasswordSchema }), ...authController.changePassword);
authRouter.get("/availability", authRateLimit, validate({ query: availabilityQuerySchema }), authController.availability);

// E-mail flows: 5 requests per hour per e-mail address (and the general per-IP limit above), so nobody can use them to spam an inbox.
const mailLimit = rateLimit({ windowSeconds: 60 * 60, max: 5, keyPrefix: "mail", key: (req) => String(req.body?.email ?? "").toLowerCase().trim() || req.ip || "none" });
authRouter.post("/verify-email", authRateLimit, validate({ body: tokenBodySchema }), authController.verifyEmail);
authRouter.post("/resend-verification", authRateLimit, mailLimit, validate({ body: emailBodySchema }), authController.resendVerification);
authRouter.post("/forgot-password", authRateLimit, mailLimit, validate({ body: emailBodySchema }), authController.forgotPassword);
authRouter.post("/reset-password", authRateLimit, validate({ body: resetPasswordSchema }), authController.resetPassword);

// One-time codes: 10 tries per 15 minutes per address on top of the 5-wrong-guesses-per-code rule, so the 6 digits cannot be brute-forced.
const otpGuess = rateLimit({ windowSeconds: 15 * 60, max: 10, keyPrefix: "otp", key: (req) => String(req.body?.email ?? "").toLowerCase().trim() || req.ip || "none" });
authRouter.post("/verify-email-otp", authRateLimit, otpGuess, validate({ body: verifyOtpSchema }), authController.verifyEmailOtp);
authRouter.post("/reset-password-otp", authRateLimit, otpGuess, validate({ body: resetOtpSchema }), authController.resetPasswordOtp);
