import { describe, expect, it } from "vitest";
import {
  COUNTRIES,
  DEFAULT_ISO2,
  countryByIso2,
  countryFromE164,
  formatPhone,
  fromE164,
  mobileVariants,
  parsePhone,
  samePhone,
  toDialDigits,
  toE164,
} from "@/lib/phone";

const IN = "+919876543210";

describe("phone: the country table itself", () => {
  it("holds a usable set with India first and no duplicate keys", () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(40);
    expect(COUNTRIES[0].iso2).toBe(DEFAULT_ISO2);
    expect(new Set(COUNTRIES.map((c) => c.iso2)).size).toBe(COUNTRIES.length);
  });

  // The guard against nsn/nsnMax/example drifting apart as rows are added.
  it.each(COUNTRIES.map((c) => [c.iso2, c] as const))("%s has an example that its own rule accepts", (_iso2, c) => {
    const digits = c.example.replace(/\D/g, "");
    expect(c.nsn.test(digits), `${c.iso2} example "${c.example}" fails its own nsn`).toBe(true);
    expect(digits.length, `${c.iso2} example is longer than nsnMax`).toBeLessThanOrEqual(c.nsnMax);
    expect(c.dial).toMatch(/^\d{1,3}$/);
    // E.164 is 15 digits at most, dial code included.
    expect(c.dial.length + c.nsnMax).toBeLessThanOrEqual(15);
  });

  it("round-trips every country's own example through parse and format", () => {
    for (const c of COUNTRIES) {
      const digits = c.example.replace(/\D/g, "");
      const r = parsePhone(`+${c.dial}${digits}`);
      expect(r.ok, `${c.iso2} example did not parse`).toBe(true);
      if (!r.ok) continue;
      // A shared dial code (+1 = US/CA, +7 = RU/KZ) resolves to the documented primary, so assert
      // the dial code round-trips rather than the country.
      expect(r.country.dial, `${c.iso2} resolved to a different dial code`).toBe(c.dial);
      expect(r.national).toBe(digits);
      expect(r.e164).toBe(`+${c.dial}${digits}`);
    }
  });
});

describe("phone: parsing Indian numbers, every spelling a user or an old row can hold", () => {
  it.each([
    ["9876543210", "bare national — what every pre-migration row holds"],
    ["98765 43210", "grouped"],
    ["98765-43210", "hyphenated"],
    ["+919876543210", "E.164"],
    ["+91 98765 43210", "E.164, spaced"],
    ["+91-9876543210", "E.164, hyphenated"],
    ["919876543210", "dial code, no plus — what the SMS layer builds"],
    ["09876543210", "national trunk prefix"],
    ["0091 98765 43210", "00 exit code"],
    [" 9876543210 ", "padded"],
  ])("%s → +919876543210 (%s)", (input) => {
    const r = parsePhone(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.e164).toBe(IN);
      expect(r.country.iso2).toBe("IN");
      expect(r.national).toBe("9876543210");
    }
  });

  it.each([
    ["5876543210", "Indian mobiles start 6-9"],
    ["1234567890", "not an allocated range"],
    ["98765", "too short"],
    ["98765432101", "too long"],
    ["0", "the junk tests/auth.test.ts writes"],
    ["", "empty"],
    ["   ", "whitespace"],
    ["asha@test.local", "an email address, which login() passes in"],
    ["abc", "letters"],
    ["+999123456789", "unknown country code"],
  ])("rejects %s (%s)", (input) => {
    const r = parsePhone(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message.length).toBeGreaterThan(0);
  });

  it("never throws and returns an empty string from toE164 for junk", () => {
    for (const junk of ["", "0", "abc", "asha@test.local", null, undefined]) {
      expect(() => toE164(junk)).not.toThrow();
      expect(toE164(junk)).toBe("");
    }
  });
});

describe("phone: idempotence — login-otp.ts compares a stored number to a typed one this way", () => {
  it.each(["9876543210", "+91 98765 43210", "09876543210", "919876543210", "+971501234567", "+14155550123", "+447400123456"])(
    "parsePhone is stable on its own output for %s",
    (input) => {
      const first = parsePhone(input);
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      const second = parsePhone(first.e164);
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.e164).toBe(first.e164);
      // And once more, because "stable after two passes" is the property the comparison needs.
      expect(toE164(second.e164)).toBe(first.e164);
    }
  );

  it("normalising both sides makes every spelling of one number compare equal", () => {
    const spellings = ["9876543210", "98765 43210", "+919876543210", "+91 98765 43210", "919876543210", "09876543210"];
    for (const a of spellings) for (const b of spellings) expect(samePhone(a, b), `${a} vs ${b}`).toBe(true);
    expect(samePhone("9876543210", "9876543211")).toBe(false);
    expect(samePhone("9876543210", null)).toBe(false);
    expect(samePhone(null, null)).toBe(false);
    // Two different countries' numbers are never the same phone, even at equal length.
    expect(samePhone("+14155550123", "+919876543210")).toBe(false);
  });
});

describe("phone: international numbers", () => {
  it.each([
    ["+971 50 123 4567", "AE", "+971501234567"],
    ["+1 415 555 0123", "US", "+14155550123"],
    ["+44 7400 123456", "GB", "+447400123456"],
    ["+44 (0) 7400 123456", "GB", "+447400123456"],
    ["+966 50 123 4567", "SA", "+966501234567"],
    ["+65 8123 4567", "SG", "+6581234567"],
    ["+977 984 123 4567", "NP", "+9779841234567"],
    ["00971501234567", "AE", "+971501234567"],
  ])("%s → %s %s", (input, iso2, e164) => {
    const r = parsePhone(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.country.iso2).toBe(iso2);
      expect(r.e164).toBe(e164);
    }
  });

  it.each([
    ["+971 40 123 4567", "AE — 40 is not a mobile prefix"],
    ["+44 1234 567890", "GB — landline, not 7x"],
    ["+1 115 555 0123", "US — area code cannot start with 1"],
    ["+65 1234 5678", "SG — mobiles are 8 or 9"],
  ])("rejects %s (%s)", (input) => {
    expect(parsePhone(input).ok).toBe(false);
  });

  it("reads a bare number as the selected country, not as India", () => {
    const r = parsePhone("501234567", "AE");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.e164).toBe("+971501234567");
    // The same digits are not a valid Indian number, so the India default rejects them.
    expect(parsePhone("501234567").ok).toBe(false);
  });

  it("strips a national trunk prefix per country", () => {
    expect(toE164("07400123456", "GB")).toBe("+447400123456");
    expect(toE164("0412345678", "AU")).toBe("+61412345678");
    expect(toE164("89123456789", "RU")).toBe("+79123456789");
  });

  it("matches the longest dial code, not the shortest", () => {
    expect(countryFromE164("+971501234567")?.iso2).toBe("AE");
    expect(countryFromE164("+919876543210")?.iso2).toBe("IN");
    expect(countryFromE164("+9779841234567")?.iso2).toBe("NP");
    expect(countryFromE164("+94712345678")?.iso2).toBe("LK");
    expect(countryFromE164("9876543210")).toBeUndefined();
  });

  it("resolves a shared dial code to one documented country", () => {
    expect(countryFromE164("+14155550123")?.iso2).toBe("US");
    expect(countryFromE164("+79123456789")?.iso2).toBe("RU");
    expect(countryByIso2("ca")?.dial).toBe("1");
  });
});

describe("phone: mobileVariants — the only thing keeping old rows findable", () => {
  it("offers E.164 first, then the legacy Indian spellings", () => {
    const v = mobileVariants("9876543210");
    expect(v[0]).toBe(IN);
    expect(v).toContain("919876543210");
    expect(v).toContain("9876543210");
    expect(v).toContain("09876543210");
    expect(new Set(v).size).toBe(v.length);
  });

  it("gives the same set for every spelling of the same number", () => {
    const expected = mobileVariants("9876543210").sort();
    for (const spelling of ["+919876543210", "+91 98765 43210", "919876543210", "09876543210", "98765-43210"]) {
      expect(mobileVariants(spelling).sort(), spelling).toEqual(expected);
    }
  });

  it("does not offer a bare national spelling for a foreign number", () => {
    // No foreign number was ever stored bare, and offering "501234567" would let one country's
    // national number collide with another's inside a public status lookup.
    const v = mobileVariants("+971501234567");
    expect(v).toEqual(["+971501234567", "971501234567"]);
    expect(v).not.toContain("501234567");
  });

  it("returns an empty list for junk, so { in: [] } matches nothing", () => {
    for (const junk of ["", "0", "abc", "asha@test.local", null, undefined]) expect(mobileVariants(junk)).toEqual([]);
  });
});

describe("phone: display and dispatch helpers", () => {
  it("formats for display and leaves unparseable values alone", () => {
    expect(formatPhone(IN)).toBe("+91 98765 43210");
    expect(formatPhone("9876543210")).toBe("+91 98765 43210");
    expect(formatPhone("+971501234567")).toBe("+971 50 123 4567");
    expect(formatPhone("not a number")).toBe("not a number");
    expect(formatPhone(null)).toBe("");
  });

  it("gives the SMS/WhatsApp layer digits with the country code and no plus", () => {
    expect(toDialDigits(IN)).toBe("919876543210");
    expect(toDialDigits("9876543210")).toBe("919876543210");
    expect(toDialDigits("+971501234567")).toBe("971501234567");
    // A stale row that parses as nothing still sends whatever digits it holds.
    expect(toDialDigits("12345")).toBe("12345");
  });

  it("splits a stored value back into country + national for an edit form", () => {
    expect(fromE164(IN)).toMatchObject({ national: "9876543210" });
    expect(fromE164(IN)?.country.iso2).toBe("IN");
    expect(fromE164("9876543210")?.country.iso2).toBe("IN");
    expect(fromE164("+971501234567")?.country.iso2).toBe("AE");
    expect(fromE164("nonsense")).toBeNull();
  });
});
