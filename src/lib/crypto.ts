import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Encryption at rest for secrets the platform must be able to read back: authenticator (TOTP)
 * secrets and the SMTP / provider credentials kept in Settings.
 *
 * AES-256-GCM with a key from DATA_ENCRYPTION_KEY — a dedicated server secret, deliberately NOT
 * AUTH_SECRET: AUTH_SECRET keys the one-time-code HMACs, and rotating it must never make every
 * enrolled authenticator undecryptable (which would lock every 2FA administrator out).
 *
 *   enc:v1:<iv>:<tag>:<ciphertext>      (base64url parts; v1 = this key, AES-256-GCM)
 *
 * Values that do not carry the prefix are legacy plaintext and are returned unchanged, so settings
 * saved before encryption was configured keep working until they are next saved.
 */

const PREFIX = "enc:v1:";

/** Known placeholder values from the example env files — never accepted as a real key. */
const PLACEHOLDERS = new Set(["replace-with-a-long-random-secret", "change-me", "changeme", "secret", "replace-me"]);

function dataKey(): Buffer | null {
  const raw = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (!raw || PLACEHOLDERS.has(raw.toLowerCase())) return null;
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  if (/^[A-Za-z0-9+/_-]{43,44}={0,2}$/.test(raw)) {
    const b = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    if (b.length === 32) return b;
  }
  // Any other long random string is accepted and stretched to 32 bytes.
  if (raw.length >= 32) return createHash("sha256").update(raw).digest();
  return null;
}

/** True when DATA_ENCRYPTION_KEY is set to a usable value. 2FA set-up refuses to start without it. */
export function isEncryptionConfigured(): boolean {
  return dataKey() !== null;
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Encrypts a UTF-8 string. Throws when no key is configured — callers decide whether to fall back. */
export function encryptSecret(plain: string): string {
  const key = dataKey();
  if (!key) throw new Error("DATA_ENCRYPTION_KEY is not configured");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ct.toString("base64url")}`;
}

/** Decrypts an `enc:v1:` value; any other string is legacy plaintext and comes back as is. */
export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) return value;
  const key = dataKey();
  if (!key) throw new Error("DATA_ENCRYPTION_KEY is not configured, so a stored secret cannot be read");
  const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || ctB64 === undefined) throw new Error("Malformed encrypted value");
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  // A shortened tag would weaken the forgery check (GCM accepts 4-byte tags unless told otherwise).
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Malformed encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}

function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 8) throw new Error("AUTH_SECRET is not configured");
  return s;
}

/**
 * Keyed one-way hash (HMAC-SHA256 under AUTH_SECRET) for values that are only ever compared:
 * one-time codes, backup codes, rate-limit identifiers. `label` separates the purposes so a hash
 * from one flow can never satisfy another.
 */
export function keyedHash(label: string, value: string): string {
  return createHmac("sha256", authSecret()).update(`${label}:${value}`).digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function sameHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length > 0 && ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Plain SHA-256 hex (for random tokens that are already unguessable). */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Problems with the server secrets, for the Security Center status panel. Never includes values. */
export function secretIssues(): string[] {
  const issues: string[] = [];
  const auth = process.env.AUTH_SECRET ?? "";
  if (auth.length < 32 || PLACEHOLDERS.has(auth.toLowerCase())) issues.push("AUTH_SECRET is missing, short or a placeholder. Set at least 32 random characters on the server.");
  if (!isEncryptionConfigured()) issues.push("DATA_ENCRYPTION_KEY is not set. Two-factor authentication cannot be set up and saved passwords are stored unencrypted.");
  return issues;
}
