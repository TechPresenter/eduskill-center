import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/utils";

/** Public site is crawlable; portals, auth pages and the API are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/student", "/trainer", "/api", "/login", "/register", "/forgot-password", "/reset-password"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
