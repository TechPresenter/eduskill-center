/**
 * Brings a homepage hero that was saved in Admin → CMS up to the redesigned hero (October 2026):
 *
 *   - the two calls to action become "Explore Our Programs" (/programs) and "Join Our Workshop"
 *     (/programs/ai-workshop-training) — only where they still hold the previous defaults
 *     ("Explore Programs" → /programs, "Find Training Center" → /training-centers);
 *   - each slide gets its full-bleed background photo when it has none: the first slide the AI
 *     workshop picture, the Shiksha Mission slide and the Open-a-Centre slide their own.
 *
 * A hero that was never saved needs nothing: the code defaults (src/lib/cms/sections.ts) already
 * carry the new values. Anything an admin changed is left alone. Audited as a System action.
 *
 *   npx tsx scripts/apply-hero-redesign.ts            # apply
 *   npx tsx scripts/apply-hero-redesign.ts --dry-run  # only report what would change
 *   npm run content:hero
 */
import "dotenv/config";
import path from "node:path";
import { db, type Prisma } from "../src/lib/db";
import { audit } from "../src/lib/audit";

const BG = {
  main: "/media/ai/programs/ai-workshop-training.webp",
  shiksha: "/media/ai/programs/eduskill-shiksha-mission.webp",
  centre: "/media/ai/programs/other-foundation-programs.webp",
};

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function applyHeroRedesign(opts: { dryRun?: boolean; quiet?: boolean } = {}): Promise<{ changes: string[] }> {
  const log = (s: string) => {
    if (!opts.quiet) console.log(s);
  };
  const row = await db.cmsSection.findUnique({ where: { key: "home.hero" } });
  if (!row || !row.data || typeof row.data !== "object" || Array.isArray(row.data)) {
    log("hero not saved in the CMS — the code defaults already carry the redesign.");
    return { changes: [] };
  }
  const data = { ...(row.data as Row) };
  const changes: string[] = [];

  if (str(data.primaryLabel) === "Explore Programs" && str(data.primaryHref) === "/programs") {
    data.primaryLabel = "Explore Our Programs";
    changes.push('primary button → "Explore Our Programs"');
  }
  if (str(data.secondaryLabel) === "Find Training Center" && str(data.secondaryHref) === "/training-centers") {
    data.secondaryLabel = "Join Our Workshop";
    data.secondaryHref = "/programs/ai-workshop-training";
    changes.push('secondary button → "Join Our Workshop" (/programs/ai-workshop-training)');
  }
  if (!str(data.backgroundUrl)) {
    data.backgroundUrl = BG.main;
    changes.push(`first slide background → ${BG.main}`);
  }
  if (Array.isArray(data.slides)) {
    data.slides = (data.slides as unknown[]).map((s) => {
      if (!s || typeof s !== "object") return s;
      const slide = { ...(s as Row) };
      if (str(slide.backgroundUrl)) return slide;
      const bg = /shiksha/i.test(str(slide.eyebrow)) ? BG.shiksha : str(slide.primaryHref) === "/open-a-centre" ? BG.centre : null;
      if (bg) {
        slide.backgroundUrl = bg;
        changes.push(`slide "${str(slide.eyebrow)}" background → ${bg}`);
      }
      return slide;
    });
  }

  for (const c of changes) log(`hero     ${c}`);
  if (!changes.length) log("hero     already up to date");
  if (changes.length && !opts.dryRun) {
    await db.cmsSection.update({ where: { key: "home.hero" }, data: { data: data as Prisma.InputJsonValue } });
    await audit({ action: "update", module: "cms", recordType: "CmsSection", recordId: row.id, description: `System applied the hero redesign: ${changes.join("; ")}` });
  }
  log(`${opts.dryRun ? "DRY RUN — would apply" : "Applied"}: ${changes.length} change(s).`);
  return { changes };
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "apply-hero-redesign.ts"))) {
  applyHeroRedesign({ dryRun: process.argv.includes("--dry-run") })
    .then(async () => {
      await db.$disconnect();
    })
    .catch(async (e: unknown) => {
      console.error(e);
      await db.$disconnect().catch(() => undefined);
      process.exit(1);
    });
}
