"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, MapPin, RotateCcw } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { LocationCascade, type LocationValue } from "@/components/shared/location-cascade";
import { CourseSelect } from "@/components/site/course-select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/feedback";
import { api } from "@/lib/api-client";
import { buildQuery, cn } from "@/lib/utils";

export interface MapCenter {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  verified: boolean;
  location: string;
  courses: string[];
  url: string;
}

export interface MapFilter {
  stateId?: string;
  districtId?: string;
  blockId?: string;
  courseId?: string;
}

const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.5, 68],
  [35.7, 97.5],
];

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function popupHtml(c: MapCenter) {
  const courses = c.courses.slice(0, 3).map((n) => `<span class="esk-chip">${escapeHtml(n)}</span>`).join("");
  return `
    <div class="esk-popup">
      <p class="esk-popup-title">${escapeHtml(c.name)}${c.verified ? ' <span class="esk-verified" title="Verified">✓</span>' : ""}</p>
      <p class="esk-popup-code">${escapeHtml(c.code)}</p>
      <p class="esk-popup-loc">${escapeHtml(c.location)}</p>
      ${courses ? `<div class="esk-popup-courses">${courses}</div>` : ""}
      <a class="esk-popup-link" href="${escapeHtml(c.url)}">View Center →</a>
    </div>`;
}

/**
 * Interactive India map of training centers (Leaflet + marker clustering, OpenStreetMap tiles).
 * Leaflet is loaded only in the browser. A keyboard-accessible list of the plotted centers is
 * rendered below the map for screen readers and non-mouse users.
 */
export function CenterMap({
  initialCenters,
  filters = false,
  initialFilter,
  height = 480,
  className,
  zoom,
  listTitle = "Centers on this map",
}: {
  initialCenters?: MapCenter[];
  /** Show the filter bar and refetch from /api/public/centers/map. */
  filters?: boolean;
  initialFilter?: MapFilter;
  height?: number;
  className?: string;
  /** Fixed zoom for a single-marker map. */
  zoom?: number;
  listTitle?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const layerRef = React.useRef<LayerGroup | null>(null);
  const [centers, setCenters] = React.useState<MapCenter[]>(initialCenters ?? []);
  const [loading, setLoading] = React.useState(!initialCenters);
  const [error, setError] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const [loc, setLoc] = React.useState<LocationValue>({ stateId: initialFilter?.stateId, districtId: initialFilter?.districtId, blockId: initialFilter?.blockId });
  const [courseId, setCourseId] = React.useState(initialFilter?.courseId ?? "");
  const [filter, setFilter] = React.useState<MapFilter>(initialFilter ?? {});

  // Fetch markers whenever the applied filter changes (only when filters are enabled or no initial data).
  React.useEffect(() => {
    if (initialCenters && !filters) return;
    let alive = true;
    api
      .get<{ centers: MapCenter[] }>(`/api/public/centers/map${buildQuery({ stateId: filter.stateId, districtId: filter.districtId, blockId: filter.blockId, courseId: filter.courseId })}`)
      .then((d) => alive && setCenters(d.centers))
      .catch(() => alive && setError("Could not load centers. Please try again."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [filter, filters, initialCenters]);

  // Initialise Leaflet once in the browser.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);
      map.fitBounds(INDIA_BOUNDS, { padding: [10, 10] });
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  // Render markers whenever data or map readiness changes.
  React.useEffect(() => {
    if (!ready || !mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");
      const map = mapRef.current;
      if (cancelled || !map) return;
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      const icon = L.divIcon({
        className: "esk-pin-wrap",
        html: '<span class="esk-pin" aria-hidden="true"></span>',
        // 44px tap box around the 28x36 pin (the pin sits bottom-centre, its point on the anchor).
        iconSize: [44, 44],
        iconAnchor: [22, 42],
        popupAnchor: [0, -38],
      });
      const cluster = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 48,
        iconCreateFunction: (c) => L.divIcon({ html: `<span class="esk-cluster">${c.getChildCount()}</span>`, className: "esk-cluster-wrap", iconSize: [44, 44] }),
      });
      for (const c of centers) {
        const m = L.marker([c.lat, c.lng], { icon, title: c.name, alt: c.name });
        m.bindPopup(popupHtml(c), { maxWidth: 260 });
        cluster.addLayer(m);
      }
      map.addLayer(cluster);
      layerRef.current = cluster;
      if (centers.length === 1 && zoom) {
        map.setView([centers[0]!.lat, centers[0]!.lng], zoom);
      } else if (centers.length > 0) {
        const b = cluster.getBounds();
        if (b.isValid()) map.fitBounds(b, { padding: [40, 40], maxZoom: 12 });
      } else {
        map.fitBounds(INDIA_BOUNDS, { padding: [10, 10] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [centers, ready, zoom]);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFilter({ stateId: loc.stateId, districtId: loc.districtId, blockId: loc.blockId, courseId: courseId || undefined });
  };
  const reset = () => {
    setLoc({});
    setCourseId("");
    setLoading(true);
    setError(null);
    setFilter({});
  };

  return (
    <div className={cn("space-y-4", className)}>
      {filters && (
        <form onSubmit={apply} className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6" aria-label="Filter map">
          <LocationCascade value={loc} onChange={setLoc} withCenters bare className="contents" />
          <CourseSelect value={courseId} onChange={setCourseId} placeholder="Any course" />
          <div className="flex gap-2 sm:col-span-2 lg:col-span-2">
            <Button type="submit" className="flex-1" leftIcon={<MapPin className="h-4 w-4" />}>
              Show on Map
            </Button>
            <Button type="button" variant="outline" onClick={reset} aria-label="Reset filters" leftIcon={<RotateCcw className="h-4 w-4" />}>
              Reset
            </Button>
          </div>
        </form>
      )}

      <div className="card relative overflow-hidden rounded-card-lg" style={{ height }}>
        <div ref={containerRef} className="h-full w-full" role="application" aria-label="Map of training centers" />
        {(loading || !ready) && (
          <div className="absolute inset-0 z-[400] flex items-center justify-center bg-white/70">
            <Spinner />
          </div>
        )}
        {error && (
          <div className="absolute inset-x-4 bottom-4 z-[400] rounded-xl bg-white p-3 text-center text-sm text-danger shadow-card" role="alert">
            {error}
          </div>
        )}
        {!loading && ready && centers.length === 0 && !error && (
          <div className="absolute inset-x-4 bottom-4 z-[400] rounded-xl bg-white p-3 text-center text-sm text-muted shadow-card">No centers match these filters yet.</div>
        )}
      </div>

      <details className="rounded-xl border border-line bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-navy">
          {listTitle} ({centers.length})
        </summary>
        <ul className="divide-y divide-line px-4 pb-2" aria-label={listTitle}>
          {centers.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>
                <Link href={c.url} className="font-semibold text-navy hover:text-orange">
                  {c.name}
                </Link>
                {c.verified && <BadgeCheck className="ml-1.5 inline h-4 w-4 text-success" aria-label="Verified" />}
                <span className="block text-xs text-muted">
                  {c.code} · {c.location}
                </span>
              </span>
              <Link href={c.url} className="inline-flex min-h-11 items-center text-xs font-semibold text-orange">
                View Center →
              </Link>
            </li>
          ))}
          {centers.length === 0 && <li className="py-3 text-sm text-muted">No centers to list.</li>}
        </ul>
      </details>

      <style>{`
        .esk-pin-wrap { background: transparent; border: 0; display:flex; align-items:flex-end; justify-content:center; padding-bottom:8px; }
        .esk-pin { display:block; position:relative; width:28px; height:28px; background:#e8520a; border:3px solid #fff; border-radius:50% 50% 50% 0; transform:rotate(-45deg); box-shadow:0 4px 10px rgba(16,24,40,.35); }
        .esk-pin::after { content:""; position:absolute; left:8px; top:8px; width:6px; height:6px; background:#fff; border-radius:50%; }
        .esk-cluster-wrap { background: transparent; border: 0; }
        .esk-cluster { display:flex; align-items:center; justify-content:center; width:44px; height:44px; border-radius:9999px; background:#12357a; color:#fff; font-weight:800; font-size:13px; border:3px solid #fff; box-shadow:0 4px 12px rgba(16,24,40,.3); }
        .leaflet-popup-content-wrapper { border-radius:14px; box-shadow:0 12px 30px -10px rgba(16,24,40,.4); }
        .leaflet-popup-content { margin:12px 14px; font-family:inherit; }
        .esk-popup-title { font-weight:800; color:#12357a; font-size:14px; margin:0 0 2px; }
        .esk-verified { color:#12b76a; font-weight:800; }
        .esk-popup-code { font-size:12px; color:#667085; margin:0; font-weight:600; letter-spacing:.02em; }
        .esk-popup-loc { font-size:12px; color:#667085; margin:4px 0 0; }
        .esk-popup-courses { display:flex; flex-wrap:wrap; gap:4px; margin-top:8px; }
        .esk-chip { background:#e8eaf6; color:#12357a; border-radius:9999px; padding:2px 8px; font-size:12px; font-weight:600; }
        .esk-popup-link { display:inline-flex; align-items:center; min-height:44px; margin-top:2px; color:#e8520a; font-weight:700; font-size:13px; text-decoration:none; }
        .esk-popup-link:hover { text-decoration:underline; }
        .leaflet-touch .leaflet-bar a { width:44px; height:44px; line-height:44px; }
      `}</style>
    </div>
  );
}
