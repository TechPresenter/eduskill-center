/**
 * Generates default brand assets (PWA icons, favicon, default Open Graph image) from an
 * original SVG mark. Replace them any time from Admin → Settings → Branding (uploads)
 * or by re-running: npx tsx scripts/generate-brand-assets.ts
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const NAVY = "#12357A";
const ORANGE = "#E8520A";

function markSvg(size: number, radius = 0.22) {
  const r = Math.round(size * radius);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${(r / size) * 100}" fill="${NAVY}"/>
  <path d="M50 22 L84 38 L50 54 L16 38 Z" fill="#FFFFFF"/>
  <path d="M30 46 v14 c0 6 9 11 20 11 s20 -5 20 -11 v-14 l-20 9 z" fill="${ORANGE}"/>
  <rect x="80" y="38" width="4" height="22" rx="2" fill="#FFFFFF"/>
  <circle cx="82" cy="63" r="4" fill="${ORANGE}"/>
</svg>`;
}

function ogSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${NAVY}"/>
  <rect x="0" y="600" width="1200" height="30" fill="${ORANGE}"/>
  <circle cx="1020" cy="140" r="220" fill="#1D4AA3" opacity="0.6"/>
  <circle cx="1100" cy="520" r="160" fill="${ORANGE}" opacity="0.25"/>
  <g transform="translate(80,90) scale(1.4)">
    <path d="M50 22 L84 38 L50 54 L16 38 Z" fill="#FFFFFF"/>
    <path d="M30 46 v14 c0 6 9 11 20 11 s20 -5 20 -11 v-14 l-20 9 z" fill="${ORANGE}"/>
  </g>
  <text x="80" y="290" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="700" fill="#FFFFFF">EDUSKILL <tspan fill="${ORANGE}">INDIA</tspan> FOUNDATION</text>
  <text x="80" y="360" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#DCE3F5">Empowering India's Youth Through Skills,</text>
  <text x="80" y="405" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#DCE3F5">Education &amp; Opportunity</text>
  <text x="80" y="520" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="4" fill="${ORANGE}">EMPOWERING COMMUNITIES • SPREADING HOPE • CREATING CHANGE</text>
</svg>`;
}

async function main() {
  const root = process.cwd();
  const icons = path.join(root, "public", "icons");
  await fs.mkdir(icons, { recursive: true });
  const out = async (svg: string, file: string, width: number, height = width) => {
    await sharp(Buffer.from(svg)).resize(width, height).png().toFile(file);
    console.log("wrote", path.relative(root, file));
  };
  await out(markSvg(512), path.join(icons, "icon-192.png"), 192);
  await out(markSvg(512, 0), path.join(icons, "icon-192-maskable.png"), 192);
  await out(markSvg(512, 0), path.join(icons, "icon-512-maskable.png"), 512);
  await out(markSvg(512, 0.2), path.join(icons, "apple-touch-icon.png"), 180);
  await out(markSvg(512), path.join(icons, "icon-512.png"), 512);
  await out(markSvg(512), path.join(root, "src", "app", "icon.png"), 64);
  await out(markSvg(512, 0.2), path.join(root, "src", "app", "apple-icon.png"), 180);
  await out(ogSvg(), path.join(root, "public", "og-default.png"), 1200, 630);
  await sharp(Buffer.from(markSvg(512))).resize(512).png().toFile(path.join(root, "public", "logo-mark.png"));
  await fs.writeFile(path.join(root, "public", "logo-mark.svg"), markSvg(512));
  console.log("wrote public/logo-mark.svg");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
