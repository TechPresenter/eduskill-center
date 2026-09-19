import type { MetadataRoute } from "next";
import { withBasePath } from "@/lib/base-path";
import { absoluteUrl } from "@/lib/utils";

/**
 * Public site is crawlable; portals, auth pages and the API are not.
 *
 * Unlike routes, Next does NOT apply `basePath` to the rule paths it writes into robots.txt —
 * they are emitted verbatim — so they go through `withBasePath()`. `sitemap` is already absolute
 * via `absoluteUrl()`. At the domain root `withBasePath` is a no-op and the output is unchanged.
 *
 * Note for the sub-path deployment: crawlers only ever fetch /robots.txt at the domain root, which
 * belongs to the other site on this host. This file is served at <base>/robots.txt, so the rules
 * below are advisory unless the root site's own robots.txt repeats them.
 */
export default function robots(): MetadataRoute.Robots {
  const paths = ["/admin", "/student", "/trainer", "/api", "/login", "/register", "/forgot-password", "/reset-password"];
  return {
    rules: [
      {
        userAgent: "*",
        allow: withBasePath("/"),
        disallow: paths.map(withBasePath),
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
