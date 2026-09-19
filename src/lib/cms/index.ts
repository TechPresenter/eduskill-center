import { db } from "@/lib/db";
import { CMS_SECTIONS, getSectionDef, mergeSectionData } from "@/lib/cms/sections";
import type { Prisma } from "@/generated/prisma/client";

/** Loads a CMS section, merging saved data over registry defaults. */
export async function getSection<T extends object = Record<string, unknown>>(key: string): Promise<T> {
  const def = getSectionDef(key);
  if (!def) throw new Error(`Unknown CMS section: ${key}`);
  const row = await db.cmsSection.findUnique({ where: { key } }).catch(() => null);
  return mergeSectionData<T>(def, row?.data);
}

/** Loads many sections in one query. */
export async function getSections(keys: string[]): Promise<Record<string, Record<string, unknown>>> {
  const rows = await db.cmsSection.findMany({ where: { key: { in: keys } } }).catch(() => []);
  const byKey = new Map(rows.map((r) => [r.key, r.data]));
  const out: Record<string, Record<string, unknown>> = {};
  for (const key of keys) {
    const def = getSectionDef(key);
    if (!def) continue;
    out[key] = mergeSectionData(def, byKey.get(key));
  }
  return out;
}

export async function saveSection(key: string, data: Record<string, unknown>, userId?: string | null) {
  const def = getSectionDef(key);
  if (!def) throw new Error(`Unknown CMS section: ${key}`);
  return db.cmsSection.upsert({
    where: { key },
    create: { key, name: def.name, data: data as Prisma.InputJsonValue, updatedById: userId ?? null },
    update: { data: data as Prisma.InputJsonValue, updatedById: userId ?? null },
  });
}

export async function getPage(slug: string) {
  return db.cmsPage.findFirst({ where: { slug, status: "PUBLISHED" } });
}

export { CMS_SECTIONS };
