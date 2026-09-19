import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "You are offline", robots: { index: false } };

/** Static page served by the service worker when the network is unavailable. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-lavender text-navy">
        <WifiOff className="h-8 w-8" aria-hidden />
      </span>
      <h1 className="mt-6 text-2xl font-extrabold">You are offline</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">EduSkill needs an internet connection to load your latest applications, classes and updates. Reconnect and try again.</p>
      <Link href="/" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-orange px-6 text-sm font-semibold text-white">
        Try again
      </Link>
    </main>
  );
}
