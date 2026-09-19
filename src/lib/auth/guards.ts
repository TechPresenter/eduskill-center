import { redirect } from "next/navigation";
import type { UserRole } from "@/generated/prisma/enums";
import { getSessionUser, portalHome, type AuthUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";

/** Server-component guard: redirects to login when unauthenticated, or to the user's own portal when the role does not match. */
export async function requireUser(opts: { roles?: UserRole[]; redirectTo?: string } = {}): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) {
    const next = opts.redirectTo ? `?next=${encodeURIComponent(opts.redirectTo)}` : "";
    redirect(`/login${next}`);
  }
  if (opts.roles && !opts.roles.includes(user.role)) {
    redirect(portalHome(user.role));
  }
  return user;
}

export async function requireAdmin(permission?: string | string[], redirectTo?: string): Promise<AuthUser> {
  const user = await requireUser({ roles: ["SUPER_ADMIN", "STAFF"], redirectTo });
  if (permission && !hasPermission(user, permission)) {
    redirect("/admin/forbidden");
  }
  return user;
}

export type StudentAuthUser = AuthUser & { student: NonNullable<AuthUser["student"]> };
export type TrainerAuthUser = AuthUser & { trainer: NonNullable<AuthUser["trainer"]> };

export async function requireStudent(redirectTo?: string): Promise<StudentAuthUser> {
  const user = await requireUser({ roles: ["STUDENT"], redirectTo });
  if (!user.student) redirect("/login");
  return user as StudentAuthUser;
}

export async function requireTrainer(redirectTo?: string): Promise<TrainerAuthUser> {
  const user = await requireUser({ roles: ["TRAINER"], redirectTo });
  if (!user.trainer) redirect("/login");
  return user as TrainerAuthUser;
}
