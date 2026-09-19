import type { NextConfig } from "next";

/**
 * Sub-path deployment (see src/lib/base-path.ts). One environment variable drives everything:
 *   BASE_PATH=""        → served at the domain root. Nothing below changes; this is the default.
 *   BASE_PATH="/center" → served at https://eduskillindia.org/center.
 * Keep this normaliser identical to `normalizeBasePath()` in src/lib/base-path.ts. It is duplicated
 * rather than imported because next.config.ts is loaded without the `@/` path aliases.
 */
function normalizeBasePath(value: string | undefined): string {
  const v = (value ?? "").trim();
  if (!v || v === "/") return "";
  return (v.startsWith("/") ? v : `/${v}`).replace(/\/+$/, "");
}

const basePath = normalizeBasePath(process.env.BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH);

// Mirror the normalised value so src/lib/base-path.ts — imported by both server and client code —
// resolves to exactly the string Next itself uses. `env` below inlines it into the bundles.
process.env.NEXT_PUBLIC_BASE_PATH = basePath;

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(self)" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Omitted entirely (not set to "") when BASE_PATH is empty, so a root deployment is untouched.
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  // Build-time constant for src/lib/base-path.ts on both the server and the client.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "nodemailer", "exceljs", "pdf-lib", "embedded-postgres"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 390, 412, 430, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [48, 64, 96, 128, 192, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
    // The persistent dev cache grew past 5 GB and filled the disk; keep the dev cache in memory only.
    turbopackFileSystemCacheForDev: false,
  },
  async headers() {
    // Next applies `basePath` to headers()/redirects()/rewrites() sources automatically, so these
    // stay base-path-free: "/sw.js" matches /center/sw.js when basePath is "/center".
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          // A worker may only claim a scope at or below its own path, so the allowed scope is the
          // deployment root: "/" at the domain root, "/center/" under a sub-path.
          { key: "Service-Worker-Allowed", value: basePath ? `${basePath}/` : "/" },
        ],
      },
      { source: "/manifest.webmanifest", headers: [{ key: "Content-Type", value: "application/manifest+json" }] },
    ];
  },
};

export default nextConfig;
