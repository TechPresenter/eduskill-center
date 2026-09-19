"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationCascade, type LocationValue } from "@/components/shared/location-cascade";
import { CourseSelect } from "@/components/site/course-select";
import { buildQuery, cn } from "@/lib/utils";

export interface CenterSearchValues {
  stateId?: string;
  districtId?: string;
  blockId?: string;
  courseId?: string;
  q?: string;
  view?: string;
}

/**
 * Search form for training centers. Submits as a normal GET to /training-centers so it works
 * without JavaScript; with JS it pushes a clean URL (empty params dropped).
 */
export function CenterSearchForm({ initial = {}, compact, className, submitLabel = "Search Centers" }: { initial?: CenterSearchValues; compact?: boolean; className?: string; submitLabel?: string }) {
  const router = useRouter();
  const [loc, setLoc] = React.useState<LocationValue>({ stateId: initial.stateId, districtId: initial.districtId, blockId: initial.blockId });
  const [courseId, setCourseId] = React.useState(initial.courseId ?? "");
  const [q, setQ] = React.useState(initial.q ?? "");
  // `busy` stays true until the navigation (and the server re-render of the results) completes.
  const [busy, startTransition] = React.useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      router.push(`/training-centers${buildQuery({ stateId: loc.stateId, districtId: loc.districtId, blockId: loc.blockId, courseId, q: q.trim(), view: initial.view })}`);
    });
  };

  return (
    <form action="/training-centers" method="get" onSubmit={submit} role="search" aria-label="Search training centers" className={cn("grid gap-3", compact ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-6", className)}>
      {initial.view && <input type="hidden" name="view" value={initial.view} />}
      <LocationCascade value={loc} onChange={setLoc} withCenters bare className="contents" />
      <CourseSelect value={courseId} onChange={setCourseId} placeholder="Any course" />
      {!compact && <Input name="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Center name, code or PIN code" aria-label="Center name, code or PIN code" leftIcon={<Search className="h-4 w-4" />} />}
      <Button type="submit" size="md" loading={busy} leftIcon={<Search className="h-4 w-4" />} className={cn(compact ? "lg:col-span-1" : "sm:col-span-2 lg:col-span-1")}>
        {submitLabel}
      </Button>
    </form>
  );
}
