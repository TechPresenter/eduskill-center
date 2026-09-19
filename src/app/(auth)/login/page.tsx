import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, portalHome } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Login", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const user = await getSessionUser();
  if (user) redirect(next && next.startsWith("/") ? next : portalHome(user.role));
  return <LoginForm next={next} registered={sp.registered === "1"} reset={sp.reset === "1"} />;
}
