import type { Metadata } from "next";
import { RecoverSignIn } from "./recover-sign-in";

export const metadata: Metadata = {
  title: "Recovery sign-in",
  robots: { index: false, follow: false },
  // The one-time token is in this page's address until the script strips it: no Referer may carry it
  // to the page's own scripts, fonts or anything else it loads.
  referrer: "no-referrer",
};

/**
 * Break-glass sign-in for a locked-out administrator, from a one-time link issued on the server
 * (scripts/admin-recovery.ts). Deliberately does NOT read `searchParams`: the token never enters the
 * server-rendered HTML or the RSC payload — the client reads it from the address bar, removes it
 * from there, and sends it once in a POST body.
 */
export default function AdminRecoverPage() {
  return <RecoverSignIn />;
}
