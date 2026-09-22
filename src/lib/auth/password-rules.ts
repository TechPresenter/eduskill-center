/**
 * The password rule, with no bcrypt import, so client components (the live checklist under a new
 * password) can share the exact checks the server enforces. `password.ts` re-exports both names.
 */
export const PASSWORD_MIN_LENGTH = 8;

/** Each rule on its own, in the order the UI lists them. */
export const PASSWORD_RULES: { id: "len" | "letter" | "number"; label: string; test: (v: string) => boolean }[] = [
  { id: "len", label: `${PASSWORD_MIN_LENGTH}+ characters`, test: (v) => v.length >= PASSWORD_MIN_LENGTH },
  { id: "letter", label: "a letter", test: (v) => /[A-Za-z]/.test(v) },
  { id: "number", label: "a number", test: (v) => /\d/.test(v) },
];

/** Returns a human readable problem with the password, or null when it is acceptable. */
export function passwordIssue(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (!/[A-Za-z]/.test(password)) return "Password must contain at least one letter";
  if (!/\d/.test(password)) return "Password must contain at least one number";
  return null;
}
