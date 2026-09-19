"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/feedback";

/**
 * Lazy, client-only versions of the Recharts dashboard charts. Recharts is loaded in its own chunk
 * on first render (never on the server), so the admin dashboard HTML ships without the charting bundle.
 * Drop-in: same props as the components in ./charts. Only types are re-exported from ./charts so this
 * module never pulls the chart code in statically.
 */
const loading = () => <Skeleton className="h-64 w-full rounded-2xl" />;

export const TrendChart = dynamic(() => import("./charts").then((m) => m.TrendChart), { ssr: false, loading });
export const DonutChart = dynamic(() => import("./charts").then((m) => m.DonutChart), { ssr: false, loading });
export const HorizontalBarChart = dynamic(() => import("./charts").then((m) => m.HorizontalBarChart), { ssr: false, loading });
export const VerticalBarChart = dynamic(() => import("./charts").then((m) => m.VerticalBarChart), { ssr: false, loading });

export type { SeriesDef } from "./charts";
