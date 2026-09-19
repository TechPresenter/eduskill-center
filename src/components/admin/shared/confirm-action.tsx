"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { DropdownItem } from "@/components/ui/dropdown";
import { api, errorMessage } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface ConfirmActionProps {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  method?: "post" | "put" | "patch" | "delete";
  url: string;
  body?: unknown;
  successMessage?: string;
  /** Navigate here after success instead of only refreshing. */
  redirectTo?: string;
  onDone?: (data: unknown) => void;
  children: React.ReactNode;
  /** Render as a dropdown menu item instead of a button. */
  asMenuItem?: boolean;
  icon?: React.ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  disabled?: boolean;
}

/** Button (or menu item) that asks for confirmation, calls the API, then refreshes the page. */
export function ConfirmAction({ title, description, confirmLabel = "Confirm", danger, method = "post", url, body, successMessage, redirectTo, onDone, children, asMenuItem, icon, variant = "outline", size = "sm", className, disabled }: ConfirmActionProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const data = method === "delete" ? await api.delete<unknown>(url) : await api[method]<unknown>(url, body);
      toast.success(successMessage ?? "Done");
      setOpen(false);
      onDone?.(data);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (err) {
      toast.error("Action failed", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {asMenuItem ? (
        <DropdownItem
          danger={danger}
          icon={icon}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          {children}
        </DropdownItem>
      ) : (
        // `pointer-coarse:min-h-11` keeps the compact desktop size while guaranteeing a 44px touch target.
        <Button type="button" variant={danger ? "danger" : variant} size={size} onClick={() => setOpen(true)} leftIcon={icon} className={cn("pointer-coarse:min-h-11", className)} disabled={disabled}>
          {children}
        </Button>
      )}
      <ConfirmDialog open={open} onClose={() => !busy && setOpen(false)} onConfirm={run} title={title} description={description} confirmLabel={confirmLabel} danger={danger} loading={busy} />
    </>
  );
}
