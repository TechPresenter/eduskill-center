import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, isEncrypted, isEncryptionConfigured, keyedHash, sameHex, secretIssues, sha256 } from "@/lib/crypto";

/**
 * Encryption at rest (DATA_ENCRYPTION_KEY) and the keyed hashes behind one-time codes. The key is
 * set per test and the original environment restored afterwards, so no other test file sees it.
 */

const KEY_HEX = randomBytes(32).toString("hex");
const ORIGINAL_KEY = process.env.DATA_ENCRYPTION_KEY;
const ORIGINAL_AUTH = process.env.AUTH_SECRET;

function restoreEnv() {
  if (ORIGINAL_KEY === undefined) delete process.env.DATA_ENCRYPTION_KEY;
  else process.env.DATA_ENCRYPTION_KEY = ORIGINAL_KEY;
  if (ORIGINAL_AUTH === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = ORIGINAL_AUTH;
}

beforeEach(() => {
  process.env.DATA_ENCRYPTION_KEY = KEY_HEX;
});

afterEach(restoreEnv);

/** Flips one character of a base64url string to another valid base64url character. */
function flip(part: string, index = 0) {
  const c = part[index]!;
  return part.slice(0, index) + (c === "A" ? "B" : "A") + part.slice(index + 1);
}

describe("isEncryptionConfigured", () => {
  it("is false without a key, for placeholders and for short values", () => {
    delete process.env.DATA_ENCRYPTION_KEY;
    expect(isEncryptionConfigured()).toBe(false);
    for (const v of ["", "   ", "change-me", "replace-with-a-long-random-secret", "CHANGEME", "short-key"]) {
      process.env.DATA_ENCRYPTION_KEY = v;
      expect(isEncryptionConfigured()).toBe(false);
    }
  });

  it("accepts a 64-hex key, a 32-byte base64/base64url key and a long passphrase", () => {
    expect(isEncryptionConfigured()).toBe(true);
    process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(isEncryptionConfigured()).toBe(true);
    process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64url");
    expect(isEncryptionConfigured()).toBe(true);
    process.env.DATA_ENCRYPTION_KEY = "a long passphrase that is at least thirty-two characters";
    expect(isEncryptionConfigured()).toBe(true);
  });
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips UTF-8 secrets with a fresh IV every time", () => {
    const plain = "smtp-pässwörd ✓ with : colons";
    const a = encryptSecret(plain);
    const b = encryptSecret(plain);
    expect(a.startsWith("enc:v1:")).toBe(true);
    expect(a.split(":")).toHaveLength(5);
    expect(a).not.toContain(plain);
    expect(a).not.toBe(b);
    expect(isEncrypted(a)).toBe(true);
    expect(decryptSecret(a)).toBe(plain);
    expect(decryptSecret(b)).toBe(plain);
    expect(decryptSecret(encryptSecret(""))).toBe("");
  });

  it("works with every accepted key format", () => {
    for (const key of [randomBytes(32).toString("base64"), randomBytes(32).toString("base64url"), "another passphrase of more than thirty-two chars"]) {
      process.env.DATA_ENCRYPTION_KEY = key;
      expect(decryptSecret(encryptSecret("GEZDGNBVGY3TQOJQ"))).toBe("GEZDGNBVGY3TQOJQ");
    }
  });

  it("passes legacy plaintext through unchanged, with or without a key", () => {
    expect(isEncrypted("plain-old-password")).toBe(false);
    expect(isEncrypted(42)).toBe(false);
    expect(decryptSecret("plain-old-password")).toBe("plain-old-password");
    delete process.env.DATA_ENCRYPTION_KEY;
    expect(decryptSecret("plain-old-password")).toBe("plain-old-password");
    expect(decryptSecret("")).toBe("");
  });

  it("detects tampering with the ciphertext, the tag or the IV", () => {
    const enc = encryptSecret("totp-secret-value");
    const [iv, tag, ct] = enc.slice("enc:v1:".length).split(":") as [string, string, string];
    expect(() => decryptSecret(`enc:v1:${iv}:${tag}:${flip(ct)}`)).toThrow();
    expect(() => decryptSecret(`enc:v1:${iv}:${flip(tag)}:${ct}`)).toThrow();
    expect(() => decryptSecret(`enc:v1:${flip(iv)}:${tag}:${ct}`)).toThrow();
    expect(() => decryptSecret(`enc:v1:${iv}:${tag.slice(0, 8)}:${ct}`)).toThrow();
    expect(() => decryptSecret("enc:v1:abc")).toThrow(/malformed/i);
    expect(() => decryptSecret("enc:v1:")).toThrow(/malformed/i);
  });

  it("refuses a truncated authentication tag (only the full 128-bit GCM tag is accepted)", () => {
    const enc = encryptSecret("totp-secret-value");
    const [iv, tag, ct] = enc.slice("enc:v1:".length).split(":") as [string, string, string];
    const short = Buffer.from(tag, "base64url").subarray(0, 4).toString("base64url");
    expect(() => decryptSecret(`enc:v1:${iv}:${short}:${ct}`)).toThrow();
  });

  it("cannot be read with a different key", () => {
    const enc = encryptSecret("secret");
    process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    expect(() => decryptSecret(enc)).toThrow();
  });

  it("refuses to encrypt or decrypt without a key", () => {
    const enc = encryptSecret("secret");
    delete process.env.DATA_ENCRYPTION_KEY;
    expect(() => encryptSecret("secret")).toThrow(/DATA_ENCRYPTION_KEY/);
    expect(() => decryptSecret(enc)).toThrow(/DATA_ENCRYPTION_KEY/);
  });
});

describe("keyedHash / sameHex / sha256", () => {
  it("is a deterministic HMAC-SHA256 hex digest", () => {
    const h = keyedHash("admin-login-otp", "challenge:user:123456");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(keyedHash("admin-login-otp", "challenge:user:123456")).toBe(h);
    expect(keyedHash("admin-login-otp", "challenge:user:123457")).not.toBe(h);
  });

  it("separates purposes by label: the same value hashes differently per flow", () => {
    const labels = ["admin-login-otp", "backup-code", "email-change-otp", "rate-limit", "admin-email"];
    const hashes = new Set(labels.map((l) => keyedHash(l, "user-1:ABCDEFGH")));
    expect(hashes.size).toBe(labels.length);
  });

  it("is keyed by AUTH_SECRET and refuses to run without one", () => {
    process.env.AUTH_SECRET = "first-auth-secret-for-the-test-0123456789";
    const a = keyedHash("label", "value");
    process.env.AUTH_SECRET = "other-auth-secret-for-the-test-0123456789";
    expect(keyedHash("label", "value")).not.toBe(a);
    process.env.AUTH_SECRET = "short";
    expect(() => keyedHash("label", "value")).toThrow(/AUTH_SECRET/);
  });

  it("compares hex digests in constant time and rejects mismatched or empty input", () => {
    const h = keyedHash("label", "value");
    expect(sameHex(h, h)).toBe(true);
    expect(sameHex(h, keyedHash("label", "other"))).toBe(false);
    expect(sameHex(h, h.slice(0, 62))).toBe(false);
    expect(sameHex("", "")).toBe(false);
    expect(sameHex("zz", "zz")).toBe(false);
    expect(sameHex(h.toUpperCase(), h)).toBe(true);
  });

  it("hashes with plain SHA-256", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("secretIssues", () => {
  it("reports a missing encryption key and a weak AUTH_SECRET without revealing values", () => {
    delete process.env.DATA_ENCRYPTION_KEY;
    process.env.AUTH_SECRET = "too-short-secret";
    const issues = secretIssues();
    expect(issues.some((i) => i.includes("DATA_ENCRYPTION_KEY"))).toBe(true);
    expect(issues.some((i) => i.includes("AUTH_SECRET"))).toBe(true);
    expect(issues.join(" ")).not.toContain("too-short-secret");
  });

  it("is empty when both secrets are strong", () => {
    process.env.AUTH_SECRET = randomBytes(48).toString("base64url");
    expect(secretIssues()).toEqual([]);
  });
});
