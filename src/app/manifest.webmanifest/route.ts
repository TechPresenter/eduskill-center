import { withBasePath } from "@/lib/base-path";

/**
 * Web app manifest.
 *
 * Generated rather than served from `public/` because every URL inside it (`start_url`, `scope`,
 * `id`, icon `src`, screenshot `src`, shortcut `url`) is an app-absolute path that must carry the
 * deployment sub-path — and a static file in `public/` cannot. The output is byte-identical in
 * intent to the old `public/manifest.webmanifest` when BASE_PATH is empty.
 *
 * `force-static` keeps it a build-time artefact like the file it replaces; the sub-path is a
 * build-time constant, so there is nothing to recompute per request.
 */
export const dynamic = "force-static";

export function GET() {
  const manifest = {
    name: "EduSkill India Foundation",
    short_name: "EduSkill",
    description: "Skill development, education and career-oriented training for students across India.",
    start_url: withBasePath("/?source=pwa"),
    display: "standalone",
    background_color: "#F8F8FC",
    theme_color: "#12357A",
    icons: [
      { src: withBasePath("/icons/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: withBasePath("/icons/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: withBasePath("/icons/icon-192-maskable.png"), sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: withBasePath("/icons/icon-512-maskable.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    id: withBasePath("/"),
    scope: withBasePath("/"),
    orientation: "portrait",
    display_override: ["standalone", "minimal-ui"],
    categories: ["education"],
    lang: "en-IN",
    shortcuts: [
      { name: "Find a Training Center", url: withBasePath("/training-centers") },
      { name: "Apply Now", url: withBasePath("/register") },
      { name: "My Dashboard", url: withBasePath("/login") },
    ],
    prefer_related_applications: false,
    screenshots: [
      { src: withBasePath("/screenshots/mobile-home.png"), sizes: "390x844", type: "image/png", form_factor: "narrow", label: "EduSkill home on mobile" },
      { src: withBasePath("/screenshots/desktop-home.png"), sizes: "1280x720", type: "image/png", form_factor: "wide", label: "EduSkill home on desktop" },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      // next.config.ts also pins this content type for /manifest.webmanifest; keep both in step.
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
