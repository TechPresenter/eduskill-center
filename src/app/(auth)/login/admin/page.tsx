import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, portalHome } from "@/lib/auth/session";
import { getChallengeToken } from "@/lib/auth/challenge-cookie";
import { isAdminRole } from "@/lib/auth/policy";
import { ButtonLink } from "@/components/ui/button";
import { CHALLENGE_TTL_MINUTES, adminLoginOptions, getAdminChallengeState, safeAdminNext } from "@/server/admin-auth";
import { AuthCard } from "../../auth-card";
import { AdminLogin, type AdminLoginReason } from "./admin-login";
import { SwitchAccountButton } from "./switch-account-button";

export const metadata: Metadata = {
  title: "Secure Admin Login",
  robots: { index: false, follow: false },
};

const PORTAL_NAME: Record<string, string> = { STUDENT: "student dashboard", TRAINER: "trainer dashboard" };

/**
 * Secure Admin Login — the sign-in for Super Admins and Foundation staff (src/server/admin-auth.ts).
 *
 * The page resolves the obvious cases on the server: an administrator who is already signed in goes
 * straight on, a student or trainer who is signed in is told so (with a way to switch account), and a
 * sign-in already in progress in this browser — started here or handed over by the password form —
 * is resumed at its step instead of flashing the email form first.
 */
export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === "string" ? sp.next : undefined;
  const next = safeAdminNext(rawNext);
  const reason: AdminLoginReason = sp.reason === "idle" ? "idle" : sp.reason === "expired" ? "expired" : null;

  const user = await getSessionUser();
  if (user && isAdminRole(user.role)) redirect(next);

  if (user) {
    return (
      <AuthCard
        eyebrow="Secure Admin Login"
        title="You are signed in to another account"
        description={
          <>
            This sign-in is for Foundation administrators. You are signed in as <span className="font-semibold text-ink">{user.name}</span>.
          </>
        }
      >
        <div className="space-y-3">
          <ButtonLink href={portalHome(user.role)} size="lg" fullWidth>
            Go to my {PORTAL_NAME[user.role] ?? "dashboard"}
          </ButtonLink>
          <SwitchAccountButton />
        </div>
      </AuthCard>
    );
  }

  const [options, state] = await Promise.all([adminLoginOptions(), getChallengeToken().then(getAdminChallengeState)]);

  return (
    <AdminLogin
      options={options}
      initialState={state}
      next={next}
      reason={reason}
      challengeTtlSec={CHALLENGE_TTL_MINUTES * 60}
    />
  );
}
