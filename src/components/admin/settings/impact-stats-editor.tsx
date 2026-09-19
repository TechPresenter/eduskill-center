"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, FormGrid } from "@/components/ui/form";
import { Input, Checkbox, RadioCards } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";
import { useApiForm } from "@/components/admin/shared/use-api-form";

export interface ImpactStatRow {
  id: string;
  key: string;
  label: string;
  source: "AUTO" | "MANUAL";
  manualValue: number | null;
  suffix: string;
  sortOrder: number;
  isActive: boolean;
  autoValue: number | null;
  effectiveValue: number | null;
}

const AUTO_HELP: Record<string, string> = {
  students: "Registered students with a Student ID",
  centers: "Active training centers",
  trainers: "Active volunteer trainers",
  states: "States with at least one active center",
  completion: "Completed admissions ÷ (completed + dropped), as a percentage",
};

function StatForm({ stat, onDone, onCancel }: { stat: ImpactStatRow; onDone: () => void; onCancel: () => void }) {
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [label, setLabel] = React.useState(stat.label);
  const [source, setSource] = React.useState<"AUTO" | "MANUAL">(stat.source);
  const [manualValue, setManualValue] = React.useState(stat.manualValue?.toString() ?? "");
  const [suffix, setSuffix] = React.useState(stat.suffix);
  const [sortOrder, setSortOrder] = React.useState(String(stat.sortOrder));
  const [isActive, setIsActive] = React.useState(stat.isActive);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { label, source, manualValue: manualValue.trim() === "" ? "" : Number(manualValue), suffix, sortOrder: Number(sortOrder) || 0, isActive };
    const res = await submit(() => api.put(`/api/admin/impact-stats/${stat.id}`, body), { silent: true });
    if (res !== undefined) {
      toast.success("Impact stat updated", label);
      onDone();
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      <Field label="Label" htmlFor="is-label" required error={fieldErrors.label}>
        <Input id="is-label" value={label} onChange={(e) => { setLabel(e.target.value); clearField("label"); }} required maxLength={80} invalid={!!fieldErrors.label} />
      </Field>
      <Field label="Value source" error={fieldErrors.source}>
        <RadioCards
          name="source"
          value={source}
          onChange={(v) => setSource(v as "AUTO" | "MANUAL")}
          columns={2}
          options={[
            { value: "AUTO", label: "Computed automatically", description: `${AUTO_HELP[stat.key] ?? "Live database value"} · currently ${stat.autoValue === null ? "n/a" : formatNumber(stat.autoValue)}` },
            { value: "MANUAL", label: "Manual value", description: "Enter the number to display on the website." },
          ]}
        />
      </Field>
      <FormGrid cols={3}>
        <Field label="Manual value" htmlFor="is-manual" required={source === "MANUAL"} error={fieldErrors.manualValue} hint={source === "AUTO" ? "Ignored while the source is automatic." : undefined}>
          <Input id="is-manual" type="number" min={0} value={manualValue} onChange={(e) => { setManualValue(e.target.value); clearField("manualValue"); }} disabled={source === "AUTO"} invalid={!!fieldErrors.manualValue} />
        </Field>
        <Field label="Suffix" htmlFor="is-suffix" error={fieldErrors.suffix} hint="e.g. + or %">
          <Input id="is-suffix" value={suffix} onChange={(e) => setSuffix(e.target.value)} maxLength={5} />
        </Field>
        <Field label="Sort order" htmlFor="is-sort" error={fieldErrors.sortOrder}>
          <Input id="is-sort" type="number" min={0} max={1000} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
      </FormGrid>
      <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} label="Show on the website" />
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Save
        </Button>
      </div>
    </form>
  );
}

export function ImpactStatsEditor({ rows, canUpdate }: { rows: ImpactStatRow[]; canUpdate: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<ImpactStatRow | null>(null);
  return (
    <>
      <TableWrap>
        <THead>
          <tr>
            <TH>Stat</TH>
            <TH>Source</TH>
            <TH className="text-right">Computed value</TH>
            <TH className="text-right">Manual value</TH>
            <TH className="text-right">Shown on website</TH>
            <TH>Visible</TH>
            <TH className="text-right">
              <span className="sr-only">Actions</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && <EmptyRow colSpan={7}>No impact stats configured.</EmptyRow>}
          {rows.map((s) => (
            <TR key={s.id}>
              <TD>
                <span className="block font-semibold">{s.label}</span>
                <span className="block text-xs text-muted">{AUTO_HELP[s.key] ?? s.key}</span>
              </TD>
              <TD>
                <Badge tone={s.source === "AUTO" ? "info" : "orange"}>{s.source === "AUTO" ? "Automatic" : "Manual"}</Badge>
              </TD>
              <TD className="text-right tabular-nums">{s.autoValue === null ? <span className="text-muted">n/a</span> : formatNumber(s.autoValue)}</TD>
              <TD className="text-right tabular-nums">{s.manualValue === null ? <span className="text-muted">—</span> : formatNumber(s.manualValue)}</TD>
              <TD className="text-right font-semibold text-navy tabular-nums">
                {s.effectiveValue === null ? "—" : formatNumber(s.effectiveValue)}
                {s.effectiveValue !== null && s.suffix}
              </TD>
              <TD>
                <Badge tone={s.isActive ? "success" : "neutral"} dot>
                  {s.isActive ? "Visible" : "Hidden"}
                </Badge>
              </TD>
              <TD className="text-right">
                {canUpdate && (
                  <Button size="xs" variant="outline" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(s)}>
                    Edit
                  </Button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </TableWrap>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit “${editing.label}”` : ""} size="lg">
        {editing && (
          <StatForm
            stat={editing}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        )}
      </Modal>
    </>
  );
}
