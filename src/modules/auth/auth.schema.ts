import { z } from "zod";

/** One password rule for sign-up and password change: 8–72 chars (72 = bcrypt's limit), at least one letter and one digit. */
const password = z
  .string()
  .min(8, "At least 8 characters")
  .max(72, "At most 72 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const signupSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only"),
  password,
  name: z.string().trim().min(1).max(80),
  device: z.string().max(80).optional(),
});

export const loginSchema = z.object({
  // Accept either email or username in one field — a mobile client and a
  // web client may reasonably default to different conventions.
  identifier: z.string().min(1),
  password: z.string().min(1),
  device: z.string().max(80).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
});

export const availabilityQuerySchema = z
  .object({ username: z.string().min(1).max(24).optional(), email: z.string().email().optional() })
  .refine((v) => v.username || v.email, "Provide username or email");

export const emailBodySchema = z.object({ email: z.string().email() });
export const tokenBodySchema = z.object({ token: z.string().min(20).max(200) });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), newPassword: password });

const otp = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");
export const verifyOtpSchema = z.object({ email: z.string().email(), otp });
export const resetOtpSchema = z.object({ email: z.string().email(), otp, newPassword: password });

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ResetOtpInput = z.infer<typeof resetOtpSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

/** The ID token ("credential") Google returns to the browser after the person picks their account. */
export const googleSchema = z.object({ idToken: z.string().min(20).max(4096), device: z.string().max(80).optional() });
export type GoogleInput = z.infer<typeof googleSchema>;
