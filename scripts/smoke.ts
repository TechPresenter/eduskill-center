/**
 * End-to-end smoke test against a running server (default http://localhost:3000).
 * Logs in as each role and requests every page/API, reporting non-200 responses and
 * server-side error markers in the HTML.
 *
 *   npx tsx scripts/smoke.ts [baseUrl]
 *
 * Administrators sign in with an email code and, when 2FA is on, an authenticator app — a script
 * cannot do that. The admin pass therefore uses, in order:
 *   1. SMOKE_ADMIN_COOKIE="esk_session=<token>" when set, e.g. from the local-only helper:
 *        SMOKE_ADMIN_COOKIE="$(npx tsx scripts/mint-session.ts info@eduskillindia.com)" npx tsx scripts/smoke.ts
 *   2. otherwise a password sign-in with SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD, which
 *      works only while ADMIN_PASSWORD_LOGIN is on and that account has no second factor due.
 * Every POST carries an Origin header for the base URL: /api/auth and /api/admin refuse a
 * state-changing request without one (CSRF rule in src/lib/api/handler.ts).
 */
import "dotenv/config";

const BASE = (process.argv[2] ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
/**
 * The URL sub-path the app is mounted at, derived from the base URL ("" for a root deployment,
 * "/center" for http://host/center). Routes below stay base-path-free: the prefix is added when a
 * URL is built, and stripped off Location headers, which always carry it.
 */
const BASE_PREFIX = (() => {
  try {
    return new URL(BASE).pathname.replace(/\/+$/, "");
  } catch {
    return "";
  }
})();
/** "/" must probe the deployment root itself (".../center", not ".../center/", which Next 308s). */
const urlFor = (route: string) => (route === "/" && BASE_PREFIX ? BASE : `${BASE}${route}`);
const stripPrefix = (p: string) => (BASE_PREFIX && (p === BASE_PREFIX || p.startsWith(`${BASE_PREFIX}/`)) ? p.slice(BASE_PREFIX.length) || "/" : p);
const DEMO_PASSWORD = "Demo@1234";
/** Origin of the base URL ("http://localhost:3000" for ".../center"): what a browser sends on a POST. */
const ORIGIN = (() => {
  try {
    return new URL(BASE).origin;
  } catch {
    return BASE;
  }
})();

const PUBLIC_ROUTES = [
  "/", "/about", "/programs", "/courses", "/training-centers", "/become-a-trainer", "/become-a-trainer/apply", "/become-a-trainer/status",
  "/open-a-centre", "/open-a-centre/apply", "/open-a-centre/status",
  "/scholarship", "/success-stories", "/contact", "/verify-certificate", "/blog", "/events", "/gallery", "/faq", "/donate",
  "/privacy-policy", "/terms", "/refund-policy", "/disclaimer", "/login", "/login/admin", "/register", "/forgot-password", "/sitemap.xml", "/robots.txt",
  "/manifest.webmanifest", "/api/public/locations", "/api/public/courses", "/api/public/centers", "/api/public/centers/map", "/api/public/stats",
];

const STUDENT_ROUTES = [
  "/student/dashboard", "/student/courses", "/student/training", "/student/profile", "/student/apply", "/student/applications", "/student/documents", "/student/payments", "/student/timetable",
  "/student/attendance", "/student/materials", "/student/assignments", "/student/assessments", "/student/progress", "/student/certificates",
  "/student/notifications", "/student/support", "/student/settings",
];

const TRAINER_ROUTES = [
  "/trainer/dashboard", "/trainer/profile", "/trainer/profile/documents", "/trainer/assignments", "/trainer/batches", "/trainer/students", "/trainer/timetable", "/trainer/attendance",
  "/trainer/coursework", "/trainer/assessments", "/trainer/materials", "/trainer/announcements", "/trainer/notifications", "/trainer/settings",
];

const ADMIN_ROUTES = [
  "/admin/dashboard", "/admin/locations", "/admin/states", "/admin/districts", "/admin/blocks", "/admin/centers", "/admin/courses", "/admin/batches",
  "/admin/students", "/admin/applications", "/admin/admissions", "/admin/payments", "/admin/scholarships", "/admin/attendance", "/admin/progress",
  "/admin/certificates", "/admin/trainer-applications", "/admin/trainers", "/admin/centre-applications", "/admin/reports", "/admin/cms", "/admin/gallery", "/admin/blog", "/admin/events",
  "/admin/faqs", "/admin/donations", "/admin/notifications", "/admin/support", "/admin/staff", "/admin/roles", "/admin/permissions", "/admin/settings",
  "/admin/audit-logs", "/admin/account", "/admin/account/security",
  "/admin/security", "/admin/security/sessions", "/admin/security/activity", "/admin/security/admins", "/admin/security/alerts",
  "/admin/email", "/admin/email/history", "/admin/email/drafts", "/admin/email/templates",
];

interface Result {
  route: string;
  status: number;
  ms: number;
  problem?: string;
}

/** Password sign-in. `mfaRequired` means the account is an administrator who still owes a second factor. */
async function tryLogin(identifier: string, password: string): Promise<{ cookie: string } | { mfaRequired: true } | { error: string }> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ identifier, password }),
  });
  const text = await res.text();
  if (!res.ok) return { error: `${res.status} ${text.slice(0, 300)}` };
  try {
    if ((JSON.parse(text) as { data?: { mfaRequired?: boolean } }).data?.mfaRequired) return { mfaRequired: true };
  } catch {
    /* not JSON: fall through to the cookie check */
  }
  const match = (res.headers.get("set-cookie") ?? "").match(/esk_session=([^;]+)/);
  if (!match) return { error: "no session cookie returned" };
  return { cookie: `esk_session=${match[1]}` };
}

async function login(identifier: string, password: string): Promise<string> {
  const r = await tryLogin(identifier, password);
  if ("cookie" in r) return r.cookie;
  throw new Error(`Login failed for ${identifier}: ${"error" in r ? r.error : "a second factor is required"}`);
}

/** The Super Admin cookie, or null (with the reason printed) when the script cannot sign in alone. */
async function adminCookie(): Promise<string | null> {
  const preset = process.env.SMOKE_ADMIN_COOKIE?.trim();
  if (preset) return preset.startsWith("esk_session=") ? preset : `esk_session=${preset}`;
  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? "info@eduskillindia.com";
  const r = await tryLogin(email, process.env.SEED_SUPER_ADMIN_PASSWORD ?? "SuperAdmin@123");
  if ("cookie" in r) return r.cookie;
  const why = "mfaRequired" in r ? "the password was accepted but a second factor (authenticator) is required" : `password sign-in failed (${r.error})`;
  console.log(`\n✗ Super Admin: ${why}.`);
  console.log("  Admin sign-in needs an email code / authenticator, which this script cannot provide. Against a LOCAL database run:");
  console.log(`    SMOKE_ADMIN_COOKIE="$(npx tsx scripts/mint-session.ts ${email})" npx tsx scripts/smoke.ts ${BASE}`);
  return null;
}

async function check(route: string, cookie?: string): Promise<Result> {
  const started = Date.now();
  try {
    let res = await fetch(urlFor(route), { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" });
    // Follow one same-portal redirect (e.g. /admin/settings → /admin/settings/branding); cross-portal redirects are reported.
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      const target = stripPrefix(location.startsWith("http") ? new URL(location).pathname : location);
      const portal = (p: string) => p.split("/")[1] ?? "";
      if (portal(target) === portal(route) && target !== route) {
        res = await fetch(urlFor(target), { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" });
      }
    }
    const ms = Date.now() - started;
    const text = await res.text();
    let problem: string | undefined;
    if (res.status >= 300 && res.status < 400) problem = `redirect → ${res.headers.get("location")}`;
    else if (res.status !== 200) problem = `HTTP ${res.status}`;
    else if (/Application error|Internal Server Error|Unhandled Runtime Error|__next_error__/.test(text)) problem = "error marker in HTML";
    return { route, status: res.status, ms, problem };
  } catch (err) {
    return { route, status: 0, ms: Date.now() - started, problem: String(err) };
  }
}

async function run(label: string, routes: string[], cookie?: string) {
  console.log(`\n=== ${label} (${routes.length} routes) ===`);
  const results: Result[] = [];
  for (const r of routes) results.push(await check(r, cookie));
  const bad = results.filter((r) => r.problem);
  for (const r of results) console.log(`${r.problem ? "✗" : "✓"} ${r.status} ${String(r.ms).padStart(5)}ms ${r.route}${r.problem ? `  ← ${r.problem}` : ""}`);
  return bad.length;
}

async function main() {
  let failures = 0;
  failures += await run("Public", PUBLIC_ROUTES);
  const student = await login("student1@demo.eduskill.local", DEMO_PASSWORD);
  failures += await run("Student", STUDENT_ROUTES, student);
  const trainer = await login("trainer.kolkata@demo.eduskill.local", DEMO_PASSWORD);
  failures += await run("Trainer", TRAINER_ROUTES, trainer);
  const admin = await adminCookie();
  if (admin) failures += await run("Super Admin", ADMIN_ROUTES, admin);
  else failures++;
  // Role isolation: a student must not reach admin/trainer pages, staff must not reach student pages.
  console.log("\n=== Role isolation ===");
  const isolation: [string, string | undefined, string][] = [
    ["student → /admin/dashboard", student, "/admin/dashboard"],
    ["student → /admin/email", student, "/admin/email"],
    ["student → /trainer/dashboard", student, "/trainer/dashboard"],
    ["trainer → /admin/dashboard", trainer, "/admin/dashboard"],
    ["trainer → /admin/security", trainer, "/admin/security"],
    ...(admin ? ([["admin → /student/dashboard", admin, "/student/dashboard"]] as [string, string, string][]) : []),
    ["anonymous → /admin/dashboard", undefined, "/admin/dashboard"],
  ];
  for (const [label, cookie, route] of isolation) {
    const r = await check(route, cookie);
    const ok = r.status >= 300 && r.status < 400;
    if (!ok) failures++;
    console.log(`${ok ? "✓" : "✗"} ${label}: ${r.status} ${r.problem ?? ""}`);
  }
  console.log(`\n${failures === 0 ? "ALL GOOD" : `${failures} problem(s) found`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
