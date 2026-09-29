/**
 * Phone numbers — parsing, validation and E.164, with no npm dependency.
 *
 * ## What is stored
 *
 * Every phone number written from here on is stored as **E.164**: a leading `+`, the country calling
 * code, then the national significant number, digits only (`+919876543210`). That is one canonical
 * string per phone, which is what `User.mobile @unique` needs in order to mean "one account per
 * phone", and it is what `tel:` links, `wa.me` links, MSG91 and the WhatsApp Cloud API all want.
 *
 * Rows written before this change hold **bare national digits** (`9876543210`) and were always
 * Indian — the platform had no country concept at all. `mobileVariants()` exists so a lookup matches
 * either spelling, which is what lets new writes switch format without rewriting a single old row.
 *
 * ## How honest the validation is
 *
 * India is validated **exactly**: `/^[6-9]\d{9}$/` is the real allocated mobile range, and it is the
 * same regex this codebase has always used. Every other country is validated by national-number
 * **length and leading digits**, which rejects typos, wrong-length numbers and landlines-typed-as-
 * mobiles, but not an unallocated carrier prefix inside an otherwise plausible range.
 *
 * That last percent is what libphonenumber's ~145 kB of metadata buys. It is not worth it here: the
 * table below is ~4 kB, it lands in the client bundle of every public form, and >99% of this
 * platform's users are Indian — the one country we can validate precisely. Say so in the UI hint
 * rather than implying more rigour than there is.
 *
 * Adding a country is one row. Nothing else in the codebase knows about countries.
 */

/** A country we accept phone numbers from. */
export interface Country {
  /** ISO 3166-1 alpha-2 — the stable key, and what the UI shows next to the dial code. */
  iso2: string;
  name: string;
  /** Country calling code, no `+`. */
  dial: string;
  /** National significant number: the digits after the dial code, trunk prefix already removed. */
  nsn: RegExp;
  /** Longest NSN this country allows, for the input's `maxLength`. Asserted against `nsn` in tests. */
  nsnMax: number;
  /** A real, correctly grouped example — used as the placeholder and inside the error message. */
  example: string;
  /** Display grouping for `formatPhone`. Digits left over after the last group stay together. */
  groups: number[];
  /** National trunk prefix, dropped when someone pastes a nationally formatted number. */
  trunk?: string;
}

export const DEFAULT_ISO2 = "IN";

/**
 * India first (the default and the overwhelming majority), then alphabetical by name.
 *
 * The set is the Indian diaspora's real destinations plus the large economies — deliberately not all
 * 240 dialling codes, because every row is a maintenance claim about a numbering plan that can
 * change. An unlisted country is a one-line addition here.
 */
export const COUNTRIES: readonly Country[] = [
  { iso2: "IN", name: "India", dial: "91", nsn: /^[6-9]\d{9}$/, nsnMax: 10, example: "98765 43210", groups: [5, 5], trunk: "0" },
  { iso2: "AU", name: "Australia", dial: "61", nsn: /^4\d{8}$/, nsnMax: 9, example: "412 345 678", groups: [3, 3, 3], trunk: "0" },
  { iso2: "BH", name: "Bahrain", dial: "973", nsn: /^3\d{7}$/, nsnMax: 8, example: "3600 1234", groups: [4, 4] },
  { iso2: "BD", name: "Bangladesh", dial: "880", nsn: /^1[3-9]\d{8}$/, nsnMax: 10, example: "1712 345678", groups: [4, 6], trunk: "0" },
  { iso2: "BT", name: "Bhutan", dial: "975", nsn: /^1[7-8]\d{6}$/, nsnMax: 8, example: "17 12 3456", groups: [2, 2, 4] },
  { iso2: "BR", name: "Brazil", dial: "55", nsn: /^\d{2}9\d{8}$/, nsnMax: 11, example: "11 91234 5678", groups: [2, 5, 4], trunk: "0" },
  { iso2: "CA", name: "Canada", dial: "1", nsn: /^[2-9]\d{2}[2-9]\d{6}$/, nsnMax: 10, example: "416 555 0123", groups: [3, 3, 4], trunk: "1" },
  { iso2: "CN", name: "China", dial: "86", nsn: /^1[3-9]\d{9}$/, nsnMax: 11, example: "138 0013 8000", groups: [3, 4, 4], trunk: "0" },
  { iso2: "EG", name: "Egypt", dial: "20", nsn: /^1[0125]\d{8}$/, nsnMax: 10, example: "100 123 4567", groups: [3, 3, 4], trunk: "0" },
  { iso2: "FR", name: "France", dial: "33", nsn: /^[67]\d{8}$/, nsnMax: 9, example: "6 12 34 56 78", groups: [1, 2, 2, 2, 2], trunk: "0" },
  { iso2: "DE", name: "Germany", dial: "49", nsn: /^1[5-7]\d{7,9}$/, nsnMax: 11, example: "151 23456789", groups: [3, 8], trunk: "0" },
  { iso2: "HK", name: "Hong Kong", dial: "852", nsn: /^[4-9]\d{7}$/, nsnMax: 8, example: "5123 4567", groups: [4, 4] },
  { iso2: "ID", name: "Indonesia", dial: "62", nsn: /^8\d{8,10}$/, nsnMax: 11, example: "812 345 6789", groups: [3, 3, 4], trunk: "0" },
  { iso2: "IE", name: "Ireland", dial: "353", nsn: /^8[35-9]\d{7}$/, nsnMax: 9, example: "85 123 4567", groups: [2, 3, 4], trunk: "0" },
  { iso2: "IL", name: "Israel", dial: "972", nsn: /^5\d{8}$/, nsnMax: 9, example: "50 123 4567", groups: [2, 3, 4], trunk: "0" },
  { iso2: "IT", name: "Italy", dial: "39", nsn: /^3\d{8,9}$/, nsnMax: 10, example: "312 345 6789", groups: [3, 3, 4] },
  { iso2: "JP", name: "Japan", dial: "81", nsn: /^[789]0\d{8}$/, nsnMax: 10, example: "90 1234 5678", groups: [2, 4, 4], trunk: "0" },
  { iso2: "KE", name: "Kenya", dial: "254", nsn: /^[17]\d{8}$/, nsnMax: 9, example: "712 345678", groups: [3, 6], trunk: "0" },
  { iso2: "KW", name: "Kuwait", dial: "965", nsn: /^[569]\d{7}$/, nsnMax: 8, example: "500 12345", groups: [3, 5] },
  { iso2: "MY", name: "Malaysia", dial: "60", nsn: /^1\d{8,9}$/, nsnMax: 10, example: "12 345 6789", groups: [2, 3, 4], trunk: "0" },
  { iso2: "MV", name: "Maldives", dial: "960", nsn: /^[79]\d{6}$/, nsnMax: 7, example: "771 2345", groups: [3, 4] },
  { iso2: "MU", name: "Mauritius", dial: "230", nsn: /^5\d{7}$/, nsnMax: 8, example: "5251 2345", groups: [4, 4] },
  { iso2: "MX", name: "Mexico", dial: "52", nsn: /^[1-9]\d{9}$/, nsnMax: 10, example: "55 1234 5678", groups: [2, 4, 4] },
  { iso2: "NP", name: "Nepal", dial: "977", nsn: /^9[678]\d{8}$/, nsnMax: 10, example: "984 123 4567", groups: [3, 3, 4] },
  { iso2: "NL", name: "Netherlands", dial: "31", nsn: /^6\d{8}$/, nsnMax: 9, example: "6 12345678", groups: [1, 8], trunk: "0" },
  { iso2: "NZ", name: "New Zealand", dial: "64", nsn: /^2\d{7,9}$/, nsnMax: 10, example: "21 123 4567", groups: [2, 3, 4], trunk: "0" },
  { iso2: "NG", name: "Nigeria", dial: "234", nsn: /^[789]\d{9}$/, nsnMax: 10, example: "802 123 4567", groups: [3, 3, 4], trunk: "0" },
  { iso2: "NO", name: "Norway", dial: "47", nsn: /^[49]\d{7}$/, nsnMax: 8, example: "406 12 345", groups: [3, 2, 3] },
  { iso2: "OM", name: "Oman", dial: "968", nsn: /^[79]\d{7}$/, nsnMax: 8, example: "9212 3456", groups: [4, 4] },
  { iso2: "PK", name: "Pakistan", dial: "92", nsn: /^3\d{9}$/, nsnMax: 10, example: "300 1234567", groups: [3, 7], trunk: "0" },
  { iso2: "PH", name: "Philippines", dial: "63", nsn: /^9\d{9}$/, nsnMax: 10, example: "917 123 4567", groups: [3, 3, 4], trunk: "0" },
  { iso2: "PL", name: "Poland", dial: "48", nsn: /^[45-8]\d{8}$/, nsnMax: 9, example: "512 345 678", groups: [3, 3, 3] },
  { iso2: "PT", name: "Portugal", dial: "351", nsn: /^9[1236]\d{7}$/, nsnMax: 9, example: "912 345 678", groups: [3, 3, 3] },
  { iso2: "QA", name: "Qatar", dial: "974", nsn: /^[3567]\d{7}$/, nsnMax: 8, example: "3312 3456", groups: [4, 4] },
  { iso2: "RU", name: "Russia", dial: "7", nsn: /^9\d{9}$/, nsnMax: 10, example: "912 345 67 89", groups: [3, 3, 2, 2], trunk: "8" },
  { iso2: "SA", name: "Saudi Arabia", dial: "966", nsn: /^5\d{8}$/, nsnMax: 9, example: "50 123 4567", groups: [2, 3, 4], trunk: "0" },
  { iso2: "SG", name: "Singapore", dial: "65", nsn: /^[89]\d{7}$/, nsnMax: 8, example: "8123 4567", groups: [4, 4] },
  { iso2: "ZA", name: "South Africa", dial: "27", nsn: /^[6-8]\d{8}$/, nsnMax: 9, example: "71 123 4567", groups: [2, 3, 4], trunk: "0" },
  { iso2: "KR", name: "South Korea", dial: "82", nsn: /^1[016-9]\d{7,8}$/, nsnMax: 10, example: "10 1234 5678", groups: [2, 4, 4], trunk: "0" },
  { iso2: "ES", name: "Spain", dial: "34", nsn: /^[67]\d{8}$/, nsnMax: 9, example: "612 345 678", groups: [3, 3, 3] },
  { iso2: "LK", name: "Sri Lanka", dial: "94", nsn: /^7[0-8]\d{7}$/, nsnMax: 9, example: "71 234 5678", groups: [2, 3, 4], trunk: "0" },
  { iso2: "SE", name: "Sweden", dial: "46", nsn: /^7[02369]\d{7}$/, nsnMax: 9, example: "70 123 4567", groups: [2, 3, 4], trunk: "0" },
  { iso2: "TZ", name: "Tanzania", dial: "255", nsn: /^[67]\d{8}$/, nsnMax: 9, example: "621 234 567", groups: [3, 3, 3], trunk: "0" },
  { iso2: "TH", name: "Thailand", dial: "66", nsn: /^[689]\d{8}$/, nsnMax: 9, example: "81 234 5678", groups: [2, 3, 4], trunk: "0" },
  { iso2: "TR", name: "Türkiye", dial: "90", nsn: /^5\d{9}$/, nsnMax: 10, example: "501 234 5678", groups: [3, 3, 4], trunk: "0" },
  { iso2: "AE", name: "United Arab Emirates", dial: "971", nsn: /^5[024568]\d{7}$/, nsnMax: 9, example: "50 123 4567", groups: [2, 3, 4], trunk: "0" },
  { iso2: "GB", name: "United Kingdom", dial: "44", nsn: /^7[1-9]\d{8}$/, nsnMax: 10, example: "7400 123456", groups: [4, 6], trunk: "0" },
  { iso2: "US", name: "United States", dial: "1", nsn: /^[2-9]\d{2}[2-9]\d{6}$/, nsnMax: 10, example: "415 555 0123", groups: [3, 3, 4], trunk: "1" },
];

/**
 * Which country wins when several share a dial code. `+1` is the North American Numbering Plan (US,
 * Canada and 20 Caribbean states) and `+7` is Russia and Kazakhstan, so re-opening a saved Canadian
 * number shows "United States". Cosmetic only — the stored E.164 and the dialling are both correct.
 */
const SHARED_DIAL_PRIMARY: Record<string, string> = { "1": "US", "7": "RU" };

const BY_ISO2 = new Map(COUNTRIES.map((c) => [c.iso2, c]));

/** Dial code → country, honouring SHARED_DIAL_PRIMARY. Built once. */
const BY_DIAL = (() => {
  const m = new Map<string, Country>();
  for (const c of COUNTRIES) {
    const primary = SHARED_DIAL_PRIMARY[c.dial];
    if (primary ? primary === c.iso2 : !m.has(c.dial)) m.set(c.dial, c);
  }
  return m;
})();

/** Longest dial code in the table, so prefix matching knows where to start. */
const MAX_DIAL_LEN = Math.max(...COUNTRIES.map((c) => c.dial.length));

export function countryByIso2(iso2: string | null | undefined): Country | undefined {
  return iso2 ? BY_ISO2.get(iso2.toUpperCase()) : undefined;
}

function defaultCountry(iso2?: string | null): Country {
  return countryByIso2(iso2) ?? BY_ISO2.get(DEFAULT_ISO2)!;
}

/** Longest dial-code prefix match over a digit string. `919876543210` → India. */
function countryFromDigits(digits: string): Country | undefined {
  for (let len = Math.min(MAX_DIAL_LEN, digits.length); len >= 1; len--) {
    const c = BY_DIAL.get(digits.slice(0, len));
    if (c) return c;
  }
  return undefined;
}

/** The country an E.164 string belongs to. `+919876543210` → India, `+971…` → AE (not `+97…`). */
export function countryFromE164(e164: string | null | undefined): Country | undefined {
  if (!e164) return undefined;
  const s = e164.trim();
  if (!s.startsWith("+")) return undefined;
  return countryFromDigits(s.slice(1).replace(/\D/g, ""));
}

export type ParseResult =
  | { ok: true; e164: string; country: Country; national: string }
  | { ok: false; message: string };

function invalidFor(c: Country): string {
  return `Enter a valid mobile number for ${c.name} (e.g. ${c.example})`;
}

/** Does `nsn` fit this country, allowing for a trunk prefix the caller left on? Returns the NSN. */
function acceptNsn(c: Country, nsn: string): string | null {
  if (c.nsn.test(nsn)) return nsn;
  if (c.trunk && nsn.startsWith(c.trunk)) {
    const stripped = nsn.slice(c.trunk.length);
    if (c.nsn.test(stripped)) return stripped;
  }
  return null;
}

/**
 * Reads any spelling a human or an old database row might hold, and returns E.164.
 *
 * Accepted: `9876543210`, `98765 43210`, `+91 98765 43210`, `919876543210`, `09876543210`,
 * `0091 98765 43210`, `+1 415 555 0123`. A number with no `+` and no recognisable country code is
 * read as `defaultIso2` (India unless told otherwise) — which is exactly how every existing row and
 * every existing form submission has to be read.
 *
 * **Idempotent**: `parsePhone(parsePhone(x).e164)` gives the same `e164` back. `login-otp.ts`
 * compares a stored number against a typed one by normalising both, so this is load-bearing, and
 * `tests/phone.test.ts` asserts it.
 *
 * Never throws. Junk (an email address, `""`, `"0"`) comes back as `{ ok: false }`.
 */
export function parsePhone(raw: string | null | undefined, defaultIso2?: string | null): ParseResult {
  const fallback = defaultCountry(defaultIso2);
  const s = (raw ?? "").trim();
  if (!s) return { ok: false, message: "Enter a mobile number" };

  // `+` or a `00` / `011` exit code means the caller has declared a country code.
  const international = /^\+/.test(s) || /^00\d/.test(s) || /^011\d/.test(s);
  let digits = s.replace(/\D/g, "");
  if (!digits) return { ok: false, message: invalidFor(fallback) };
  if (international && !s.startsWith("+")) digits = digits.replace(/^(00|011)/, "");

  if (international) {
    const c = countryFromDigits(digits);
    if (!c) return { ok: false, message: "We do not recognise that country code. Please pick the country from the list." };
    const nsn = acceptNsn(c, digits.slice(c.dial.length));
    if (!nsn) return { ok: false, message: invalidFor(c) };
    return { ok: true, e164: `+${c.dial}${nsn}`, country: c, national: nsn };
  }

  // No country code declared: read it as the default country. Try the digits as a national number
  // first, so a national number that happens to start with its own dial code is not mangled.
  const direct = acceptNsn(fallback, digits);
  if (direct) return { ok: true, e164: `+${fallback.dial}${direct}`, country: fallback, national: direct };

  if (digits.startsWith(fallback.dial)) {
    const nsn = acceptNsn(fallback, digits.slice(fallback.dial.length));
    if (nsn) return { ok: true, e164: `+${fallback.dial}${nsn}`, country: fallback, national: nsn };
  }

  return { ok: false, message: invalidFor(fallback) };
}

/** `toE164(x)` = the E.164 string, or `""` when `x` is not a phone number at all. Never throws. */
export function toE164(raw: string | null | undefined, defaultIso2?: string | null): string {
  const r = parsePhone(raw, defaultIso2);
  return r.ok ? r.e164 : "";
}

/** `+919876543210` → `{ country: IN, national: "9876543210" }`, or `null`. For re-opening a saved value. */
export function fromE164(e164: string | null | undefined): { country: Country; national: string } | null {
  const r = parsePhone(e164);
  return r.ok ? { country: r.country, national: r.national } : null;
}

/** Groups an NSN for display: `9876543210` + `[5,5]` → `98765 43210`. Leftover digits stay together. */
export function formatNational(country: Country, national: string): string {
  const out: string[] = [];
  let i = 0;
  for (const g of country.groups) {
    if (i >= national.length) break;
    out.push(national.slice(i, i + g));
    i += g;
  }
  if (i < national.length) out.push(national.slice(i));
  return out.join(" ");
}

/**
 * `+919876543210` → `+91 98765 43210`, for read-only display. Anything that does not parse is
 * returned unchanged, so a legacy or hand-edited row still shows what it holds rather than "".
 */
export function formatPhone(value: string | null | undefined): string {
  const r = parsePhone(value);
  if (!r.ok) return (value ?? "").trim();
  return `+${r.country.dial} ${formatNational(r.country, r.national)}`;
}

/**
 * Every spelling this number could be **stored** as, for an `{ in: … }` query.
 *
 * New writes are E.164. Rows written before this change hold bare national digits, and they were
 * always Indian — the platform had no country concept, so no foreign number was ever stored bare.
 * The national spellings are therefore offered only for the default country: widening them to every
 * country would let one country's national number collide with another's, and two of these queries
 * (`lookupTrainerApplication`, `lookupCentreApplication`) treat the mobile as a shared secret.
 *
 * Returns `[]` for anything that is not a phone number, which makes `{ in: [] }` match nothing —
 * the right answer for a lookup by junk.
 *
 * Phase 3 (the E.164 backfill) narrows this to a single element and hands uniqueness back to the
 * database. Until then the application is the only thing enforcing one account per phone, so every
 * exact-match predicate must go through here.
 */
export function mobileVariants(raw: string | null | undefined): string[] {
  const r = parsePhone(raw);
  if (!r.ok) return [];
  const out = [r.e164, `${r.country.dial}${r.national}`];
  if (r.country.iso2 === DEFAULT_ISO2) {
    out.push(r.national);
    if (r.country.trunk) out.push(`${r.country.trunk}${r.national}`);
  }
  return [...new Set(out)];
}

/**
 * The validation message for a number, or `null` when it is fine — for client-side checks that gate
 * a wizard step or paint a field red before the request is sent. Same rule and same wording as the
 * server's `phoneSchema`, because it is the same parser.
 */
export function phoneIssue(raw: string | null | undefined, defaultIso2?: string | null): string | null {
  const r = parsePhone(raw, defaultIso2);
  return r.ok ? null : r.message;
}

/** True when two stored or typed numbers are the same phone, whatever spelling each is in. */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.trim() === b.trim()) return true;
  const pa = parsePhone(a);
  const pb = parsePhone(b);
  return pa.ok && pb.ok && pa.e164 === pb.e164;
}

/** Digits only, `+` dropped — the shape MSG91 and the WhatsApp Cloud API want (`919876543210`). */
export function toDialDigits(value: string | null | undefined): string {
  const r = parsePhone(value);
  if (r.ok) return `${r.country.dial}${r.national}`;
  return (value ?? "").replace(/\D/g, "");
}
