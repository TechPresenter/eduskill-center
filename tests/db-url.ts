/** Derives the test database URL (`<name>_test`) from the main DATABASE_URL. */
export function testDatabaseUrl(base: string): string {
  const url = new URL(base);
  const name = url.pathname.replace(/^\//, "") || "eduskill";
  url.pathname = `/${name.endsWith("_test") ? name : `${name}_test`}`;
  return url.toString();
}
