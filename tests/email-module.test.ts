import { beforeEach, describe, expect, it, vi } from "vitest";

// The SMTP transport is replaced; everything else (sanitising, limits, history, audit) is real.
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  sendMail: vi.fn(async () => ({ messageId: "<msg-1@eduskillindia.com>", accepted: [] as string[], rejected: [] as string[] })),
  emailConfigStatus: vi.fn(async () => ({
    configured: true,
    hostFrom: "settings",
    passwordSet: true,
    passwordFrom: "settings",
    port: 465,
    tls: "SSL/TLS",
    fromName: "EduSkill India Foundation",
    fromAddress: "info@eduskillindia.com",
    replyTo: "",
    routineEmailEnabled: true,
  })),
  sendSecurityEmail: vi.fn(async () => ({ ok: true })),
}));

import { db } from "@/lib/db";
import { emailConfigStatus, sendMail } from "@/lib/notifications";
import { setSettings } from "@/lib/settings";
import type { AuthUser } from "@/lib/auth/session";
import {
  BULK_CONFIRM_THRESHOLD,
  composeSchema,
  deleteDraft,
  getEmail,
  historySchema,
  listEmails,
  saveDraft,
  sendComposedEmail,
  sendSchema,
  sendTestComposedEmail,
  testSchema,
  uploadEmailAttachment,
} from "@/server/email";
import { scopeHistoryQuery } from "@/components/admin/email/history-query";
import { adminAuthUser, makeAdminAccount, uid } from "./helpers";

/**
 * Admin → Send Email (src/server/email.ts). Inputs go through the same Zod schemas the routes use,
 * so the schema-level protections (header injection, address parsing) are exercised too.
 */

const mailer = vi.mocked(sendMail);

beforeEach(() => {
  mailer.mockClear();
});

async function superAdmin(): Promise<AuthUser> {
  return adminAuthUser((await makeAdminAccount({ role: "SUPER_ADMIN" })).user.id);
}

async function staff(permissions: string[] = ["email.send", "email.view"]): Promise<AuthUser> {
  return adminAuthUser((await makeAdminAccount({ role: "STAFF", level: 3, permissions })).user.id);
}

const send = (input: Record<string, unknown>, user: AuthUser) => sendComposedEmail(sendSchema.parse(input), { user, ip: "127.0.0.1", userAgent: "vitest" });

const rowsBy = (user: AuthUser) => db.emailMessage.count({ where: { OR: [{ createdById: user.id }, { sentById: user.id }] } });

const pdfBytes = (size = 64) => Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(Math.max(0, size - 9), 0x20)]);
const pdfFile = (name = "brochure.pdf", size = 64) => new File([pdfBytes(size)], name, { type: "application/pdf" });

describe("sendComposedEmail — recipients", () => {
  it("validates every address and needs at least one To", async () => {
    const me = await superAdmin();
    const base = { subject: "Hello", html: "<p>Hi</p>" };
    await expect(send({ ...base, to: "" }, me)).rejects.toMatchObject({ status: 422, details: { to: expect.stringMatching(/at least one recipient/i) } });
    await expect(send({ ...base, to: [], cc: "a@x.com" }, me)).rejects.toMatchObject({ status: 422 });
    await expect(send({ ...base, to: "not-an-email, b@y.org" }, me)).rejects.toMatchObject({ status: 422, details: { to: expect.stringContaining("not-an-email") } });
    await expect(send({ ...base, to: "a@x.com", cc: "bad@", bcc: "c@z.in" }, me)).rejects.toMatchObject({ status: 422 });
    await expect(send({ ...base, to: "a@x.com", bcc: "<evil@x.com>" }, me)).rejects.toMatchObject({ status: 422 });
    // A line break in the address box cannot smuggle a header: the fragment is not an address.
    await expect(send({ ...base, to: "a@x.com\r\nBcc: evil@x.com" }, me)).rejects.toMatchObject({ status: 422, details: { to: expect.stringContaining("bcc:") } });
    expect(mailer).not.toHaveBeenCalled();
    expect(await rowsBy(me)).toBe(0);
  });

  it("parses, lower-cases and de-duplicates address lists", () => {
    const parsed = sendSchema.parse({ to: "Ravi@Example.com; ravi@example.com, Asha@Example.org", cc: ["x@y.in", "X@Y.IN"], subject: "s", html: "" });
    expect(parsed.to).toEqual(["ravi@example.com", "asha@example.org"]);
    expect(parsed.cc).toEqual(["x@y.in"]);
    expect(parsed.bcc).toEqual([]);
    expect(parsed.includeSignature).toBe(true);
    expect(parsed.attachments).toEqual([]);
  });

  it("caps the number of recipients (email.maxRecipients)", async () => {
    const me = await superAdmin();
    const to = Array.from({ length: 30 }, (_, i) => `to${i}@example.com`);
    const cc = Array.from({ length: 21 }, (_, i) => `cc${i}@example.com`);
    await expect(send({ to, cc, subject: "Too many", html: "<p>x</p>", confirmBulk: true }, me)).rejects.toMatchObject({ status: 422, details: { to: expect.stringMatching(/at most 50/i) } });
    expect(mailer).not.toHaveBeenCalled();
  });

  it(`needs explicit confirmation above ${BULK_CONFIRM_THRESHOLD} recipients`, async () => {
    const me = await superAdmin();
    const to = Array.from({ length: 6 }, (_, i) => `to${i}@example.com`);
    const cc = Array.from({ length: 3 }, (_, i) => `cc${i}@example.com`);
    const bcc = ["b1@example.com", "b2@example.com"];
    const subject = `Bulk ${uid("")}`;

    await expect(send({ to, cc, bcc, subject, html: "<p>x</p>" }, me)).rejects.toMatchObject({ status: 422, details: { confirmBulk: expect.stringContaining("11 people") } });
    await expect(send({ to, cc, bcc, subject, html: "<p>x</p>", confirmBulk: false }, me)).rejects.toMatchObject({ status: 422 });
    expect(mailer).not.toHaveBeenCalled();

    // Exactly the threshold (duplicates across To/CC/BCC count once) needs no confirmation.
    const atThreshold = await send({ to, cc: [...cc, to[0]!], bcc: ["b1@example.com"], subject: `${subject} (10)`, html: "<p>x</p>" }, me);
    expect(atThreshold.status).toBe("SENT");

    const sent = await send({ to, cc, bcc, subject, html: "<p>x</p>", confirmBulk: true }, me);
    expect(sent.status).toBe("SENT");
    const call = mailer.mock.calls.at(-1)![0];
    expect(call.to).toEqual(to);
    expect(call.cc).toEqual(cc);
    expect(call.bcc).toEqual(bcc);
    expect(await db.securityAlert.count({ where: { userId: me.id, title: { contains: "11 recipients" } } })).toBe(1);
  });
});

describe("schemas — header injection", () => {
  const base = { to: "a@x.com", html: "<p>x</p>" };

  it("rejects a subject with a line break or NUL", () => {
    for (const subject of ["Hello\r\nBcc: victim@x.com", "Hello\nX-Spam: yes", "Hello\rWorld", "Hello\0"]) {
      const r = sendSchema.safeParse({ ...base, subject });
      expect(r.success, JSON.stringify(subject)).toBe(false);
      if (!r.success) expect(r.error.issues.some((i) => i.path[0] === "subject")).toBe(true);
    }
    expect(sendSchema.safeParse({ ...base, subject: "" }).success).toBe(false);
    expect(sendSchema.safeParse({ ...base, subject: "x".repeat(201) }).success).toBe(false);
    expect(sendSchema.safeParse({ ...base, subject: "Admissions open — Class 1–12 (₹50)" }).success).toBe(true);
  });

  it("rejects an attachment name with a line break and a test address that is not one address", () => {
    const attachment = { key: "private/email/x/a.pdf", name: "a.pdf\r\nContent-Type: text/html", size: 10 };
    expect(sendSchema.safeParse({ ...base, subject: "s", attachments: [attachment] }).success).toBe(false);
    expect(composeSchema.safeParse({ ...base, subject: "s", attachments: Array.from({ length: 11 }, (_, i) => ({ key: `k${i}`, name: `f${i}.pdf`, size: 1 })) }).success).toBe(false);
    expect(testSchema.safeParse({ ...base, subject: "s", testTo: "me@x.com\r\nBcc: evil@x.com" }).success).toBe(false);
    expect(testSchema.safeParse({ ...base, subject: "s", testTo: "a@x.com, b@y.com" }).success).toBe(false);
    expect(testSchema.parse({ ...base, subject: "s", testTo: " Me@Example.com " }).testTo).toBe("me@example.com");
  });
});

describe("attachments", () => {
  it("refuses attachment keys outside private/email/<own id>/", async () => {
    const me = await superAdmin();
    const other = await superAdmin();
    const base = { to: "a@x.com", subject: "With attachment", html: "<p>x</p>" };
    const keys = [
      `private/email/${other.id}/report.pdf`,
      `private/students/${other.id}/photo.pdf`,
      `public/email/${me.id}/report.pdf`,
      `private/email/${me.id}/../${other.id}/report.pdf`,
      `private/email/${me.id}x/report.pdf`,
      `private/email/report.pdf`,
    ];
    for (const key of keys) {
      const attachments = [{ key, name: "report.pdf", size: 10, mimeType: "application/pdf" }];
      await expect(send({ ...base, attachments }, me), key).rejects.toMatchObject({ status: 403 });
      await expect(saveDraft({ ...composeSchema.parse({ ...base, attachments }) }, { user: me }), key).rejects.toMatchObject({ status: 403 });
      await expect(sendTestComposedEmail(testSchema.parse({ ...base, attachments, testTo: "me@example.com" }), { user: me }), key).rejects.toMatchObject({ status: 403 });
    }
    expect(mailer).not.toHaveBeenCalled();
    expect(await rowsBy(me)).toBe(0);
  });

  it("validates uploads and sends the sender's own upload as an attachment", async () => {
    const me = await staff();
    const ctx = { user: me };
    await expect(uploadEmailAttachment(new File([Buffer.from("MZ\x90\x00")], "setup.exe", { type: "application/octet-stream" }), ctx)).rejects.toMatchObject({ status: 400 });
    await expect(uploadEmailAttachment(new File(["<html><script>x</script></html>"], "page.html", { type: "text/html" }), ctx)).rejects.toMatchObject({ status: 400 });
    await expect(uploadEmailAttachment(new File(["not really a pdf"], "fake.pdf", { type: "application/pdf" }), ctx)).rejects.toMatchObject({ status: 400 });
    await expect(uploadEmailAttachment(new File([], "empty.pdf", { type: "application/pdf" }), ctx)).rejects.toMatchObject({ status: 400 });

    const uploaded = await uploadEmailAttachment(pdfFile("Fee Brochure.pdf"), ctx);
    expect(uploaded.key.startsWith(`private/email/${me.id}/`)).toBe(true);
    expect(uploaded).toMatchObject({ name: "Fee Brochure.pdf", mimeType: "application/pdf", size: 64 });

    const sent = await send({ to: "parent@example.com", subject: "Brochure", html: "<p>Attached.</p>", attachments: [uploaded] }, me);
    expect(sent.status).toBe("SENT");
    expect(sent.attachments).toEqual([uploaded]);
    const call = mailer.mock.calls.at(-1)![0];
    expect(call.attachments).toHaveLength(1);
    expect(call.attachments![0]!.filename).toBe("Fee Brochure.pdf");
    expect(call.attachments![0]!.content.equals(pdfBytes())).toBe(true);

    // A key under the sender's own folder that does not exist is refused, not sent without it.
    const ghost = { ...uploaded, key: `private/email/${me.id}/missing.pdf` };
    await expect(send({ to: "parent@example.com", subject: "Missing", html: "<p>x</p>", attachments: [ghost] }, me)).rejects.toThrow(/no longer available/i);
  });

  it("enforces the total attachment size (email.maxAttachmentMb)", async () => {
    const me = await superAdmin();
    const ctx = { user: me };
    const a = await uploadEmailAttachment(pdfFile("a.pdf", 600 * 1024), ctx);
    const b = await uploadEmailAttachment(pdfFile("b.pdf", 600 * 1024), ctx);
    await setSettings({ "email.maxAttachmentMb": 1 });
    try {
      await expect(uploadEmailAttachment(pdfFile("big.pdf", 1100 * 1024), ctx)).rejects.toThrow(/too large/i);
      await expect(send({ to: "a@x.com", subject: "Two files", html: "<p>x</p>", attachments: [a, b] }, me)).rejects.toThrow(/larger than 1 MB/i);
      expect(mailer).not.toHaveBeenCalled();
      expect((await send({ to: "a@x.com", subject: "One file", html: "<p>x</p>", attachments: [a] }, me)).status).toBe("SENT");
    } finally {
      await setSettings({ "email.maxAttachmentMb": 10 });
    }
  });
});

describe("sending and history", () => {
  it("records a SENT history row with the Message-ID, sanitised HTML and the signature", async () => {
    const me = await superAdmin();
    const subject = `Newsletter ${uid("")}`;
    const sent = await send(
      { to: "Ravi@Example.com", cc: "asha@example.org", bcc: "audit@example.net", subject, html: '<h2 onclick="x()">Hello</h2><script>steal()</script><p>Classes start <a href="javascript:alert(1)">soon</a>.</p>' },
      me
    );
    expect(sent).toMatchObject({
      status: "SENT",
      isTest: false,
      messageId: "<msg-1@eduskillindia.com>",
      error: null,
      toAddresses: ["ravi@example.com"],
      ccAddresses: ["asha@example.org"],
      bccAddresses: ["audit@example.net"],
      fromAddress: "info@eduskillindia.com",
      createdById: me.id,
      sentById: me.id,
      includeSignature: true,
    });
    expect(sent.sentAt).toBeInstanceOf(Date);
    expect(sent.html).not.toMatch(/script|steal|onclick|javascript/);
    expect(sent.html).toContain("<h2>Hello</h2>");
    expect(sent.text).toContain("Hello");

    const call = mailer.mock.calls.at(-1)![0];
    expect(call.subject).toBe(subject);
    expect(call.to).toEqual(["ravi@example.com"]);
    expect(call.html).toMatch(/^<!doctype html>/);
    expect(call.html).not.toMatch(/script|onclick|javascript/);
    expect(call.html).toContain("Best regards");
    expect(call.text).toContain("Best regards");

    const stored = await db.emailMessage.findUniqueOrThrow({ where: { id: sent.id } });
    expect(stored.status).toBe("SENT");
    expect(stored.messageId).toBe("<msg-1@eduskillindia.com>");
    expect(await db.auditLog.count({ where: { recordId: sent.id, action: "email_send" } })).toBe(1);

    const detail = await getEmail(sent.id, { user: me });
    expect(detail.previewHtml).toContain("<h2>Hello</h2>");
    expect(detail.sentBy?.id).toBe(me.id);

    const bySubject = await listEmails(historySchema.parse({ q: subject }), { user: me });
    expect(bySubject.items.map((i) => i.id)).toEqual([sent.id]);
    expect(bySubject.items[0]!.sentBy).toBe(me.name);
    const byRecipient = await listEmails(historySchema.parse({ q: "ravi@example.com", mine: "true" }), { user: me });
    expect(byRecipient.items.map((i) => i.id)).toContain(sent.id);
    const failedOnly = await listEmails(historySchema.parse({ q: subject, status: "FAILED" }), { user: me });
    expect(failedOnly.items).toHaveLength(0);
  });

  it("leaves the signature out when includeSignature is off", async () => {
    const me = await superAdmin();
    await send({ to: "a@x.com", subject: "No signature", html: "<p>Short note</p>", includeSignature: false }, me);
    const call = mailer.mock.calls.at(-1)![0];
    expect(call.html).toContain("Short note");
    expect(call.html).not.toContain("Best regards");
  });

  it("records FAILED with the transport error instead of throwing, and notes partial rejections", async () => {
    const me = await superAdmin();
    mailer.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:465"));
    const failed = await send({ to: "a@x.com", subject: "Will fail", html: "<p>x</p>" }, me);
    expect(failed.status).toBe("FAILED");
    expect(failed.error).toContain("ECONNREFUSED");
    expect(failed.messageId).toBeNull();
    expect((await db.emailMessage.findUniqueOrThrow({ where: { id: failed.id } })).status).toBe("FAILED");
    expect(await db.auditLog.count({ where: { recordId: failed.id, action: "email_failed" } })).toBe(1);
    const history = await listEmails(historySchema.parse({ status: "FAILED", mine: "true" }), { user: me });
    expect(history.items.map((i) => i.id)).toContain(failed.id);

    mailer.mockResolvedValueOnce({ messageId: "<msg-2@eduskillindia.com>", accepted: ["a@x.com"], rejected: ["b@y.org"] });
    const partial = await send({ to: "a@x.com, b@y.org", subject: "Partly delivered", html: "<p>x</p>" }, me);
    expect(partial.status).toBe("SENT");
    expect(partial.messageId).toBe("<msg-2@eduskillindia.com>");
    expect(partial.error).toContain("b@y.org");
  });

  it("refuses to send when SMTP is not configured", async () => {
    const me = await superAdmin();
    const status = await emailConfigStatus();
    vi.mocked(emailConfigStatus).mockResolvedValueOnce({ ...status, configured: false });
    await expect(send({ to: "a@x.com", subject: "Nowhere", html: "<p>x</p>" }, me)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/not configured/i) });
    expect(mailer).not.toHaveBeenCalled();
    expect(await rowsBy(me)).toBe(0);
  });

  it("sends a test email only to the test address, marked [TEST]", async () => {
    const me = await superAdmin();
    const r = await sendTestComposedEmail(testSchema.parse({ to: "everyone@example.com", cc: "x@y.in", subject: "Preview me", html: "<p>x</p>", testTo: "Me@Example.com" }), { user: me });
    expect(r).toMatchObject({ status: "SENT", isTest: true, subject: "[TEST] Preview me", toAddresses: ["me@example.com"], ccAddresses: [], bccAddresses: [] });
    const call = mailer.mock.calls.at(-1)![0];
    expect(call.to).toEqual(["me@example.com"]);
    expect(call.cc ?? []).toEqual([]);
    expect(call.bcc ?? []).toEqual([]);
  });

  it("shows sent emails only to administrators with email.view", async () => {
    const me = await superAdmin();
    const sent = await send({ to: "a@x.com", subject: "Visible to viewers", html: "<p>x</p>" }, me);
    const sender = await staff(["email.send"]);
    await expect(getEmail(sent.id, { user: sender })).rejects.toMatchObject({ status: 403 });
    const viewer = await staff(["email.view"]);
    expect((await getEmail(sent.id, { user: viewer })).id).toBe(sent.id);
  });
});

describe("drafts", () => {
  it("keeps drafts private to their author (a Super Admin sees all)", async () => {
    const author = await staff();
    const colleague = await staff();
    const boss = await superAdmin();
    const subject = `Draft ${uid("")}`;
    const draft = await saveDraft(composeSchema.parse({ to: "x@y.com", subject, html: '<p onclick="x()">Hi</p><script>bad()</script>' }), { user: author });
    expect(draft).toMatchObject({ status: "DRAFT", createdById: author.id, sentById: null, toAddresses: ["x@y.com"] });
    expect(draft.html).toBe("<p>Hi</p>");

    const ids = async (user: AuthUser, scope: "drafts" | "sent") => (await listEmails(historySchema.parse({ scope, q: subject }), { user })).items.map((i) => i.id);
    expect(await ids(author, "drafts")).toEqual([draft.id]);
    expect(await ids(colleague, "drafts")).toEqual([]);
    expect(await ids(boss, "drafts")).toEqual([draft.id]);
    expect(await ids(boss, "sent")).toEqual([]);
    // The history route's scoping keeps other people's drafts out of "all" and status=DRAFT too.
    const viaRoute = async (user: AuthUser, query: Record<string, unknown>) =>
      (await listEmails(scopeHistoryQuery(historySchema.parse({ ...query, q: subject }), user), { user })).items.map((i) => i.id);
    expect(await viaRoute(colleague, { scope: "all" })).toEqual([]);
    expect(await viaRoute(colleague, { scope: "sent", status: "DRAFT" })).toEqual([]);
    expect(await viaRoute(boss, { scope: "all" })).toEqual([draft.id]);

    await expect(getEmail(draft.id, { user: colleague })).rejects.toMatchObject({ status: 404 });
    await expect(saveDraft({ ...composeSchema.parse({ to: "x@y.com", subject: "Hijacked", html: "" }), draftId: draft.id }, { user: colleague })).rejects.toMatchObject({ status: 403 });
    await expect(deleteDraft(draft.id, { user: colleague })).rejects.toMatchObject({ status: 403 });
    await expect(send({ to: "x@y.com", subject: "Hijacked", html: "<p>x</p>", draftId: draft.id }, colleague)).rejects.toMatchObject({ status: 403 });
    expect(mailer).not.toHaveBeenCalled();
    const untouched = await db.emailMessage.findUniqueOrThrow({ where: { id: draft.id } });
    expect(untouched).toMatchObject({ status: "DRAFT", subject, deletedAt: null });

    // The service itself (not only the route helper) keeps other people's drafts out of every scope.
    expect(await ids(colleague, "sent")).toEqual([]);
    expect((await listEmails(historySchema.parse({ scope: "all", q: subject }), { user: colleague })).items).toEqual([]);
    expect((await listEmails(historySchema.parse({ scope: "sent", status: "DRAFT", q: subject }), { user: colleague })).items).toEqual([]);

    // The author edits and sends it. A failed send keeps the draft; a successful one replaces it
    // with a new history row and removes the draft.
    const edited = await saveDraft({ ...composeSchema.parse({ to: "x@y.com", subject, html: "<p>Final</p>" }), draftId: draft.id }, { user: author });
    expect(edited.id).toBe(draft.id);
    mailer.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:465"));
    const failed = await send({ to: "x@y.com", subject, html: "<p>Final</p>", draftId: draft.id }, author);
    expect(failed.status).toBe("FAILED");
    expect(failed.id).not.toBe(draft.id);
    expect(await ids(author, "drafts")).toEqual([draft.id]);
    const sent = await send({ to: "x@y.com", subject, html: "<p>Final</p>", draftId: draft.id }, author);
    expect(sent.id).not.toBe(draft.id);
    expect(sent.status).toBe("SENT");
    expect(await ids(author, "drafts")).toEqual([]);
    await expect(deleteDraft(draft.id, { user: author })).rejects.toMatchObject({ status: 404 });
  });

  it("deletes a draft for its author", async () => {
    const author = await staff();
    const draft = await saveDraft(composeSchema.parse({ to: "", subject: "Scratch", html: "<p>x</p>" }), { user: author });
    await deleteDraft(draft.id, { user: author });
    await expect(getEmail(draft.id, { user: author })).rejects.toMatchObject({ status: 404 });
    expect(await db.auditLog.count({ where: { recordId: draft.id, action: "email_draft_delete" } })).toBe(1);
  });
});
