"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/feedback";

/**
 * Client-only, code-split CenterMap. Leaflet, the marker-cluster plugin and their CSS live in the
 * lazily loaded chunk (they are imported by ./center-map), so public pages that embed a map no longer
 * pay for them at first paint. Same props as CenterMap; a map-sized skeleton shows while it loads.
 */
export const CenterMapLazy = dynamic(() => import("./center-map").then((m) => m.CenterMap), {
  ssr: false,
  loading: () => <Skeleton className="min-h-[60svh] w-full rounded-2xl" />,
});

/** Alias so call sites can swap only the import path. */
export { CenterMapLazy as CenterMap };

export type { MapCenter, MapFilter } from "./center-map";
