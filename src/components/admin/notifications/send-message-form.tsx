"use client";

import * as React from "react";
import { Search, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { titleCase } from "@/lib/utils";

interface UserHit {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  role: string;
  status: string;
  code: string | null;
}

export function SendMessageForm({ enabled }: { enabled: { EMAIL: boolean; SMS: boolean; WHATSAPP: boolean } }) {
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<UserHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [user, setUser] = React.useState<UserHit | null>(null);
  const [channels, setChannels] = React.useState<Record<string, boolean>>({ EMAIL: enabled.EMAIL, SMS: false, WHATSAPP: false });
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    if (user || q.trim().length < 2) return;
    const t = setTimeout(() => {
      setSearching(true);
      api
        .get<UserHit[]>(`/api/admin/notifications/users?q=${encodeURIComponent(q.trim())}`)
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrors({ userId: "Choose a recipient" });
      return;
    }
    setBusy(true);
    setErrors({});
    setFormError(null);
    setSent(null);
    try {
      const chosen = ["IN_APP", ...Object.entries(channels).filter(([, v]) => v).map(([k]) => k)];
      const r = await api.post<{ channels: string[] }>("/api/admin/notifications/send", { userId: user.id, channels: chosen, subject, body });
      setSent(r.channels);
      toast.success("Message sent", `Delivered via ${r.channels.map((c) => c.replace("_", "-").toLowerCase()).join(", ")}.`);
      setSubject("");
      setBody("");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else setFormError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card max-w-3xl space-y-5 p-5" noValidate>
      {formError && <Alert tone="danger">{formError}</Alert>}
      {sent && (
        <Alert tone="success" title="Message sent">
          Delivered to {user?.name} via {sent.map((c) => c.replace("_", "-").toLowerCase()).join(", ")}. Email/SMS delivery results appear in the Sent log.
        </Alert>
      )}

      <Field label="Recipient" htmlFor="sm-q" required error={errors.userId} hint={!user ? "Search by name, email, mobile, Student ID or Trainer ID." : undefined}>
        {user ? (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/50 p-3">
            <Avatar name={user.name} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {user.name} <Badge tone="navy" className="ml-1">{titleCase(user.role)}</Badge>
              </p>
              <p className="truncate text-xs text-muted">{[user.code, user.email, user.mobile].filter(Boolean).join(" · ")}</p>
            </div>
            <button type="button" onClick={() => { setUser(null); setQ(""); }} className="rounded-lg p-2 text-muted hover:bg-white hover:text-danger" aria-label="Change recipient">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Input
              id="sm-q"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (e.target.value.trim().length < 2) setHits([]);
              }}
              placeholder="Start typing…" leftIcon={<Search className="h-4 w-4" />} autoComplete="off" invalid={!!errors.userId} />
            {(hits.length > 0 || searching) && q.trim().length >= 2 && (
              <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-card-hover" role="listbox">
                {searching && hits.length === 0 && <li className="px-3 py-2 text-sm text-muted">Searching…</li>}
                {hits.map((h) => (
                  <li key={h.id}>
                    <button type="button" role="option" aria-selected={false} onClick={() => { setUser(h); setHits([]); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface">
                      <Avatar name={h.name} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {h.name} <span className="text-xs text-muted">· {titleCase(h.role)}</span>
                        </span>
                        <span className="block truncate text-xs text-muted">{[h.code, h.email, h.mobile].filter(Boolean).join(" · ")}</span>
                      </span>
                      {h.status !== "ACTIVE" && <Badge tone="warning">{titleCase(h.status)}</Badge>}
                    </button>
                  </li>
                ))}
                {!searching && hits.length === 0 && <li className="px-3 py-2 text-sm text-muted">No users found.</li>}
              </ul>
            )}
          </div>
        )}
      </Field>

      <Field label="Channels" error={errors.channels} hint="In-app is always delivered. Other channels must be enabled in Settings → Communication.">
        <div className="flex flex-wrap gap-4">
          <Checkbox label="In-app" checked disabled />
          <Checkbox label="Email" checked={!!channels.EMAIL} onChange={(e) => setChannels((c) => ({ ...c, EMAIL: e.target.checked }))} disabled={!enabled.EMAIL || (!!user && !user.email)} description={!enabled.EMAIL ? "Not enabled" : user && !user.email ? "No email on file" : undefined} />
          <Checkbox label="SMS" checked={!!channels.SMS} onChange={(e) => setChannels((c) => ({ ...c, SMS: e.target.checked }))} disabled={!enabled.SMS || (!!user && !user.mobile)} description={!enabled.SMS ? "Not enabled" : user && !user.mobile ? "No mobile on file" : undefined} />
          <Checkbox label="WhatsApp" checked={!!channels.WHATSAPP} onChange={(e) => setChannels((c) => ({ ...c, WHATSAPP: e.target.checked }))} disabled={!enabled.WHATSAPP || (!!user && !user.mobile)} description={!enabled.WHATSAPP ? "Not enabled" : user && !user.mobile ? "No mobile on file" : undefined} />
        </div>
      </Field>

      <Field label="Subject" htmlFor="sm-subject" required error={errors.subject}>
        <Input id="sm-subject" value={subject} onChange={(e) => setSubject(e.target.value)} invalid={!!errors.subject} required />
      </Field>
      <Field label="Message" htmlFor="sm-body" required error={errors.body}>
        <Textarea id="sm-body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} invalid={!!errors.body} required />
      </Field>
      <div className="flex justify-end border-t border-line pt-4">
        <Button type="submit" loading={busy} leftIcon={<Send className="h-4 w-4" />}>
          Send message
        </Button>
      </div>
    </form>
  );
}
