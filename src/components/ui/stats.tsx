import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

export interface StatsCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  delta?: number;
  deltaLabel?: string;
  href?: string;
  tone?: "orange" | "navy" | "success" | "info" | "warning";
  className?: string;
}

const TONES = {
  orange: "bg-orange-light text-orange",
  navy: "bg-navy-soft text-navy",
  success: "bg-success-light text-green-700",
  info: "bg-info-light text-blue-700",
  warning: "bg-warning-light text-amber-700",
};

export function StatsCard({ label, value, icon, hint, delta, deltaLabel, href, tone = "orange", className }: StatsCardProps) {
  const body = (
    <div className={cn("card flex items-start gap-4 p-5", href && "card-hover", className)}>
      {icon && <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", TONES[tone])}>{icon}</div>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
        <p className="mt-1 font-heading text-2xl font-extrabold text-navy tabular-nums">{typeof value === "number" ? formatNumber(value) : value}</p>
        {(hint || delta !== undefined) && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted">
            {delta !== undefined && (
              <span className={cn("inline-flex items-center gap-0.5 font-semibold", delta >= 0 ? "text-green-700" : "text-danger")}>
                {delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {Math.abs(delta)}%
              </span>
            )}
            {deltaLabel ?? hint}
          </p>
        )}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/** Linear progress (course progress, upload progress). Fill animates in 300ms; static under prefers-reduced-motion. */
export function ProgressBar({ value, max = 100, className, tone = "orange", label }: { value: number; max?: number; className?: string; tone?: "orange" | "navy" | "success" | "warning" | "danger"; label?: string }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  const bar = { orange: "bg-orange", navy: "bg-navy", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <div className="flex justify-between text-xs">
          <span className="font-medium text-ink">{label}</span>
          <span className="text-muted tabular-nums">{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-line/70" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cn("h-full rounded-full transition-all duration-300 motion-reduce:transition-none", bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function RingProgress({ value, size = 96, stroke = 8, label, className }: { value: number; size?: number; stroke?: number; label?: React.ReactNode; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e4e7ec" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#e8520a"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          className="transition-all duration-300 motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-lg font-extrabold text-navy tabular-nums">{Math.round(pct)}%</span>
        {label && <span className="text-[10px] font-medium text-muted uppercase">{label}</span>}
      </div>
    </div>
  );
}
