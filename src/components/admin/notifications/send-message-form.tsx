"use client";

import * as React from "react";
import { Bell, Mail, MessageCircle, MessageSquare, Search, Send, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Input, Textarea, CheckboxCards } from "@/components/ui/input";
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
    <form onSubmit={submit} className="card card-p max-w-3xl space-y-5" noValidate>
      {formError && <Alert tone="danger">{formError}</Alert>}
      {sent && (
        <Alert tone="success" title="Message sent">
          Delivered to {user?.name} via {sent.map((c) => c.replace("_", "-").toLowerCase()).join(", ")}. Email/SMS delivery results appear in the Sent log.
        </Alert>
      )}

      <Field label="Recipient" htmlFor="sm-q" required error={errors.userId} hint={!user ? "Search by name, email, mobile, Student ID or Trainer ID." : undefined}>
        {user ? (
          <div className="flex items-center gap-3 rounded-card border border-line bg-surface/50 p-3">
            <Avatar name={user.name} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-semibold text-ink">{user.name}</p>
              <p className="truncate text-caption text-muted">{[user.code, user.email, user.mobile].filter(Boolean).join(" · ")}</p>
              <Badge tone="navy" className="mt-1">
                {titleCase(user.role)}
              </Badge>
            </div>
            <IconButton
              icon={<X className="h-4 w-4" />}
              onClick={() => {
                setUser(null);
                setQ("");
              }}
              aria-label="Change recipient"
              className="hover:bg-white hover:text-danger"
            />
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
              <ul className="absolute z-overlay mt-1 max-h-72 w-full overflow-y-auto rounded-card border border-line bg-white p-1 shadow-e3" role="listbox" aria-label="Matching users">
                {searching && hits.length === 0 && <li className="px-3 py-3 text-body-sm text-muted">Searching…</li>}
                {hits.map((h) => (
                  <li key={h.id}>
                    <button type="button" role="option" aria-selected={false} onClick={() => { setUser(h); setHits([]); }} className="flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left tap-highlight-none transition-colors duration-micro active:bg-surface hover:bg-surface motion-reduce:transition-none">
                      <Avatar name={h.name} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm font-semibold text-ink">
                          {h.name} <span className="font-normal text-muted">· {titleCase(h.role)}</span>
                        </span>
                        <span className="block truncate text-caption text-muted">{[h.code, h.email, h.mobile].filter(Boolean).join(" · ")}</span>
                      </span>
                      {h.status !== "ACTIVE" && <Badge tone="warning">{titleCase(h.status)}</Badge>}
                    </button>
                  </li>
                ))}
                {!searching && hits.length === 0 && <li className="px-3 py-3 text-body-sm text-muted">No users found.</li>}
              </ul>
            )}
          </div>
        )}
      </Field>

      <Field label="Channels" error={errors.channels} hint="In-app is always delivered. Other channels must be enabled in Settings → Communication.">
        <CheckboxCards
          name="channels"
          columns={2}
          value={["IN_APP", ...Object.entries(channels).filter(([, v]) => v).map(([k]) => k)]}
          onChange={(next) => setChannels({ EMAIL: next.includes("EMAIL"), SMS: next.includes("SMS"), WHATSAPP: next.includes("WHATSAPP") })}
          options={[
            { value: "IN_APP", label: "In-app", description: "Always delivered", icon: <Bell className="h-5 w-5" />, disabled: true },
            { value: "EMAIL", label: "Email", icon: <Mail className="h-5 w-5" />, disabled: !enabled.EMAIL || (!!user && !user.email), description: !enabled.EMAIL ? "Not enabled" : user && !user.email ? "No email on file" : undefined },
            { value: "SMS", label: "SMS", icon: <MessageSquare className="h-5 w-5" />, disabled: !enabled.SMS || (!!user && !user.mobile), description: !enabled.SMS ? "Not enabled" : user && !user.mobile ? "No mobile on file" : undefined },
            { value: "WHATSAPP", label: "WhatsApp", icon: <MessageCircle className="h-5 w-5" />, disabled: !enabled.WHATSAPP || (!!user && !user.mobile), description: !enabled.WHATSAPP ? "Not enabled" : user && !user.mobile ? "No mobile on file" : undefined },
          ]}
        />
      </Field>

      <Field label="Subject" htmlFor="sm-subject" required error={errors.subject}>
        <Input id="sm-subject" value={subject} onChange={(e) => setSubject(e.target.value)} invalid={!!errors.subject} required />
      </Field>
      <Field label="Message" htmlFor="sm-body" required error={errors.body}>
        <Textarea id="sm-body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} invalid={!!errors.body} required />
      </Field>
      <StickyActionBar innerClassName="lg:justify-end lg:border-t lg:border-line lg:pt-4">
        <Button type="submit" loading={busy} leftIcon={<Send className="h-4 w-4" />} className="flex-1 lg:flex-none">
          {user ? `Send to ${user.name.split(" ")[0]}` : "Send message"}
        </Button>
      </StickyActionBar>
    </form>
  );
}
