import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, postLoginRedirect } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Login", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const user = await getSessionUser();
  if (user) redirect(postLoginRedirect(next, user.role));
  // `?method=admission` opens the admission-number tab directly (links from the student ID card or
  // an admission SMS). Anything else keeps the Password default.
  return <LoginForm next={next} registered={sp.registered === "1"} reset={sp.reset === "1"} method={sp.method === "admission" ? "admission" : "password"} />;
}
