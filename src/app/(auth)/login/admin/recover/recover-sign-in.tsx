"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, LifeBuoy } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { api, ApiClientError } from "@/lib/api-client";
import { AuthCard } from "../../../auth-card";

type Phase = "checking" | "done" | "failed";

const INVALID = "This recovery link is not valid any more. Links work once and only for 15 minutes. Ask the server administrator for a new one.";

/**
 * Reads `?token=` from the address bar exactly once, removes it from the URL (and so from history,
 * bookmarks and screenshots) BEFORE anything else happens, then POSTs it to /api/auth/admin/recover.
 * React Strict Mode runs the effect twice in development; the ref keeps it to one request.
 */
export function RecoverSignIn() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const url = new URL(window.location.href);
    const token = url.searchParams.get("token") ?? "";
    if (url.searchParams.has("token")) {
      url.searchParams.delete("token");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }

    api
      .post<{ redirect: string }>("/api/auth/admin/recover", { token })
      .then((data) => {
        setPhase("done");
        router.replace(data.redirect);
        router.refresh();
      })
      .catch((err: unknown) => {
        setPhase("failed");
        setMessage(err instanceof ApiClientError && err.status === 429 ? "Too many attempts. Please wait a few minutes and try again." : INVALID);
      });
  }, [router]);

  return (
    <AuthCard eyebrow="Secure Admin Login" title="Recovery sign-in" description="A one-time link issued by the server administrator for an administrator who is locked out.">
      <div aria-live="polite">
        {phase === "checking" && (
          <p className="text-body flex items-center gap-3 text-muted" role="status">
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden />
            Checking the link…
          </p>
        )}
        {phase === "done" && (
          <p className="text-body flex items-center gap-3 font-semibold text-navy" role="status">
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
            Verified — signing you in…
          </p>
        )}
        {phase === "failed" && (
          <div className="space-y-4">
            <Alert tone="danger">{message}</Alert>
            <ButtonLink href="/login/admin" size="lg" fullWidth leftIcon={<LifeBuoy className="h-4 w-4" aria-hidden />}>
              Go to Secure Admin Login
            </ButtonLink>
          </div>
        )}
      </div>
    </AuthCard>
  );
}
