import { createHmac, randomBytes } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238) for Google Authenticator and compatible apps:
 * HMAC-SHA1, 6 digits, 30-second steps — the parameters every authenticator app supports.
 * Pure functions on top of node:crypto; no third-party dependency.
 */

export const TOTP_PERIOD_SEC = 30;
export const TOTP_DIGITS = 6;
/** Steps either side of "now" that are still accepted (clock drift between phone and server). */
export const TOTP_WINDOW = 1;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh 160-bit secret, base32 encoded (what the QR code and the manual key carry). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The 30-second step a moment falls in. */
export function totpStep(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000 / TOTP_PERIOD_SEC);
}

/** HOTP (RFC 4226) for a counter; TOTP is HOTP over the time step. */
export function hotp(secret: string, counter: number, digits: number = TOTP_DIGITS): string {
  const key = base32Decode(secret);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", key).update(msg).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const bin = ((mac[offset]! & 0x7f) << 24) | ((mac[offset + 1]! & 0xff) << 16) | ((mac[offset + 2]! & 0xff) << 8) | (mac[offset + 3]! & 0xff);
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export function totpAt(secret: string, step: number): string {
  return hotp(secret, step);
}

/**
 * Checks a 6-digit code against the steps around `now`. Returns the matched step, or null.
 * A step at or before `lastStep` is refused, so a code that was already used — or an older one
 * captured over the shoulder — cannot sign in again.
 */
export function verifyTotp(secret: string, code: string, opts: { lastStep?: number | null; nowMs?: number; window?: number } = {}): number | null {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const now = totpStep(opts.nowMs);
  const window = opts.window ?? TOTP_WINDOW;
  let matched: number | null = null;
  // Every candidate is computed (no early exit), so timing does not reveal which step matched.
  for (let step = now - window; step <= now + window; step++) {
    if (opts.lastStep != null && step <= opts.lastStep) continue;
    if (totpAt(secret, step) === clean && matched === null) matched = step;
  }
  return matched;
}

/** The otpauth:// URI that authenticator apps read from the QR code. */
export function otpauthUri(opts: { issuer: string; account: string; secret: string }): string {
  const issuer = opts.issuer.replace(/:/g, "").trim() || "EduSkill";
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(opts.account)}`;
  const params = new URLSearchParams({ secret: opts.secret, issuer, algorithm: "SHA1", digits: String(TOTP_DIGITS), period: String(TOTP_PERIOD_SEC) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** "ABCD EFGH IJKL …" — easier to type into an app by hand. */
export function formatTotpSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}
