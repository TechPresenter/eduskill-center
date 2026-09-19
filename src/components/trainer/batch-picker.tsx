"use client";

import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form";
import { titleCase } from "@/lib/utils";
import type { BatchOption } from "@/components/trainer/types";

export function BatchPicker({
  batches,
  value,
  onChange,
  label = "Batch",
  id = "batchId",
  disabled,
  className,
  error,
  placeholder = "Select a batch",
}: {
  batches: BatchOption[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label} htmlFor={id} className={className} error={error}>
      <Select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        invalid={!!error}
        options={batches.map((b) => ({ value: b.id, label: `${b.name} (${b.code}) · ${titleCase(b.status)}` }))}
      />
    </Field>
  );
}
