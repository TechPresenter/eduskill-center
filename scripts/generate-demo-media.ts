/**
 * Generates the demo media the seeded content refers to, so no screen shows a broken or
 * missing image:
 *
 *  - branded cover art for demo courses, centers and programs (public/media/…)
 *  - initial-avatars for demo success stories
 *  - the sample photo + ID document the demo student applications link to (private storage)
 *
 * Everything is generated brand artwork — no stock photography and no pictures of real people.
 * Real photos replace these from Admin → Courses / Centers / CMS at any time.
 *
 *   npx tsx scripts/generate-demo-media.ts            # write files + point demo rows at them
 *   npx tsx scripts/generate-demo-media.ts --files    # only write the files
 */
import "dotenv/config";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "../src/lib/db";
import { putBuffer } from "../src/lib/storage";

const NAVY = "#12357A";
const NAVY_DARK = "#102F70";
const NAVY_LIGHT = "#1D4AA3";
const ORANGE = "#E8520A";

const MEDIA_DIR = path.resolve(process.cwd(), "public", "media");

/** Stable pseudo-random pick so the same name always produces the same artwork. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function initials(name: string): string {
  return (
    name
      .replace(/^(EduSkill|Demo Story:)\s*/i, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "ES"
  );
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}

/** Wraps a title into at most `maxLines` lines of roughly `perLine` characters. */
function wrap(text: string, perLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (!line) line = w;
    else if ((line + " " + w).length <= perLine) line += " " + w;
    else {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = lines[maxLines - 1]!.replace(/\s*\S*$/, "") + "…";
  }
  return lines;
}

/** Diagonal brand pattern + soft blobs used behind every cover. */
function backdrop(w: number, h: number, from: string, to: string, accent: string): string {
  return `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.4" fill="#FFFFFF" opacity="0.12"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect width="${w}" height="${h}" fill="url(#dots)"/>
  <circle cx="${w * 0.88}" cy="${h * 0.18}" r="${h * 0.42}" fill="#FFFFFF" opacity="0.06"/>
  <circle cx="${w * 0.78}" cy="${h * 0.92}" r="${h * 0.3}" fill="${accent}" opacity="0.22"/>`;
}

const COVER_W = 800;
const COVER_H = 450;

function coverSvg(opts: { eyebrow: string; title: string; badge?: string; from?: string; to?: string }): string {
  const from = opts.from ?? NAVY;
  const to = opts.to ?? NAVY_DARK;
  const lines = wrap(opts.title, 22, 3);
  const startY = 210 - (lines.length - 1) * 26;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_W}" height="${COVER_H}" viewBox="0 0 ${COVER_W} ${COVER_H}">
  ${backdrop(COVER_W, COVER_H, from, to, ORANGE)}
  <rect x="0" y="${COVER_H - 10}" width="${COVER_W}" height="10" fill="${ORANGE}"/>
  <text x="56" y="120" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" letter-spacing="4" fill="${ORANGE}">${escapeXml(opts.eyebrow.toUpperCase())}</text>
  ${lines
    .map((l, i) => `<text x="56" y="${startY + i * 52}" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="700" fill="#FFFFFF">${escapeXml(l)}</text>`)
    .join("\n  ")}
  ${
    opts.badge
      ? `<rect x="56" y="${COVER_H - 108}" rx="18" ry="18" width="${Math.max(150, opts.badge.length * 16 + 44)}" height="44" fill="#FFFFFF" opacity="0.14"/>
  <text x="78" y="${COVER_H - 78}" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" letter-spacing="1" fill="#FFFFFF">${escapeXml(opts.badge)}</text>`
      : ""
  }
  <g transform="translate(${COVER_W - 150}, 56)">
    <path d="M40 0 L80 18 L40 36 L0 18 Z" fill="#FFFFFF" opacity="0.95"/>
    <path d="M16 26 v16 c0 7 11 12 24 12 s24 -5 24 -12 v-16 l-24 11 z" fill="${ORANGE}"/>
  </g>
</svg>`;
}

function avatarSvg(name: string, size = 320): string {
  const palette = [
    [NAVY, NAVY_LIGHT],
    [ORANGE, "#F2763A"],
    [NAVY_DARK, "#2A5BB8"],
    ["#1F6F53", "#2E9B75"],
  ] as const;
  const [a, b] = palette[hash(name) % palette.length]!;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/></linearGradient></defs>
  <rect width="100" height="100" fill="url(#a)"/>
  <circle cx="50" cy="50" r="34" fill="#FFFFFF" opacity="0.12"/>
  <text x="50" y="50" dy="0.36em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#FFFFFF">${escapeXml(initials(name))}</text>
</svg>`;
}

async function writePng(svg: string, file: string): Promise<string> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).png({ quality: 90, compressionLevel: 9 }).toFile(file);
  return "/" + path.relative(path.resolve(process.cwd(), "public"), file).split(path.sep).join("/");
}

/** A placeholder "scanned document" PDF for the demo application documents. */
async function samplePdf(title: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const navy = rgb(18 / 255, 53 / 255, 122 / 255);
  const orange = rgb(232 / 255, 82 / 255, 10 / 255);
  const muted = rgb(102 / 255, 112 / 255, 133 / 255);
  page.drawRectangle({ x: 0, y: 742, width: 595, height: 100, color: navy });
  page.drawRectangle({ x: 0, y: 736, width: 595, height: 6, color: orange });
  page.drawText("EduSkill India Foundation", { x: 48, y: 800, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Sample demonstration document", { x: 48, y: 776, size: 11, font: regular, color: rgb(0.85, 0.88, 0.97) });
  page.drawText(title, { x: 48, y: 660, size: 24, font: bold, color: navy });
  const body = [
    "This file is generated demo content that stands in for a real uploaded",
    "document so that every demo application has something to preview.",
    "",
    "It contains no personal data and is not a real identity document.",
    "Delete the demo data, or upload a genuine document, to replace it.",
  ];
  body.forEach((l, i) => page.drawText(l, { x: 48, y: 610 - i * 20, size: 12, font: regular, color: muted }));
  page.drawRectangle({ x: 48, y: 200, width: 499, height: 330, borderColor: rgb(0.9, 0.91, 0.93), borderWidth: 1 });
  page.drawText("[ scanned page placeholder ]", { x: 200, y: 360, size: 12, font: regular, color: muted });
  return Buffer.from(await doc.save());
}

export interface GenerateDemoMediaOptions {
  /** Write the files but leave the database rows untouched. */
  filesOnly?: boolean;
  /** Suppress per-file logging (used by the seed). */
  quiet?: boolean;
}

/** Generates every demo media file and links it to the demo rows. Returns the file count. */
export async function generateDemoMedia(opts: GenerateDemoMediaOptions = {}): Promise<number> {
  const filesOnly = opts.filesOnly ?? false;
  const log = (s: string) => {
    if (!opts.quiet) console.log(s);
  };
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  let written = 0;
  const note = (what: string) => {
    written++;
    log("  " + what);
  };

  // ── Courses ────────────────────────────────────────────────────────────────
  log("courses");
  const courses = await db.course.findMany({ select: { id: true, name: true, code: true, image: true, category: { select: { name: true } } } });
  for (const c of courses) {
    const file = path.join(MEDIA_DIR, "courses", `${c.code.toLowerCase()}.png`);
    const url = await writePng(coverSvg({ eyebrow: c.category?.name ?? "Course", title: c.name, badge: c.code }), file);
    if (!filesOnly && !c.image) await db.course.update({ where: { id: c.id }, data: { image: url } });
    note(`${c.code} → ${url}`);
  }

  // ── Centers ────────────────────────────────────────────────────────────────
  log("centers");
  const centers = await db.center.findMany({ select: { id: true, name: true, code: true, coverImage: true, district: { select: { name: true } }, state: { select: { name: true } } } });
  for (const c of centers) {
    const file = path.join(MEDIA_DIR, "centers", `${c.code.toLowerCase()}.png`);
    const url = await writePng(
      coverSvg({ eyebrow: `${c.district.name}, ${c.state.name}`, title: c.name, badge: c.code, from: NAVY_DARK, to: NAVY_LIGHT }),
      file
    );
    if (!filesOnly && !c.coverImage) await db.center.update({ where: { id: c.id }, data: { coverImage: url } });
    note(`${c.code} → ${url}`);
  }

  // ── Programs ───────────────────────────────────────────────────────────────
  log("programs");
  const programs = await db.program.findMany({ select: { id: true, title: true, slug: true, image: true } });
  for (const p of programs) {
    const file = path.join(MEDIA_DIR, "programs", `${p.slug}.png`);
    const url = await writePng(coverSvg({ eyebrow: "Program", title: p.title, from: NAVY, to: NAVY_LIGHT }), file);
    if (!filesOnly && !p.image) await db.program.update({ where: { id: p.id }, data: { image: url } });
    note(`${p.slug} → ${url}`);
  }

  // ── Success stories ────────────────────────────────────────────────────────
  log("success stories");
  const stories = await db.successStory.findMany({ select: { id: true, studentName: true, photoUrl: true } });
  for (const [i, s] of stories.entries()) {
    const file = path.join(MEDIA_DIR, "stories", `story-${i + 1}.png`);
    const url = await writePng(avatarSvg(s.studentName), file);
    if (!filesOnly && !s.photoUrl) await db.successStory.update({ where: { id: s.id }, data: { photoUrl: url } });
    note(`${s.studentName} → ${url}`);
  }

  // ── Demo application documents (private storage) ────────────────────────────
  // The demo seed links every application to these two paths; write the real files so
  // "View document" never 404s for Foundation staff.
  log("demo application documents");
  const photo = await sharp(Buffer.from(avatarSvg("Demo Student", 600))).png().toBuffer();
  await putBuffer("private/demo/placeholder-photo.jpg", photo, "image/jpeg");
  note("private/demo/placeholder-photo.jpg");
  await putBuffer("private/demo/placeholder-id.pdf", await samplePdf("Identity document (demo)"), "application/pdf");
  note("private/demo/placeholder-id.pdf");

  log(`\n${written} media file(s) generated${filesOnly ? " (database not touched)" : " and linked to demo records"}.`);
  return written;
}

/** CLI entry: runs only when this file is executed directly, not when the seed imports it. */
if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "generate-demo-media.ts"))) {
  generateDemoMedia({ filesOnly: process.argv.includes("--files") })
    .then(() => db.$disconnect())
    .catch(async (e: unknown) => {
      console.error(e);
      await db.$disconnect().catch(() => undefined);
      process.exit(1);
    });
}
