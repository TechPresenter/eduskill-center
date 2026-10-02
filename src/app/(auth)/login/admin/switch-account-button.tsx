"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";

/** Signs the current (non-admin) account out and reloads Secure Admin Login in place. */
export function SwitchAccountButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await api.post("/api/auth/logout");
      router.refresh();
    } catch (err) {
      toast.error("Could not sign out", errorMessage(err, "Please try again."));
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="lg" fullWidth loading={busy} onClick={() => void signOut()} leftIcon={<LogOut className="h-4 w-4" aria-hidden />}>
      Sign out and switch account
    </Button>
  );
}
