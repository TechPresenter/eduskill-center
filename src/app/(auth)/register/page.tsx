import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, portalHome } from "@/lib/auth/session";
import { getSetting } from "@/lib/settings";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Student Registration", description: "Create your EduSkill India Foundation student account to apply for courses at a training center near you." };

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect(portalHome(user.role));
  const open = await getSetting<boolean>("admissions.registrationOpen");
  return <RegisterForm open={open} />;
}
