import { describe, expect, it } from "vitest";
import {
  TOTP_DIGITS,
  TOTP_PERIOD_SEC,
  base32Decode,
  base32Encode,
  formatTotpSecret,
  generateTotpSecret,
  hotp,
  otpauthUri,
  totpAt,
  totpStep,
  verifyTotp,
} from "@/lib/auth/totp";

/** RFC 6238 appendix B: the SHA-1 seed is the ASCII string "12345678901234567890". */
const RFC_SECRET_ASCII = "12345678901234567890";
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

/** A fixed moment so every window assertion is deterministic. */
const NOW = 1_759_400_000_000;

describe("base32", () => {
  it("encodes the RFC test seed to the published base32 secret and back", () => {
    expect(base32Encode(Buffer.from(RFC_SECRET_ASCII, "ascii"))).toBe(RFC_SECRET);
    expect(base32Decode(RFC_SECRET).toString("ascii")).toBe(RFC_SECRET_ASCII);
  });

  it("round-trips buffers of every length", () => {
    for (let len = 0; len <= 41; len++) {
      const buf = Buffer.from(Array.from({ length: len }, (_, i) => (i * 37 + len * 11) & 255));
      const encoded = base32Encode(buf);
      expect(encoded).toMatch(/^[A-Z2-7]*$/);
      expect(encoded.length).toBe(Math.ceil((len * 8) / 5));
      expect(base32Decode(encoded).equals(buf)).toBe(true);
    }
  });

  it("accepts lower case, spaces, dashes and padding, and refuses characters outside the alphabet", () => {
    expect(base32Decode("gezd gnbv-gy3t qojq====").toString("ascii")).toBe("1234567890");
    expect(() => base32Decode("GEZD1GNB")).toThrow(/base32/i);
    expect(() => base32Decode("GEZD8GNB")).toThrow(/base32/i);
  });

  it("generates 160-bit secrets", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(a).length).toBe(20);
    expect(a).not.toBe(b);
  });
});

describe("HOTP / TOTP (RFC 4226 / RFC 6238, SHA-1)", () => {
  it("matches the RFC 6238 SHA-1 test vectors (8 digits)", () => {
    expect(totpStep(59_000)).toBe(1);
    expect(hotp(RFC_SECRET, 1, 8)).toBe("94287082");
    expect(hotp(RFC_SECRET, totpStep(1_111_111_109_000), 8)).toBe("07081804");
    expect(hotp(RFC_SECRET, totpStep(1_111_111_111_000), 8)).toBe("14050471");
    expect(hotp(RFC_SECRET, totpStep(1_234_567_890_000), 8)).toBe("89005924");
    expect(hotp(RFC_SECRET, totpStep(2_000_000_000_000), 8)).toBe("69279037");
    expect(hotp(RFC_SECRET, totpStep(20_000_000_000_000), 8)).toBe("65353130");
  });

  it("matches the RFC 4226 HOTP vectors (6 digits, the authenticator-app format)", () => {
    const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
    expected.forEach((code, counter) => expect(hotp(RFC_SECRET, counter)).toBe(code));
    expect(totpAt(RFC_SECRET, 1)).toBe("287082");
    expect(TOTP_DIGITS).toBe(6);
    expect(TOTP_PERIOD_SEC).toBe(30);
  });

  it("puts a moment into its 30-second step", () => {
    expect(totpStep(0)).toBe(0);
    expect(totpStep(29_999)).toBe(0);
    expect(totpStep(30_000)).toBe(1);
    expect(totpStep(NOW)).toBe(Math.floor(NOW / 30_000));
  });
});

describe("verifyTotp", () => {
  const secret = RFC_SECRET;
  const now = totpStep(NOW);

  it("accepts the current code and one step either side, and returns the matched step", () => {
    expect(verifyTotp(secret, totpAt(secret, now), { nowMs: NOW })).toBe(now);
    expect(verifyTotp(secret, totpAt(secret, now - 1), { nowMs: NOW })).toBe(now - 1);
    expect(verifyTotp(secret, totpAt(secret, now + 1), { nowMs: NOW })).toBe(now + 1);
  });

  it("rejects codes two or more steps away, and honours a narrower window", () => {
    expect(verifyTotp(secret, totpAt(secret, now - 2), { nowMs: NOW })).toBeNull();
    expect(verifyTotp(secret, totpAt(secret, now + 2), { nowMs: NOW })).toBeNull();
    expect(verifyTotp(secret, totpAt(secret, now - 1), { nowMs: NOW, window: 0 })).toBeNull();
    expect(verifyTotp(secret, totpAt(secret, now), { nowMs: NOW, window: 0 })).toBe(now);
  });

  it("refuses a replay: a step at or before lastStep never verifies again", () => {
    const code = totpAt(secret, now);
    expect(verifyTotp(secret, code, { nowMs: NOW, lastStep: now })).toBeNull();
    expect(verifyTotp(secret, code, { nowMs: NOW, lastStep: now + 1 })).toBeNull();
    expect(verifyTotp(secret, totpAt(secret, now - 1), { nowMs: NOW, lastStep: now - 1 })).toBeNull();
    // A newer code than the last one used is still fine.
    expect(verifyTotp(secret, code, { nowMs: NOW, lastStep: now - 1 })).toBe(now);
    expect(verifyTotp(secret, totpAt(secret, now + 1), { nowMs: NOW, lastStep: now })).toBe(now + 1);
    expect(verifyTotp(secret, code, { nowMs: NOW, lastStep: null })).toBe(now);
  });

  it("tolerates spaces typed inside the code", () => {
    const code = totpAt(secret, now);
    expect(verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, { nowMs: NOW })).toBe(now);
  });

  it("rejects malformed codes without throwing", () => {
    for (const bad of ["", "12345", "1234567", "abcdef", "12345a", "-12345", "12.345", "１２３４５６"]) {
      expect(verifyTotp(secret, bad, { nowMs: NOW })).toBeNull();
    }
    // The 8-digit form of a valid code is not a 6-digit authenticator code.
    expect(verifyTotp(secret, hotp(secret, now, 8), { nowMs: NOW })).toBeNull();
  });

  it("does not accept a code generated for a different secret", () => {
    const other = generateTotpSecret();
    const code = totpAt(other, now);
    const own = [now - 1, now, now + 1].map((s) => totpAt(secret, s));
    if (!own.includes(code)) expect(verifyTotp(secret, code, { nowMs: NOW })).toBeNull();
  });
});

describe("otpauthUri / formatTotpSecret", () => {
  it("builds the otpauth:// URI authenticator apps read from the QR code", () => {
    const uri = otpauthUri({ issuer: "EduSkill Admin", account: "info@eduskillindia.com", secret: RFC_SECRET });
    expect(uri.startsWith("otpauth://totp/EduSkill%20Admin:info%40eduskillindia.com?")).toBe(true);
    const url = new URL(uri);
    expect(url.protocol).toBe("otpauth:");
    expect(url.host).toBe("totp");
    expect(decodeURIComponent(url.pathname.slice(1))).toBe("EduSkill Admin:info@eduskillindia.com");
    expect(url.searchParams.get("secret")).toBe(RFC_SECRET);
    expect(url.searchParams.get("issuer")).toBe("EduSkill Admin");
    expect(url.searchParams.get("algorithm")).toBe("SHA1");
    expect(url.searchParams.get("digits")).toBe("6");
    expect(url.searchParams.get("period")).toBe("30");
  });

  it("strips colons from the issuer and falls back to EduSkill when it is empty", () => {
    expect(new URL(otpauthUri({ issuer: "Edu:Skill", account: "a@b.co", secret: RFC_SECRET })).searchParams.get("issuer")).toBe("EduSkill");
    const fallback = new URL(otpauthUri({ issuer: " : ", account: "a@b.co", secret: RFC_SECRET }));
    expect(fallback.searchParams.get("issuer")).toBe("EduSkill");
    expect(decodeURIComponent(fallback.pathname.slice(1))).toBe("EduSkill:a@b.co");
  });

  it("groups the manual key in fours", () => {
    expect(formatTotpSecret(RFC_SECRET)).toBe("GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ");
    expect(formatTotpSecret("ABCDEF")).toBe("ABCD EF");
  });
});
