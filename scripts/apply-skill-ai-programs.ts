/**
 * Adds the Computer & Skill Development Training, AI Workshop & Training and Digital Marketing
 * Training programmes (prisma/seed-data/skill-ai-programs.ts) to the website's Programs list,
 * directly after Project EduSkill Shiksha Mission:
 *
 *  - creates each programme that does not exist yet, active, in list order right after Shiksha
 *    Mission (wherever Shiksha Mission sits — Admin → CMS → Programs may have renumbered the list);
 *  - keeps existing ones in that position, but leaves their title, icon, summary, content and
 *    active switch alone: after the first run Admin → CMS → Programs owns them. `--refresh`
 *    overwrites them with the seed text (and re-activates them) when that is really wanted;
 *  - when another programme sits in that band, moves every programme after Shiksha Mission down by
 *    the number of these programmes, so they are not interleaved with the existing list.
 *
 * All reads happen first and every write runs in one transaction, so an interrupted run changes
 * nothing. Idempotent: a second run changes nothing. Every change is written to the audit log as a
 * System action. No build or restart is needed — the pages read the programmes on every request.
 *
 *   npx tsx scripts/apply-skill-ai-programs.ts            # apply
 *   npx tsx scripts/apply-skill-ai-programs.ts --dry-run  # only report what would change
 *   npx tsx scripts/apply-skill-ai-programs.ts --refresh  # also overwrite the text of existing ones
 *   npm run content:programs
 */
import "dotenv/config";
import path from "node:path";
import { db } from "../src/lib/db";
import { audit } from "../src/lib/audit";
import { slugify } from "../src/lib/utils";
import { SKILL_AI_PROGRAMS } from "../prisma/seed-data/skill-ai-programs";

/** These programmes are listed directly after this one, which itself never moves. */
const ANCHOR_SLUG = "eduskill-shiksha-mission";

export interface ApplySkillAiProgramsOptions {
  dryRun?: boolean;
  /** Overwrite title, icon, summary and content of programmes that already exist, and re-activate them. */
  refresh?: boolean;
  quiet?: boolean;
}

type ProgramData = { title: string; icon: string; summary: string; content: string; sortOrder: number; isActive: boolean };

export async function applySkillAiPrograms(opts: ApplySkillAiProgramsOptions = {}): Promise<{ created: number; updated: number; moved: number }> {
  const log = (s: string) => {
    if (!opts.quiet) console.log(s);
  };
  const result = { created: 0, updated: 0, moved: 0 };
  const count = SKILL_AI_PROGRAMS.length;
  const slugs = SKILL_AI_PROGRAMS.map((p) => slugify(p.title));
  const fixed = [...slugs, ANCHOR_SLUG];

  // ── Plan (reads only) ──
  const anchor = await db.program.findUnique({ where: { slug: ANCHOR_SLUG }, select: { sortOrder: true } });
  const first = (anchor?.sortOrder ?? 0) + 1;
  const last = first + count - 1;

  const clash = await db.program.findFirst({ where: { slug: { notIn: fixed }, sortOrder: { gte: first, lte: last } }, select: { id: true } });
  const tail = clash
    ? await db.program.findMany({ where: { slug: { notIn: fixed }, sortOrder: { gte: first } }, select: { id: true, title: true, sortOrder: true }, orderBy: { sortOrder: "asc" } })
    : [];
  const moves = tail.map((p) => ({ ...p, to: p.sortOrder + count }));

  const existing = await db.program.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, title: true, icon: true, summary: true, content: true, sortOrder: true, isActive: true },
  });
  const bySlug = new Map(existing.map((e) => [e.slug, e]));

  const creates: { slug: string; data: ProgramData }[] = [];
  const updates: { id: string; title: string; before: (typeof existing)[number]; data: Partial<ProgramData> }[] = [];
  for (const [i, p] of SKILL_AI_PROGRAMS.entries()) {
    const slug = slugs[i]!;
    const sortOrder = first + i;
    const row = bySlug.get(slug);
    if (!row) {
      creates.push({ slug, data: { title: p.title, icon: p.icon, summary: p.summary, content: p.content, sortOrder, isActive: true } });
      continue;
    }
    const data: Partial<ProgramData> = {};
    if (row.sortOrder !== sortOrder) data.sortOrder = sortOrder;
    if (opts.refresh) {
      if (row.title !== p.title) data.title = p.title;
      if (row.icon !== p.icon) data.icon = p.icon;
      if (row.summary !== p.summary) data.summary = p.summary;
      if (row.content !== p.content) data.content = p.content;
      if (!row.isActive) data.isActive = true;
    }
    if (Object.keys(data).length) updates.push({ id: row.id, title: row.title, before: row, data });
  }

  for (const m of moves) log(`move     ${m.title}: ${m.sortOrder} → ${m.to}`);
  for (const c of creates) log(`create   ${c.data.title} (/programs/${c.slug}, sortOrder ${c.data.sortOrder})`);
  for (const u of updates) log(`update   ${u.title}: ${Object.keys(u.data).join(", ")}`);
  result.moved = moves.length;
  result.created = creates.length;
  result.updated = updates.length;
  if (opts.dryRun || (!moves.length && !creates.length && !updates.length)) return result;

  // ── Write (one transaction; queries on tx run one after another) ──
  const created = await db.$transaction(async (tx) => {
    for (const m of moves) await tx.program.update({ where: { id: m.id }, data: { sortOrder: m.to } });
    for (const u of updates) await tx.program.update({ where: { id: u.id }, data: u.data });
    const rows: { id: string; slug: string; data: ProgramData }[] = [];
    for (const c of creates) {
      const row = await tx.program.create({ data: { slug: c.slug, ...c.data } });
      rows.push({ id: row.id, slug: c.slug, data: c.data });
    }
    return rows;
  });

  // ── Audit (after the commit) ──
  if (moves.length) {
    await audit({
      action: "update",
      module: "cms",
      recordType: "Program",
      description: `System moved ${moves.length} programme(s) down to make room for ${SKILL_AI_PROGRAMS.map((p) => p.title).join(", ")}`,
      oldValue: moves.map((m) => ({ title: m.title, sortOrder: m.sortOrder })),
      newValue: moves.map((m) => ({ title: m.title, sortOrder: m.to })),
    });
  }
  for (const u of updates) {
    await audit({ action: "update", module: "cms", recordType: "Program", recordId: u.id, description: `System updated the programme ${u.title} (${Object.keys(u.data).join(", ")})`, oldValue: u.before, newValue: u.data });
  }
  for (const c of created) {
    await audit({ action: "create", module: "cms", recordType: "Program", recordId: c.id, description: `System added the programme ${c.data.title}`, newValue: { slug: c.slug, ...c.data } });
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "apply-skill-ai-programs.ts"))) {
  const dryRun = process.argv.includes("--dry-run");
  applySkillAiPrograms({ dryRun, refresh: process.argv.includes("--refresh") })
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
