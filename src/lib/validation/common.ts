import { z } from "zod";
import { parsePhone } from "@/lib/phone";

export const uuid = z.string().uuid("Invalid id");
export const optionalString = z.string().trim().max(2000).optional().nullable();

/**
 * A phone number, validated against the selected country's rule and **normalised to E.164**
 * (`+919876543210`) — one canonical string for the database to store, for `User.mobile @unique` to
 * mean "one account per phone", and for every service to compare without re-normalising.
 *
 * Accepts a bare 10-digit Indian number (what every existing form submission and every pre-selector
 * client sends), a `+`-prefixed international number, `919876543210`, `09876543210`, and its own
 * output. Per-country rules live in `COUNTRIES` in `@/lib/phone`, never here — adding a country is
 * one table row.
 *
 * Note that this **transforms**: the service layer receives E.164, not what the user typed. That is
 * why `normalizeMobile` has to be idempotent.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const r = parsePhone(v);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.message });
      return z.NEVER;
    }
    return r.e164;
  });

/**
 * Back-compat name for `phoneSchema`, kept so the fourteen existing import sites read naturally.
 * There is exactly one phone rule in this codebase and this is it.
 */
export const mobileSchema = phoneSchema;

/**
 * An optional phone number. `""` and `null` both collapse to `null` (the column is cleared);
 * `undefined` stays `undefined`, so a partial update that omits the field still means "leave it
 * alone" rather than "clear it", and the key stays optional in the inferred type.
 */
export const optionalPhone = z
  .union([z.literal(""), phoneSchema])
  .nullable()
  .transform((v) => v || null)
  // Outermost, so Zod still reports the key as optional; `undefined` never reaches the transform.
  .optional();
/**
 * A block (tehsil / taluka / mandal) typed by the person filling a form. Most districts have no
 * Block rows yet, so forms let people type the name; the server finds the block in that district
 * (case-insensitively) or adds it — see `resolveBlockId` in src/server/locations.ts. Letters (any
 * script), digits, spaces and . - ( ) ' & / only, so it cannot carry markup or odd control text.
 */
export const blockNameSchema = z
  .string()
  .trim()
  // NFC: a nukta typed precomposed (ज़) or as letter + combining nukta is the same name.
  .transform((v) => v.normalize("NFC").replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(2, "Enter your block name")
      .max(80, "Block name is too long")
      .regex(/^[\p{L}\p{M}\p{N} .\-()'&/]+$/u, "Use letters, numbers and spaces only")
      // A name, not punctuation ("..", "--") — and no stacked combining marks ("Zalgo" text) that
      // would spill over neighbouring rows. Four in a row, not three: real Devanagari such as ज़ीं
      // is consonant + nukta + vowel sign + anusvara.
      .refine((v) => (v.match(/\p{L}/gu)?.length ?? 0) >= 2, "Enter your block name")
      .refine((v) => !/\p{M}{4,}/u.test(v), "Use letters, numbers and spaces only")
  );
/** `""` and `null` mean "not given". */
export const optionalBlockName = z.union([z.literal(""), blockNameSchema]).optional().nullable().transform((v) => v || undefined);

export const pincodeSchema = z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code");
export const emailSchema = z.email("Enter a valid email address");
export const optionalEmail = z.union([z.literal(""), emailSchema]).optional().nullable();
export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").transform((v) => new Date(`${v}T00:00:00.000Z`));
export const optionalDateString = z.union([z.literal(""), dateString]).optional().nullable().transform((v) => (v ? v : null));
export const money = z.coerce.number().min(0, "Cannot be negative").max(10_000_000);
export const stringList = z.array(z.string().trim().min(1).max(100)).max(50);
export const boolish = z.union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("on"), z.literal("1"), z.literal("0")]).transform((v) => v === true || v === "true" || v === "on" || v === "1");
export const slugSchema = z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only");
