import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { ApiError, Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { createSession } from "@/lib/auth/session";
import { getPhoneChannels, notify } from "@/lib/notifications";
import { enforceRateLimit } from "@/lib/rate-limit";
import { normalizeMobile, type RequestMeta } from "@/server/auth";

/**
 * Student sign-in by ADMISSION NUMBER + MOBILE NUMBER, proven with a one-time code.
 *
 * Both identifiers are guessable or widely known (admission numbers are sequential; a student's
 * mobile is known to family, friends and their centre), so on their own they must never open an
 * account that holds Aadhaar, marksheets, payments and certificates. Possession of the phone is the
 * secret: a 6-digit code is texted to it and only that code signs the student in.
 *
 *   - Only a keyed HMAC of the code is stored, never the code itself (and the notification log
 *     stores a redacted copy of the message).
 *   - A code lives 5 minutes, locks after 5 wrong tries, and can be consumed exactly once.
 *   - Requesting a code always gets the same neutral answer, match or not, so the endpoint cannot
 *     be used to discover which admission numbers exist or whose mobile is whose.
 */

export const OTP_TTL_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 5;
/** The UI shows a countdown of this length before "Resend" is enabled. */
export const OTP_RESEND_AFTER_SEC = 30;
/** Server-side floor between two codes for one user (a few seconds of slack under the UI countdown). */
const OTP_MIN_GAP_MS = (OTP_RESEND_AFTER_SEC - 5) * 1000;

/** Per mobile number: at most this many code requests an hour — stops SMS bombing a student. */
const REQUESTS_PER_MOBILE_PER_HOUR = 5;
/** Per admission number, for the case where someone cycles mobile numbers against one admission. */
const REQUESTS_PER_ADMISSION_PER_HOUR = 5;

export const OTP_NEUTRAL_MESSAGE = "If these details match an admission, we have sent a code to that mobile number.";
const BAD_CODE_MESSAGE = "That code is not correct. Please check the SMS and try again.";
const NO_CODE_MESSAGE = "This code has expired or was not requested. Please request a new code.";
const LOCKED_MESSAGE = "Too many wrong attempts. Please request a new code.";

export interface OtpRequestResult {
  message: string;
  expiresInSec: number;
  resendAfterSec: number;
}

function otpSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 8) throw Errors.internal("Sign-in with a code is not available right now.");
  return s;
}

/** Keyed hash, bound to the user so a stored hash is useless for any other account. */
export function hashLoginOtp(userId: string, code: string) {
  return createHmac("sha256", otpSecret()).update(`login-otp:${userId}:${code}`).digest("hex");
}

function sameHash(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function maskMobile(mobile: string) {
  return `******${mobile.slice(-4)}`;
}

/**
 * The admitted student behind this admission number, but only when the mobile matches the student's
 * own mobile or their account's mobile and the account can sign in. Anything else is `null` — the
 * callers deliberately do not distinguish "no such admission" from "wrong mobile".
 */
async function findAdmittedStudent(admissionNoRaw: string, mobileRaw: string) {
  const admissionNo = admissionNoRaw.trim().toUpperCase();
  const mobile = normalizeMobile(mobileRaw);
  if (!admissionNo || !/^[6-9]\d{9}$/.test(mobile)) return null;

  const admission = await db.admission.findUnique({
    where: { admissionNo },
    select: {
      student: {
        select: {
          mobile: true,
          deletedAt: true,
          user: { select: { id: true, name: true, role: true, email: true, mobile: true, status: true, deletedAt: true } },
        },
      },
    },
  });
  const student = admission?.student;
  const user = student?.user;
  if (!student || !user || student.deletedAt || user.deletedAt || user.status !== "ACTIVE" || user.role !== "STUDENT") return null;

  const matches = normalizeMobile(student.mobile) === mobile || (!!user.mobile && normalizeMobile(user.mobile) === mobile);
  return matches ? { user, mobile, admissionNo } : null;
}

export async function requestLoginOtp(input: { admissionNo: string; mobile: string } & RequestMeta): Promise<OtpRequestResult> {
  const neutral: OtpRequestResult = { message: OTP_NEUTRAL_MESSAGE, expiresInSec: OTP_TTL_MINUTES * 60, resendAfterSec: OTP_RESEND_AFTER_SEC };
  const isProduction = process.env.NODE_ENV === "production";

  // Asked BEFORE any lookup, so this honest error says nothing about the admission number.
  const channels = await getPhoneChannels();
  if (channels.length === 0 && isProduction) {
    throw new ApiError(
      503,
      "We cannot send login codes by SMS right now. Please use the Password tab, or contact your training centre for help.",
      "OTP_UNAVAILABLE"
    );
  }

  const mobile = normalizeMobile(input.mobile);
  const admissionKey = input.admissionNo.trim().toUpperCase();
  // Counted whether or not the details match, so the limits cannot be used as an oracle either.
  await enforceRateLimit(`login-otp:mobile:${mobile}`, REQUESTS_PER_MOBILE_PER_HOUR, 3600);
  await enforceRateLimit(`login-otp:admission:${admissionKey}`, REQUESTS_PER_ADMISSION_PER_HOUR, 3600);

  const match = await findAdmittedStudent(input.admissionNo, input.mobile);
  if (!match) return neutral;
  const { user } = match;

  // A second tap inside the resend window keeps the code already on its way instead of texting another.
  const latest = await db.loginOtp.findFirst({
    where: { userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < OTP_MIN_GAP_MS) return neutral;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();
  await db.$transaction([
    // Only the newest code is ever valid: earlier unconsumed ones expire now.
    db.loginOtp.updateMany({ where: { userId: user.id, consumedAt: null, expiresAt: { gt: now } }, data: { expiresAt: now } }),
    db.loginOtp.create({
      data: {
        userId: user.id,
        codeHash: hashLoginOtp(user.id, code),
        expiresAt: new Date(now.getTime() + OTP_TTL_MINUTES * 60_000),
        ip: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
      },
    }),
  ]);

  if (channels.length > 0) {
    await notify({
      userId: user.id,
      mobile: match.mobile,
      event: "LOGIN_OTP",
      data: { name: user.name, code, minutes: OTP_TTL_MINUTES },
      channels,
      redact: ["code"],
    });
  }
  if (!isProduction) {
    // DEVELOPMENT CONVENIENCE ONLY — lets the flow be tested on a machine without an SMS provider.
    // Never reached in production, and the code is never part of any API response.
    console.info(`[login-otp] DEV ONLY (NODE_ENV=${process.env.NODE_ENV ?? "unset"}): code for ${match.admissionNo} / ${maskMobile(match.mobile)} is ${code}`);
  }
  return neutral;
}

export async function verifyLoginOtp(input: { admissionNo: string; mobile: string; code: string } & RequestMeta) {
  const identifier = `admission:${input.admissionNo.trim().toUpperCase()}`.slice(0, 190);
  const match = await findAdmittedStudent(input.admissionNo, input.mobile);

  const record = (success: boolean, reason?: string) =>
    db.loginHistory.create({
      data: { userId: match?.user.id ?? null, identifier, success, reason, ip: input.ip ?? null, userAgent: input.userAgent?.slice(0, 500) ?? null },
    });

  if (!match) {
    await record(false, "otp_no_match");
    // Same words as an expired code: a wrong admission number or mobile must not be told apart.
    throw Errors.unauthorized(NO_CODE_MESSAGE);
  }
  const { user } = match;

  const otp = await db.loginOtp.findFirst({
    where: { userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    await record(false, "otp_expired");
    throw Errors.unauthorized(NO_CODE_MESSAGE);
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    await record(false, "otp_locked");
    throw Errors.unauthorized(LOCKED_MESSAGE);
  }

  const code = input.code.trim();
  if (!/^\d{6}$/.test(code) || !sameHash(hashLoginOtp(user.id, code), otp.codeHash)) {
    // Conditional increment: concurrent wrong guesses cannot push past the cap unnoticed.
    await db.loginOtp.updateMany({ where: { id: otp.id, attempts: { lt: OTP_MAX_ATTEMPTS } }, data: { attempts: { increment: 1 } } });
    const after = await db.loginOtp.findUnique({ where: { id: otp.id }, select: { attempts: true } });
    const locked = (after?.attempts ?? OTP_MAX_ATTEMPTS) >= OTP_MAX_ATTEMPTS;
    await record(false, locked ? "otp_locked" : "otp_bad_code");
    throw Errors.unauthorized(locked ? LOCKED_MESSAGE : BAD_CODE_MESSAGE);
  }

  // Consume atomically — two tabs submitting the same code produce exactly one session.
  const consumed = await db.loginOtp.updateMany({
    where: { id: otp.id, consumedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS }, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) {
    await record(false, "otp_expired");
    throw Errors.unauthorized(NO_CODE_MESSAGE);
  }

  // Password counters are left alone: this sign-in proves the phone, not the password.
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await record(true, "otp");
  const session = await createSession(user.id, { ip: input.ip, userAgent: input.userAgent });
  await audit({
    user: { id: user.id, name: user.name, role: user.role },
    action: "login",
    module: "auth",
    recordType: "User",
    recordId: user.id,
    description: `${user.name} logged in with admission number ${match.admissionNo} and a one-time code`,
    ip: input.ip,
    userAgent: input.userAgent,
  });
  return { user, ...session };
}
