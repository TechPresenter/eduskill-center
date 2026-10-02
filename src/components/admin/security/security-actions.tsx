"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, CheckCircle2, History, KeyRound, LogIn, LogOut, Power, Unlock, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import { RecordActions, type RecordActionItem } from "@/components/admin/shared/record-actions";

/*
 * Security Center actions. Every destructive one goes through a ConfirmDialog that spells out what
 * happens to the other person. The dialog lives OUTSIDE the "…" menu (the menu only sets which request
 * is pending), so closing the menu can never unmount a dialog the administrator is still reading.
 */

export interface ConfirmedRequest {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  method: "post" | "delete";
  url: string;
  body?: unknown;
  success: string;
  /** Optional second toast line built from the API response. */
  detail?: (data: unknown) => string | undefined;
}

/** One confirmation dialog driven by state: `ask(request)` opens it, Confirm calls the API and refreshes. */
export function useConfirmedRequest() {
  const router = useRouter();
  const [request, setRequest] = React.useState<ConfirmedRequest | null>(null);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const ask = React.useCallback((r: ConfirmedRequest) => {
    setRequest(r);
    setOpen(true);
  }, []);

  const run = async () => {
    if (!request) return;
    setBusy(true);
    try {
      const data = request.method === "delete" ? await api.delete<unknown>(request.url) : await api.post<unknown>(request.url, request.body ?? {});
      toast.success(request.success, request.detail?.(data));
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error("Action failed", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // `request` is kept after closing so the dialog keeps its text during the exit animation.
  const dialog = (
    <ConfirmDialog
      open={open}
      onClose={() => !busy && setOpen(false)}
      onConfirm={run}
      title={request?.title}
      description={request?.description}
      confirmLabel={request?.confirmLabel}
      danger={request?.danger}
      loading={busy}
    />
  );
  return { ask, dialog, busy };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function revokedDetail(data: unknown): string | undefined {
  const n = data && typeof data === "object" ? ((data as { revoked?: number; revokedSessions?: number }).revoked ?? (data as { revokedSessions?: number }).revokedSessions) : undefined;
  return typeof n === "number" ? `${plural(n, "session")} ended.` : undefined;
}

// ───────────────────────────── Requests (shared with the staff profile) ─────────────────────────────

export function signOutEverywhereRequest(target: { id: string; name: string; self?: boolean; activeSessions?: number; twoFactor?: boolean }): ConfirmedRequest {
  const n = target.activeSessions;
  return target.self
    ? {
        title: "Sign out your other devices?",
        description: "Every other session of your account ends now. This device stays signed in.",
        confirmLabel: "Sign out other devices",
        danger: true,
        method: "post",
        url: `/api/admin/security/admins/${target.id}/revoke-sessions`,
        success: "Other devices signed out",
        detail: revokedDetail,
      }
    : {
        title: `Sign ${target.name} out everywhere?`,
        description: (
          <div className="space-y-2">
            <p>
              {n !== undefined ? `All ${plural(n, "active session")} of ${target.name} end` : `Every active session of ${target.name} ends`} immediately, on every phone and computer. Anything they have not saved is lost.
            </p>
            <p>
              They can sign in again straight away{target.twoFactor ? " with their email code and authenticator" : ""}. Their account stays active — use <strong>Disable account</strong> to stop them signing in.
            </p>
          </div>
        ),
        confirmLabel: "Sign out everywhere",
        danger: true,
        method: "post",
        url: `/api/admin/security/admins/${target.id}/revoke-sessions`,
        success: `${target.name} was signed out everywhere`,
        detail: revokedDetail,
      };
}

export function resetTwoFactorRequest(target: { id: string; name: string; backupCodesLeft?: number; required?: boolean }): ConfirmedRequest {
  return {
    title: `Reset two-factor authentication for ${target.name}?`,
    description: (
      <div className="space-y-2">
        <p>
          Their authenticator app{target.backupCodesLeft !== undefined ? ` and ${plural(target.backupCodesLeft, "unused backup code")}` : " and backup codes"} stop working immediately, and they are signed out of every device.
        </p>
        <p>
          {target.required
            ? "Two-factor authentication is required, so they must set up a new authenticator app the next time they sign in."
            : "Until they set up a new authenticator app from My account, they sign in without a second factor."}{" "}
          They are emailed that you reset it.
        </p>
        <p className="font-semibold text-ink">Only do this after confirming their identity in person or by phone — someone asking to remove 2FA is a classic account-takeover trick.</p>
      </div>
    ),
    confirmLabel: "Reset 2FA",
    danger: true,
    method: "post",
    url: `/api/admin/security/admins/${target.id}/reset-2fa`,
    success: `Two-factor authentication reset for ${target.name}`,
    detail: revokedDetail,
  };
}

function unlockRequest(target: { id: string; name: string }): ConfirmedRequest {
  return {
    title: `Unlock sign-in for ${target.name}?`,
    description: "Clears the failed password and failed authenticator-code counters so they can sign in again right away. Do this only once you are sure the failed attempts were theirs.",
    confirmLabel: "Unlock",
    method: "post",
    url: `/api/admin/security/admins/${target.id}/unlock`,
    success: `${target.name} can sign in again`,
  };
}

function statusRequest(target: { id: string; name: string }, enable: boolean): ConfirmedRequest {
  return enable
    ? {
        title: `Enable ${target.name}'s account?`,
        description: "They can sign in again with their usual sign-in steps. Their role and permissions are unchanged.",
        confirmLabel: "Enable account",
        method: "post",
        url: `/api/admin/security/admins/${target.id}/status`,
        body: { status: "ACTIVE" },
        success: "Account enabled",
      }
    : {
        title: `Disable ${target.name}'s account?`,
        description: (
          <div className="space-y-2">
            <p>They are signed out of every device now and cannot sign in until a Super Admin enables the account again.</p>
            <p>Their records, role and audit history are kept. Use this for a lost device, a suspected compromise or someone leaving the Foundation.</p>
          </div>
        ),
        confirmLabel: "Disable account",
        danger: true,
        method: "post",
        url: `/api/admin/security/admins/${target.id}/status`,
        body: { status: "SUSPENDED" },
        success: "Account disabled",
        detail: revokedDetail,
      };
}

// ───────────────────────────── Sessions ─────────────────────────────

export function RevokeSessionButton({ sessionId, userName, device, self }: { sessionId: string; userName: string; device: string; self?: boolean }) {
  const { ask, dialog } = useConfirmedRequest();
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="pointer-coarse:min-h-11"
        leftIcon={<LogOut className="h-4 w-4" aria-hidden />}
        aria-label={`Sign out ${self ? "your" : `${userName}'s`} session on ${device}`}
        onClick={() =>
          ask({
            title: "Sign out this session?",
            description: self
              ? `Your session on ${device} ends now. Anyone using it is sent back to the sign-in screen.`
              : `${userName} is signed out on ${device} immediately and must sign in again on that device. Their other sessions are not affected.`,
            confirmLabel: "Sign out",
            danger: true,
            method: "delete",
            url: `/api/admin/security/sessions/${sessionId}`,
            success: "Session signed out",
          })
        }
      >
        Sign out
      </Button>
      {dialog}
    </>
  );
}

// ───────────────────────────── Administrators ─────────────────────────────

export interface AdministratorRow {
  id: string;
  staffId: string | null;
  name: string;
  status: string;
  self: boolean;
  locked: boolean;
  twoFactor: boolean;
  backupCodesLeft: number;
  activeSessions: number;
  canManage: boolean;
}

/** "…" menu for one administrator. `superAdmin` unlocks Reset 2FA and Disable / Enable (never on yourself). */
export function AdministratorActions({ admin, superAdmin, canViewStaff, twoFactorRequired }: { admin: AdministratorRow; superAdmin: boolean; canViewStaff: boolean; twoFactorRequired: boolean }) {
  const { ask, dialog } = useConfirmedRequest();
  const superOnOther = superAdmin && !admin.self;
  const others = admin.self ? Math.max(0, admin.activeSessions - 1) : admin.activeSessions;

  const items: RecordActionItem[] = [
    { label: "View sessions", href: `/admin/security/sessions?userId=${admin.id}`, icon: <LogIn className="h-4 w-4" aria-hidden /> },
    { label: "View sign-in activity", href: `/admin/security/activity?userId=${admin.id}`, icon: <History className="h-4 w-4" aria-hidden /> },
    { label: "Open staff profile", href: admin.staffId ? `/admin/staff/${admin.staffId}` : undefined, icon: <UserCog className="h-4 w-4" aria-hidden />, hidden: !admin.staffId || !canViewStaff },
    {
      label: admin.self ? "Sign out my other devices" : "Sign out all devices",
      icon: <LogOut className="h-4 w-4" aria-hidden />,
      separator: true,
      hidden: !admin.canManage,
      disabled: others === 0,
      onClick: () => ask(signOutEverywhereRequest({ id: admin.id, name: admin.name, self: admin.self, activeSessions: admin.activeSessions, twoFactor: admin.twoFactor })),
    },
    { label: "Unlock sign-in", icon: <Unlock className="h-4 w-4" aria-hidden />, hidden: !admin.canManage || !admin.locked, onClick: () => ask(unlockRequest(admin)) },
    { label: "Reset 2FA", icon: <KeyRound className="h-4 w-4" aria-hidden />, danger: true, hidden: !superOnOther || !admin.twoFactor, onClick: () => ask(resetTwoFactorRequest({ ...admin, required: twoFactorRequired })) },
    admin.status === "ACTIVE"
      ? { label: "Disable account", icon: <Power className="h-4 w-4" aria-hidden />, danger: true, hidden: !superOnOther, onClick: () => ask(statusRequest(admin, false)) }
      : { label: "Enable account", icon: <Power className="h-4 w-4" aria-hidden />, hidden: !superOnOther, onClick: () => ask(statusRequest(admin, true)) },
  ];

  return (
    <>
      <RecordActions label={`Security actions for ${admin.name}`} items={items} />
      {dialog}
    </>
  );
}

// ───────────────────────────── Alerts ─────────────────────────────

export function AckAlertButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const ack = async () => {
    setBusy(true);
    try {
      await api.post("/api/admin/security/alerts/ack", { ids: [id] });
      toast.success("Alert marked as reviewed");
      router.refresh();
    } catch (err) {
      toast.error("Could not update the alert", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button type="button" size="sm" variant="outline" className="pointer-coarse:min-h-11" loading={busy} onClick={ack} leftIcon={<CheckCircle2 className="h-4 w-4" aria-hidden />} aria-label={`Mark reviewed: ${title}`}>
      Mark reviewed
    </Button>
  );
}

export function AckAllAlertsButton({ count }: { count: number }) {
  const { ask, dialog } = useConfirmedRequest();
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="pointer-coarse:min-h-11"
        disabled={count === 0}
        leftIcon={<CheckCheck className="h-4 w-4" aria-hidden />}
        onClick={() =>
          ask({
            title: "Mark every open alert as reviewed?",
            description: `All ${plural(count, "open alert")} you can see move to Reviewed — not only the ones on this page or matching the current filter. Do this only after you have looked at each one. Your name is recorded in the audit log.`,
            confirmLabel: "Mark all reviewed",
            method: "post",
            url: "/api/admin/security/alerts/ack",
            body: { all: true },
            success: "Alerts marked as reviewed",
            detail: (data) => {
              const n = data && typeof data === "object" ? (data as { acknowledged?: number }).acknowledged : undefined;
              return typeof n === "number" ? `${plural(n, "alert")} updated.` : undefined;
            },
          })
        }
      >
        Mark all reviewed
      </Button>
      {dialog}
    </>
  );
}
