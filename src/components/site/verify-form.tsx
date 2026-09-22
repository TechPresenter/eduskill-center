"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Hash, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

/**
 * Certificate lookup. The result lives at a real URL (`/verify-certificate/<no>`) so it can be
 * shared and linked as proof — `router.push` is the whole submit, and Next applies the base path.
 */
export function VerifyCertificateForm({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const cleaned = value.trim().toUpperCase();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleaned) return;
    setBusy(true);
    router.push(`/verify-certificate/${encodeURIComponent(cleaned)}`);
  };

  return (
    <form onSubmit={submit} className="card rounded-card-lg p-6 sm:p-8" aria-label="Verify a certificate">
      <Field label="Certificate number" htmlFor="cert-no" required hint="Printed on the certificate, usually under the title or beside the QR code.">
        <Input
          id="cert-no"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ESK-CERT-YYYY-NNNNNN"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="characters"
          leftIcon={<Hash className="h-4 w-4" />}
          className="font-medium uppercase tracking-wide tabular-nums"
          required
        />
      </Field>
      <Button type="submit" size="lg" className="mt-5" fullWidth loading={busy} disabled={!cleaned} leftIcon={<ShieldCheck className="h-5 w-5" />}>
        Verify certificate
      </Button>
      <p className="mt-4 text-center text-caption text-muted">Verification is free, instant and needs no account.</p>
    </form>
  );
}
