/**
 * End-to-end smoke test against a running server (default http://localhost:3000).
 * Logs in as each role and requests every page/API, reporting non-200 responses and
 * server-side error markers in the HTML.
 *
 *   npx tsx scripts/smoke.ts [baseUrl]
 */
import "dotenv/config";

const BASE = (process.argv[2] ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const DEMO_PASSWORD = "Demo@1234";

const PUBLIC_ROUTES = [
  "/", "/about", "/programs", "/courses", "/training-centers", "/become-a-trainer", "/become-a-trainer/apply", "/become-a-trainer/status",
  "/open-a-centre", "/open-a-centre/apply", "/open-a-centre/status",
  "/scholarship", "/success-stories", "/contact", "/verify-certificate", "/blog", "/events", "/gallery", "/faq", "/donate",
  "/privacy-policy", "/terms", "/refund-policy", "/disclaimer", "/login", "/register", "/forgot-password", "/sitemap.xml", "/robots.txt",
  "/manifest.webmanifest", "/api/public/locations", "/api/public/courses", "/api/public/centers", "/api/public/centers/map", "/api/public/stats",
];

const STUDENT_ROUTES = [
  "/student/dashboard", "/student/courses", "/student/training", "/student/profile", "/student/apply", "/student/applications", "/student/documents", "/student/payments", "/student/timetable",
  "/student/attendance", "/student/materials", "/student/assignments", "/student/assessments", "/student/progress", "/student/certificates",
  "/student/notifications", "/student/support", "/student/settings",
];

const TRAINER_ROUTES = [
  "/trainer/dashboard", "/trainer/profile", "/trainer/assignments", "/trainer/batches", "/trainer/students", "/trainer/timetable", "/trainer/attendance",
  "/trainer/coursework", "/trainer/assessments", "/trainer/materials", "/trainer/announcements", "/trainer/notifications", "/trainer/settings",
];

const ADMIN_ROUTES = [
  "/admin/dashboard", "/admin/locations", "/admin/states", "/admin/districts", "/admin/blocks", "/admin/centers", "/admin/courses", "/admin/batches",
  "/admin/students", "/admin/applications", "/admin/admissions", "/admin/payments", "/admin/scholarships", "/admin/attendance", "/admin/progress",
  "/admin/certificates", "/admin/trainer-applications", "/admin/trainers", "/admin/centre-applications", "/admin/reports", "/admin/cms", "/admin/gallery", "/admin/blog", "/admin/events",
  "/admin/faqs", "/admin/donations", "/admin/notifications", "/admin/support", "/admin/staff", "/admin/roles", "/admin/permissions", "/admin/settings",
  "/admin/audit-logs", "/admin/account",
];

interface Result {
  route: string;
  status: number;
  ms: number;
  problem?: string;
}

async function login(identifier: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${identifier}: ${res.status} ${await res.text()}`);
  const cookie = res.headers.get("set-cookie") ?? "";
  const match = cookie.match(/esk_session=([^;]+)/);
  if (!match) throw new Error("No session cookie returned");
  return `esk_session=${match[1]}`;
}

async function check(route: string, cookie?: string): Promise<Result> {
  const started = Date.now();
  try {
    let res = await fetch(`${BASE}${route}`, { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" });
    // Follow one same-portal redirect (e.g. /admin/settings → /admin/settings/branding); cross-portal redirects are reported.
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      const target = location.startsWith("http") ? new URL(location).pathname : location;
      const portal = (p: string) => p.split("/")[1] ?? "";
      if (portal(target) === portal(route) && target !== route) {
        res = await fetch(`${BASE}${target}`, { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" });
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
  const admin = await login(process.env.SEED_SUPER_ADMIN_EMAIL ?? "superadmin@eduskillindia.org", process.env.SEED_SUPER_ADMIN_PASSWORD ?? "SuperAdmin@123");
  failures += await run("Super Admin", ADMIN_ROUTES, admin);
  // Role isolation: a student must not reach admin/trainer pages, staff must not reach student pages.
  console.log("\n=== Role isolation ===");
  for (const [label, cookie, route] of [
    ["student → /admin/dashboard", student, "/admin/dashboard"],
    ["student → /trainer/dashboard", student, "/trainer/dashboard"],
    ["trainer → /admin/dashboard", trainer, "/admin/dashboard"],
    ["admin → /student/dashboard", admin, "/student/dashboard"],
    ["anonymous → /admin/dashboard", undefined, "/admin/dashboard"],
  ] as const) {
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
