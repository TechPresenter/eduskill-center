"use client";

import { usePathname } from "next/navigation";
import { BellRing, GraduationCap, MailCheck, MapPin, Smartphone, UserPlus, type LucideIcon } from "lucide-react";

interface AsideCopy {
  heading: string;
  lead: string;
  points: { icon: LucideIcon; title: string; body: string }[];
}

/** What the account is for. Every line describes a feature this platform actually ships. */
const PUBLIC_COPY: AsideCopy = {
  heading: "Skills that open the next door.",
  lead: "Your account is how you apply, learn and prove what you have learned — from the first form to the certificate.",
  points: [
    {
      icon: UserPlus,
      title: "One account, one login",
      body: "Students, volunteer trainers and Foundation staff all sign in here.",
    },
    {
      icon: MapPin,
      title: "Apply at a centre near you",
      body: "Pick a course and a training centre in your own block or district.",
    },
    {
      icon: GraduationCap,
      title: "Follow your whole journey",
      body: "Application status, batch schedule, attendance and certificates in one place.",
    },
  ],
};

/** Secure Admin Login. Again, only what the admin sign-in really does. */
const ADMIN_COPY: AsideCopy = {
  heading: "The Foundation's admin panel.",
  lead: "Centres, courses, admissions, payments and certificates are managed from here — so every sign-in is checked more than once.",
  points: [
    {
      icon: MailCheck,
      title: "Passwordless Secure Login",
      body: "A single-use code is emailed to your registered address and expires in minutes.",
    },
    {
      icon: Smartphone,
      title: "Authenticator app as a second step",
      body: "With two-factor on, a code from your authenticator app (or a backup code) is needed too.",
    },
    {
      icon: BellRing,
      title: "Every sign-in is recorded",
      body: "Sign-ins from a new device raise an alert in the Security Center.",
    },
  ],
};

/**
 * The words in the navy auth panel. The layout is a server component and cannot see the path, so
 * this small client piece picks the admin copy on /login/admin and the public copy everywhere else.
 */
export function AuthAsideCopy() {
  const pathname = usePathname() ?? "";
  const copy = pathname === "/login/admin" || pathname.startsWith("/login/admin/") ? ADMIN_COPY : PUBLIC_COPY;
  return (
    <div className="max-w-md">
      <h2 className="text-h1 text-white">{copy.heading}</h2>
      <p className="text-body-lg mt-4 text-white/75">{copy.lead}</p>

      <ul className="mt-10 space-y-6">
        {copy.points.map((s) => (
          <li key={s.title} className="flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/10 text-white ring-1 ring-white/15 ring-inset" aria-hidden>
              <s.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="text-h4 block text-white">{s.title}</span>
              <span className="text-body-sm mt-1 block text-white/70">{s.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
