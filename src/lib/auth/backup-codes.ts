import { randomInt } from "node:crypto";
import { keyedHash } from "@/lib/crypto";

/**
 * Single-use recovery codes for an administrator who has lost their authenticator.
 * Shown once, stored only as a keyed hash bound to the user.
 */

export const BACKUP_CODE_COUNT = 10;

/** No 0/O, 1/I/L: the codes are read off paper and typed by hand. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function group(len: number) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(0, ALPHABET.length)];
  return s;
}

/** `XXXX-XXXX` codes (about 39 bits each). */
export function generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(`${group(4)}-${group(4)}`);
  return [...codes];
}

/** Upper-cases and strips spaces and dashes, so "abcd efgh" and "ABCD-EFGH" are the same code. */
export function normalizeBackupCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function looksLikeBackupCode(input: string): boolean {
  return /^[A-Z0-9]{8}$/.test(normalizeBackupCode(input));
}

export function hashBackupCode(userId: string, code: string): string {
  return keyedHash("backup-code", `${userId}:${normalizeBackupCode(code)}`);
}
