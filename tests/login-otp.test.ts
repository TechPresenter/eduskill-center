import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resolveSessionByToken } from "@/lib/auth/session";
import { setSettings } from "@/lib/settings";
import { generateAdmissionNo, generateApplicationNo } from "@/lib/ids";
import { OTP_MAX_ATTEMPTS, OTP_NEUTRAL_MESSAGE, requestLoginOtp, verifyLoginOtp } from "@/server/login-otp";
import { ensureAdmin, makeBatch, makeCenter, makeCourse, makeLocation, makeStudent, uid } from "./helpers";

/**
 * Admission number + mobile sign-in. The code is read from the development console line the
 * service prints outside production — the same way a developer tests the flow without an SMS
 * provider — because the database only ever holds a hash of it.
 */

async function makeAdmittedStudent() {
  const admin = await ensureAdmin();
  const loc = await makeLocation();
  const course = await makeCourse();
  const center = await makeCenter(admin, loc, [course.id]);
  const batch = await makeBatch(admin, center.id, course.id);
  const { user, student } = await makeStudent(loc, { withDocuments: false });
  const application = await db.application.create({
    data: { applicationNo: await generateApplicationNo(), studentId: student.id, centerId: center.id, courseId: course.id, status: "ADMISSION_CONFIRMED" },
  });
  const admission = await db.admission.create({
    data: { admissionNo: await generateAdmissionNo(), applicationId: application.id, studentId: student.id, centerId: center.id, courseId: course.id, batchId: batch.id },
  });
  return { user, student, admission, mobile: student.mobile };
}

/** Requests a code and returns it from the dev-only console line. */
async function requestAndCapture(admissionNo: string, mobile: string, ip = uid("ip")) {
  const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
  try {
    const result = await requestLoginOtp({ admissionNo, mobile, ip, userAgent: "vitest" });
    const line = spy.mock.calls.map((c) => String(c[0])).find((l) => l.includes("[login-otp]"));
    const code = line?.match(/is (\d{6})$/)?.[1];
    return { result, code };
  } finally {
    spy.mockRestore();
  }
}

/** A six-digit code guaranteed to differ from `code`. */
const wrongCode = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await setSettings({ "comms.smsEnabled": false, "comms.smsProvider": "none", "comms.smsWebhookUrl": "" });
});

describe("admission number + mobile login", () => {
  it("signs in with the correct code and records the login", async () => {
    const { user, admission, mobile } = await makeAdmittedStudent();
    const { result, code } = await requestAndCapture(admission.admissionNo.toLowerCase(), `+91 ${mobile}`);
    expect(result.message).toBe(OTP_NEUTRAL_MESSAGE);
    expect(code).toMatch(/^\d{6}$/);

    const out = await verifyLoginOtp({ admissionNo: admission.admissionNo, mobile, code: code!, ip: "127.0.0.1", userAgent: "vitest" });
    expect(out.user.id).toBe(user.id);
    const session = await resolveSessionByToken(out.token);
    expect(session?.id).toBe(user.id);
    expect(session?.role).toBe("STUDENT");

    const history = await db.loginHistory.findMany({ where: { userId: user.id, success: true } });
    expect(history.length).toBe(1);
    expect(history[0]!.identifier).toBe(`admission:${admission.admissionNo}`);
  });

  it("rejects a wrong code, counts the attempt and logs the failure", async () => {
    const { user, admission, mobile } = await makeAdmittedStudent();
    const { code } = await requestAndCapture(admission.admissionNo, mobile);
    await expect(verifyLoginOtp({ admissionNo: admission.admissionNo, mobile, code: wrongCode(code!) })).rejects.toMatchObject({ status: 401 });

    const otp = await db.loginOtp.findFirstOrThrow({ where: { userId: user.id } });
    expect(otp.attempts).toBe(1);
    expect(otp.consumedAt).toBeNull();
    expect(await db.loginHistory.count({ where: { userId: user.id, success: false, reason: "otp_bad_code" } })).toBe(1);
  });

  it(`locks the code after ${OTP_MAX_ATTEMPTS} wrong attempts, even against the right code`, async () => {
    const { user, admission, mobile } = await makeAdmittedStudent();
    const { code } = await requestAndCapture(admission.admissionNo, mobile);
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      await expect(verifyLoginOtp({ admissionNo: admission.admissionNo, mobile, code: wrongCode(code!) })).rejects.toMatchObject({ status: 401 });
    }
    await expect(verifyLoginOtp({ admissionNo: admission.admissionNo, mobile, code: code! })).rejects.toThrow(/too many wrong attempts/i);
    const otp = await db.loginOtp.findFirstOrThrow({ where: { userId: user.id } });
    expect(otp.attempts).toBe(OTP_MAX_ATTEMPTS);
    expect(otp.consumedAt).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("rejects an expired code", async () => {
    const { user, admission, mobile } = await makeAdmittedStudent();
    const { code } = await requestAndCapture(admission.admissionNo, mobile);
    await db.loginOtp.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(verifyLoginOtp({ admissionNo: admission.admissionNo, mobile, code: code! })).rejects.toThrow(/expired/i);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("does not let a consumed code sign in twice", async () => {
    const { user, admission, mobile } = await makeAdmittedStudent();
    const { code } = await requestAndCapture(admission.admissionNo, mobile);
    await verifyLoginOtp({ admissionNo: admission.admissionNo, mobile, code: code! });
    await expect(verifyLoginOtp({ admissionNo: admission.admissionNo, mobile, code: code! })).rejects.toMatchObject({ status: 401 });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
    const otp = await db.loginOtp.findFirstOrThrow({ where: { userId: user.id } });
    expect(otp.consumedAt).not.toBeNull();
  });

  it("answers identically for a non-matching admission number or mobile and sends nothing", async () => {
    const { user, admission, mobile } = await makeAdmittedStudent();
    const otherMobile = mobile === "9876543210" ? "9876543211" : "9876543210";

    const unknown = await requestAndCapture(`ADM-1999-${uid("").slice(-6)}`, mobile);
    const wrongMobile = await requestAndCapture(admission.admissionNo, otherMobile);
    const real = await requestAndCapture(admission.admissionNo, mobile);

    expect(unknown.result).toEqual(real.result);
    expect(wrongMobile.result).toEqual(real.result);
    expect(unknown.code).toBeUndefined();
    expect(wrongMobile.code).toBeUndefined();
    // Only the genuine request produced a code.
    expect(await db.loginOtp.count({ where: { userId: user.id } })).toBe(1);

    // Verifying against a non-matching admission fails with the same words as an expired code.
    await expect(verifyLoginOtp({ admissionNo: `ADM-1999-000000`, mobile, code: real.code! })).rejects.toThrow(/expired or was not requested/i);
  });

  it("never stores the plain code — not in login_otps and not in the notification log", async () => {
    await setSettings({ "comms.smsEnabled": true, "comms.smsProvider": "webhook", "comms.smsWebhookUrl": "http://127.0.0.1:9/sms-test" });
    const { user, admission, mobile } = await makeAdmittedStudent();
    const { code } = await requestAndCapture(admission.admissionNo, mobile);
    expect(code).toMatch(/^\d{6}$/);

    const otp = await db.loginOtp.findFirstOrThrow({ where: { userId: user.id } });
    expect(otp.codeHash).not.toContain(code!);
    expect(otp.codeHash).toMatch(/^[0-9a-f]{64}$/);

    const rows = await db.notification.findMany({ where: { userId: user.id, templateKey: { startsWith: "LOGIN_OTP:" } } });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.channel === "SMS" || r.channel === "WHATSAPP")).toBe(true);
    for (const r of rows) {
      expect(r.body).not.toContain(code!);
      expect(r.title).not.toContain(code!);
      expect(JSON.stringify(r.data)).not.toContain(code!);
    }
    await setSettings({ "comms.smsEnabled": false, "comms.smsProvider": "none", "comms.smsWebhookUrl": "" });
  });

  it("issues only one live code: a new code invalidates the previous one", async () => {
    const { user, admission, mobile } = await makeAdmittedStudent();
    const first = await requestAndCapture(admission.admissionNo, mobile);
    // Step past the resend window rather than sleeping.
    await db.loginOtp.updateMany({ where: { userId: user.id }, data: { createdAt: new Date(Date.now() - 60_000) } });
    const second = await requestAndCapture(admission.admissionNo, mobile);
    expect(second.code).toMatch(/^\d{6}$/);
    if (first.code !== second.code) {
      await expect(verifyLoginOtp({ admissionNo: admission.admissionNo, mobile, code: first.code! })).rejects.toMatchObject({ status: 401 });
    }
    const out = await verifyLoginOtp({ admissionNo: admission.admissionNo, mobile, code: second.code! });
    expect(out.user.id).toBe(user.id);
  });

  it("refuses honestly in production when no SMS or WhatsApp provider is configured", async () => {
    const { admission, mobile } = await makeAdmittedStudent();
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      await expect(requestLoginOtp({ admissionNo: admission.admissionNo, mobile })).rejects.toMatchObject({ status: 503, code: "OTP_UNAVAILABLE" });
      expect(spy.mock.calls.some((c) => String(c[0]).includes("[login-otp]"))).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});
