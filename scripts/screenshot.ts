/**
 * Captures screenshots of routes at phone/tablet/desktop widths and reports horizontal overflow
 * (with the offending elements, ignoring content inside scroll containers).
 *
 *   npx tsx scripts/screenshot.ts [baseUrl] [route ...] [--full]
 *   env SHOT_COOKIE="esk_session=<token>" for portal routes, SHOT_WIDTHS="390,1024" to limit viewports.
 * Screenshots land in .data/shots/<route>-<width>.png
 */
import "dotenv/config";
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const positional = args.filter((a) => !a.startsWith("--"));
const BASE = (positional[0] ?? "http://localhost:3000").replace(/\/$/, "");
const routes = positional.slice(1).length ? positional.slice(1) : ["/"];
const FULL = flags.includes("--full");
const COOKIE = process.env.SHOT_COOKIE;
const ONLY = process.env.SHOT_WIDTHS ? process.env.SHOT_WIDTHS.split(",") : null;

const VIEWPORTS: { name: string; width: number; height: number; mobile: boolean }[] = [
  { name: "360", width: 360, height: 800, mobile: true },
  { name: "390", width: 390, height: 844, mobile: true },
  { name: "412", width: 412, height: 915, mobile: true },
  { name: "768", width: 768, height: 1024, mobile: true },
  { name: "1024", width: 1024, height: 768, mobile: false },
  { name: "1280", width: 1280, height: 720, mobile: false },
  { name: "1440", width: 1440, height: 900, mobile: false },
  { name: "1920", width: 1920, height: 1080, mobile: false },
];

// Browser-side snippets are plain strings so the TypeScript runner cannot inject helpers into them.
const SCROLL_THROUGH = [
  "(async () => {",
  "  const step = Math.max(300, Math.floor(window.innerHeight * 0.8));",
  "  for (let y = 0; y < document.body.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }",
  "  window.scrollTo(0, 0);",
  "})()",
].join("\n");

const MEASURE = "({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })";

const CULPRITS = [
  "(() => {",
  "  const w = window.innerWidth; const out = [];",
  "  const clipped = (el) => { let p = el.parentElement; while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; p = p.parentElement; } return false; };",
  "  document.querySelectorAll('body *').forEach((el) => {",
  "    const r = el.getBoundingClientRect();",
  "    if (r.right > w + 1 && r.width > 0 && out.length < 8 && !clipped(el) && getComputedStyle(el).position !== 'fixed') {",
  "      const cls = (el.getAttribute('class') || '').split(' ').slice(0, 6).join('.');",
  "      out.push(el.tagName.toLowerCase() + (cls ? '.' + cls : '') + ' right=' + Math.round(r.right) + ' width=' + Math.round(r.width));",
  "    }",
  "  });",
  "  return out;",
  "})()",
].join("\n");

async function main() {
  const out = path.resolve(".data/shots");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  let problems = 0;
  for (const vp of VIEWPORTS.filter((v) => !ONLY || ONLY.includes(v.name))) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      userAgent: vp.mobile ? "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36" : undefined,
    });
    if (COOKIE) {
      const [name, value] = COOKIE.split("=");
      await context.addCookies([{ name: name!, value: value!, url: BASE }]);
    }
    const page = await context.newPage();
    for (const route of routes) {
      const res = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 120000 }).catch(() => null);
      if (FULL) {
        await page.evaluate(SCROLL_THROUGH);
        await page.waitForTimeout(2800); // let scroll-reveal fallbacks and lazy images settle
      }
      const overflow = (await page.evaluate(MEASURE)) as { scrollWidth: number; innerWidth: number };
      const wide = overflow.scrollWidth > overflow.innerWidth + 1;
      const file = path.join(out, `${route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${vp.name}.png`);
      await page.screenshot({ path: file, fullPage: FULL });
      console.log(`${wide ? "✗ overflow" : "✓"} ${res?.status() ?? "ERR"} ${vp.name.padStart(4)}px ${route} (${overflow.scrollWidth}/${overflow.innerWidth}) → ${path.relative(process.cwd(), file)}`);
      if (wide) {
        problems++;
        const culprits = (await page.evaluate(CULPRITS)) as string[];
        console.log(`   culprits: ${culprits.join(" | ") || "(none outside scroll containers)"}`);
      }
    }
    await context.close();
  }
  await browser.close();
  console.log(problems ? `${problems} overflow problem(s)` : "no horizontal overflow");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
