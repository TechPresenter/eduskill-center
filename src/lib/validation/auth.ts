import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or mobile number").max(190),
  password: z.string().min(1, "Enter your password").max(200),
  remember: z.coerce.boolean().optional(),
  next: z.string().max(500).optional(),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  mobile: z.string().trim().regex(/^(\+?91[\s-]?)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  email: z.union([z.literal(""), z.email("Enter a valid email address")]).optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  confirmPassword: z.string().optional(),
  acceptTerms: z.coerce.boolean().refine((v) => v, "You must accept the terms"),
}).refine((d) => d.confirmPassword === undefined || d.confirmPassword === d.password, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or mobile number").max(190),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(200),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(200),
});
