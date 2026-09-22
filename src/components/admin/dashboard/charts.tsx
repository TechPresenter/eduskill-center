"use client";

import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table2, BarChart3 } from "lucide-react";
import { cn, formatINR, formatNumber } from "@/lib/utils";

/** Validated categorical palette (light surface): slot 1 navy, slot 2 orange, then teal, purple, gold. */
export const CHART_COLORS = ["#1d4aa3", "#e8520a", "#0e9f8e", "#8e6bd6", "#b8860b"] as const;
const GRID = "#e4e7ec";
const AXIS = "#667085";

export type SeriesDef = { key: string; label: string; color?: string; format?: "number" | "money" | "percent" };

function fmt(v: unknown, format: SeriesDef["format"]) {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  if (format === "money") return formatINR(n);
  if (format === "percent") return `${n}%`;
  return formatNumber(n);
}

interface ChartCardProps {
  title: string;
  description?: string;
  data: Record<string, string | number | null>[];
  series: SeriesDef[];
  /** Key holding the category / x-axis label. */
  labelKey: string;
  emptyText?: string;
  className?: string;
  height?: number;
  children: (ctx: { data: Record<string, string | number | null>[] }) => React.ReactNode;
}

/** Card with a title, a chart/table toggle (table view for accessibility) and an empty state. */
function ChartCard({ title, description, data, series, labelKey, emptyText = "No data yet.", className, height = 260, children }: ChartCardProps) {
  const [view, setView] = React.useState<"chart" | "table">("chart");
  const id = React.useId();
  const empty = data.length === 0 || data.every((d) => series.every((s) => !d[s.key]));
  return (
    <section className={cn("card flex flex-col p-5", className)} aria-labelledby={id}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={id} className="text-sm font-bold text-navy">
            {title}
          </h3>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {!empty && (
          <div className="flex shrink-0 rounded-md bg-surface p-0.5" role="tablist" aria-label={`${title} view`}>
            <button type="button" role="tab" aria-selected={view === "chart"} onClick={() => setView("chart")} className={cn("inline-flex items-center justify-center rounded-md p-1.5 max-sm:h-11 max-sm:w-11 pointer-coarse:h-11 pointer-coarse:w-11", view === "chart" ? "bg-white text-navy shadow-e1" : "text-muted hover:text-ink")} aria-label="Chart view">
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
            <button type="button" role="tab" aria-selected={view === "table"} onClick={() => setView("table")} className={cn("inline-flex items-center justify-center rounded-md p-1.5 max-sm:h-11 max-sm:w-11 pointer-coarse:h-11 pointer-coarse:w-11", view === "table" ? "bg-white text-navy shadow-e1" : "text-muted hover:text-ink")} aria-label="Table view">
              <Table2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {empty ? (
        <div className="flex flex-1 items-center justify-center rounded-card border border-dashed border-line bg-surface/60 text-body text-muted" style={{ minHeight: height }}>
          {emptyText}
        </div>
      ) : view === "table" ? (
        <div className="scrollbar-thin max-h-[320px] overflow-auto rounded-card border border-line">
          <table className="w-full text-left text-body-sm">
            <thead className="sticky top-0 z-raised bg-surface text-caption font-semibold tracking-wide text-muted uppercase">
              <tr>
                <th className="px-3 py-2">{labelKey === "month" ? "Month" : labelKey === "week" ? "Week" : "Name"}</th>
                {series.map((s) => (
                  <th key={s.key} className="px-3 py-2 text-right">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((d, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5 text-ink">{String(d[labelKey] ?? "")}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right text-ink tabular-nums">
                      {fmt(d[s.key], s.format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <figure role="img" aria-label={`${title}: ${series.map((s) => s.label).join(", ")} chart`} className="min-w-0" style={{ height }}>
          {children({ data })}
        </figure>
      )}
    </section>
  );
}

function ChartTooltip({ active, payload, label, series }: { active?: boolean; payload?: { dataKey?: string | number; value?: unknown; color?: string; name?: string }[]; label?: string | number; series: SeriesDef[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-body-sm shadow-e3">
      <p className="mb-1 font-semibold text-ink">{label}</p>
      {payload.map((p, i) => {
        const s = series.find((x) => x.key === p.dataKey);
        return (
          <p key={i} className="flex items-center gap-2 text-muted">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
            {s?.label ?? p.name}: <span className="font-semibold text-ink tabular-nums">{fmt(p.value, s?.format)}</span>
          </p>
        );
      })}
    </div>
  );
}

const tick = { fontSize: 12, fill: AXIS };

export function VerticalBarChart({ data, series, labelKey, ...props }: Omit<ChartCardProps, "children">) {
  return (
    <ChartCard data={data} series={series} labelKey={labelKey} {...props}>
      {({ data: d }) => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={d} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey={labelKey} tick={tick} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} width={48} tickFormatter={(v) => (series[0]?.format === "money" ? (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)) : String(v))} />
            <Tooltip cursor={{ fill: "#f8f8fc" }} content={<ChartTooltip series={series} />} />
            {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={36} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function HorizontalBarChart({ data, series, labelKey, ...props }: Omit<ChartCardProps, "children">) {
  const h = Math.max(props.height ?? 260, data.length * 30 + 40);
  return (
    <ChartCard data={data} series={series} labelKey={labelKey} {...props} height={h}>
      {({ data: d }) => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={d} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" tick={tick} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey={labelKey} tick={tick} tickLine={false} axisLine={false} width={140} tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)} />
            <Tooltip cursor={{ fill: "#f8f8fc" }} content={<ChartTooltip series={series} />} />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} radius={[0, 4, 4, 0]} maxBarSize={22} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function TrendChart({ data, series, labelKey, area, ...props }: Omit<ChartCardProps, "children"> & { area?: boolean }) {
  return (
    <ChartCard data={data} series={series} labelKey={labelKey} {...props}>
      {({ data: d }) => (
        <ResponsiveContainer width="100%" height="100%">
          {area ? (
            <AreaChart data={d} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <defs>
                {series.map((s, i) => (
                  <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey={labelKey} tick={tick} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={16} />
              <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} width={48} />
              <Tooltip content={<ChartTooltip series={series} />} />
              {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
              {series.map((s, i) => (
                <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} fill={`url(#grad-${s.key})`} dot={{ r: 3, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 5 }} />
              ))}
            </AreaChart>
          ) : (
            <LineChart data={d} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey={labelKey} tick={tick} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={16} />
              <YAxis tick={tick} tickLine={false} axisLine={false} width={48} domain={series[0]?.format === "percent" ? [0, 100] : undefined} />
              <Tooltip content={<ChartTooltip series={series} />} />
              {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
              {series.map((s, i) => (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function DonutChart({ data, title, description, className, valueLabel = "Count", colors, height = 220 }: { data: { name: string; value: number }[]; title: string; description?: string; className?: string; valueLabel?: string; colors?: Record<string, string>; height?: number }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  const series: SeriesDef[] = [{ key: "value", label: valueLabel }];
  return (
    <ChartCard title={title} description={description} data={data} series={series} labelKey="name" className={className} height={height}>
      {({ data: d }) => (
        <div className="flex h-full items-center gap-4">
          <div className="h-full min-w-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="#fff" strokeWidth={2}>
                  {d.map((entry, i) => (
                    <Cell key={String(entry.name)} fill={colors?.[String(entry.name)] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip series={series} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-36 shrink-0 space-y-1.5 text-xs" aria-label={`${title} legend`}>
            {d.map((entry, i) => (
              <li key={String(entry.name)} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-muted">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colors?.[String(entry.name)] ?? CHART_COLORS[i % CHART_COLORS.length] }} aria-hidden />
                  <span className="truncate">{String(entry.name)}</span>
                </span>
                <span className="font-semibold text-ink tabular-nums">
                  {formatNumber(entry.value)}
                  {total > 0 && <span className="ml-1 font-normal text-muted">({Math.round((Number(entry.value) / total) * 100)}%)</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
