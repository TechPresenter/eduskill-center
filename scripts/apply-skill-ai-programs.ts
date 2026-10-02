/**
 * Adds the Computer & Skill Development Training and AI Workshop & Training programmes
 * (prisma/seed-data/skill-ai-programs.ts) to the website's Programs list, directly after
 * Project EduSkill Shiksha Mission:
 *
 *  - upserts each programme by slug, refreshing its title, icon, summary and content and keeping
 *    it active, with sortOrder 1 and 2;
 *  - moves every other programme that shares sortOrder 1 or 2 two places down, so the two new
 *    ones are not interleaved with the existing list. Shiksha Mission (sortOrder 0) is untouched.
 *
 * Idempotent: a second run changes nothing but the rows' own updatedAt. Every change is written
 * to the audit log as a System action. No build or restart is needed — the pages read the
 * programmes from the database on every request.
 *
 *   npx tsx scripts/apply-skill-ai-programs.ts            # apply
 *   npx tsx scripts/apply-skill-ai-programs.ts --dry-run  # only report what would change
 *   npm run content:programs
 */
import "dotenv/config";
import path from "node:path";
import { db } from "../src/lib/db";
import { audit } from "../src/lib/audit";
import { slugify } from "../src/lib/utils";
import { SKILL_AI_PROGRAMS } from "../prisma/seed-data/skill-ai-programs";

const FIRST_SORT_ORDER = 1;

export interface ApplySkillAiProgramsOptions {
  dryRun?: boolean;
  quiet?: boolean;
}

export async function applySkillAiPrograms(opts: ApplySkillAiProgramsOptions = {}): Promise<{ created: number; updated: number; moved: number }> {
  const log = (s: string) => {
    if (!opts.quiet) console.log(s);
  };
  const dry = !!opts.dryRun;
  const result = { created: 0, updated: 0, moved: 0 };

  const slugs = SKILL_AI_PROGRAMS.map((p) => slugify(p.title));
  const lastSortOrder = FIRST_SORT_ORDER + SKILL_AI_PROGRAMS.length - 1;

  // 1. Make room: any other programme sitting at sortOrder 1 or 2 moves the whole tail down by two.
  const clash = await db.program.findFirst({ where: { slug: { notIn: slugs }, sortOrder: { gte: FIRST_SORT_ORDER, lte: lastSortOrder } }, select: { id: true } });
  if (clash) {
    const tail = await db.program.findMany({ where: { slug: { notIn: slugs }, sortOrder: { gte: FIRST_SORT_ORDER } }, select: { id: true, title: true, sortOrder: true }, orderBy: { sortOrder: "asc" } });
    for (const p of tail) {
      const sortOrder = p.sortOrder + SKILL_AI_PROGRAMS.length;
      log(`move     ${p.title}: ${p.sortOrder} → ${sortOrder}`);
      if (!dry) await db.program.update({ where: { id: p.id }, data: { sortOrder } });
      result.moved++;
    }
    if (!dry && tail.length) {
      await audit({ action: "update", module: "cms", recordType: "Program", description: `System moved ${tail.length} programme(s) down to make room for ${SKILL_AI_PROGRAMS.map((p) => p.title).join(" and ")}`, oldValue: tail.map((p) => ({ title: p.title, sortOrder: p.sortOrder })) });
    }
  }

  // 2. The two programmes
  for (const [i, p] of SKILL_AI_PROGRAMS.entries()) {
    const slug = slugify(p.title);
    const data = { title: p.title, icon: p.icon, summary: p.summary, content: p.content, sortOrder: FIRST_SORT_ORDER + i, isActive: true };
    const existing = await db.program.findUnique({ where: { slug }, select: { id: true, title: true, icon: true, summary: true, content: true, sortOrder: true, isActive: true } });
    if (!existing) {
      log(`create   ${p.title} (/programs/${slug}, sortOrder ${data.sortOrder})`);
      if (!dry) {
        const row = await db.program.create({ data: { slug, ...data } });
        await audit({ action: "create", module: "cms", recordType: "Program", recordId: row.id, description: `System added the programme ${p.title}`, newValue: { slug, ...data } });
      }
      result.created++;
      continue;
    }
    const changed = existing.title !== data.title || existing.icon !== data.icon || existing.summary !== data.summary || existing.content !== data.content || existing.sortOrder !== data.sortOrder || !existing.isActive;
    if (changed) {
      log(`update   ${p.title}`);
      if (!dry) {
        await db.program.update({ where: { id: existing.id }, data });
        await audit({ action: "update", module: "cms", recordType: "Program", recordId: existing.id, description: `System refreshed the programme ${p.title}`, oldValue: existing, newValue: data });
      }
      result.updated++;
    }
  }

  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "apply-skill-ai-programs.ts"))) {
  const dryRun = process.argv.includes("--dry-run");
  applySkillAiPrograms({ dryRun })
    .then(async (r) => {
      console.log(`\n${dryRun ? "DRY RUN — nothing written. Would change" : "Done. Changed"}: ${r.created} created, ${r.updated} updated, ${r.moved} moved.`);
      await db.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await db.$disconnect();
      process.exit(1);
    });
}
