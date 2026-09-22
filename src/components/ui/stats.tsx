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
  success: "bg-success-light text-success-dark",
  info: "bg-info-light text-blue-700",
  warning: "bg-warning-light text-amber-700",
};

export function StatsCard({ label, value, icon, hint, delta, deltaLabel, href, tone = "orange", className }: StatsCardProps) {
  const body = (
    <div className={cn("card card-p flex items-start gap-4", href && "card-hover", className)}>
      {icon && <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-md", TONES[tone])}>{icon}</div>}
      <div className="min-w-0 flex-1">
        <p className="text-caption truncate font-semibold tracking-wide text-muted uppercase">{label}</p>
        {/* The number is the point of this card: one step up from a card title, tabular so columns of stats align. */}
        <p className="text-h2 mt-1 text-navy tabular-nums">{typeof value === "number" ? formatNumber(value) : value}</p>
        {(hint || delta !== undefined) && (
          <p className="text-caption mt-1.5 flex items-center gap-1 font-normal text-muted">
            {delta !== undefined && (
              <span className={cn("inline-flex items-center gap-0.5 font-semibold", delta >= 0 ? "text-success-dark" : "text-danger")}>
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
  return href ? (
    <Link href={href} className="ring-focus block rounded-card">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Linear progress (course progress, upload progress). Fill animates in 300ms; static under prefers-reduced-motion. */
export function ProgressBar({ value, max = 100, className, tone = "orange", label }: { value: number; max?: number; className?: string; tone?: "orange" | "navy" | "success" | "warning" | "danger"; label?: string }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  const bar = { orange: "bg-orange", navy: "bg-navy", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="text-caption flex justify-between gap-3">
          <span className="font-semibold text-ink">{label}</span>
          <span className="shrink-0 text-muted tabular-nums">{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-line/70" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cn("duration-element h-full rounded-full transition-[width] motion-reduce:transition-none", bar)} style={{ width: `${pct}%` }} />
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
          className="duration-element transition-[stroke-dashoffset] motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <span className="font-heading text-lg font-extrabold text-navy tabular-nums">{Math.round(pct)}%</span>
        {/* 12px is the floor: this label used to be 10px and was being force-corrected by globals.css. */}
        {label && <span className="text-caption text-muted uppercase">{label}</span>}
      </div>
    </div>
  );
}
