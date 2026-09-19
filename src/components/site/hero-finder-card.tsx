"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocationCascade, type LocationValue } from "@/components/shared/location-cascade";
import { CourseSelect } from "@/components/site/course-select";
import { buildQuery } from "@/lib/utils";

/** Floating "Find a Training Center" card shown in the homepage hero. */
export function HeroFinderCard({ title }: { title: string }) {
  const router = useRouter();
  const [loc, setLoc] = React.useState<LocationValue>({});
  const [courseId, setCourseId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    router.push(`/training-centers${buildQuery({ stateId: loc.stateId, districtId: loc.districtId, blockId: loc.blockId, courseId })}`);
  };

  return (
    <form onSubmit={submit} className="card w-full max-w-sm rounded-card-lg p-5 shadow-float sm:p-6" aria-labelledby="hero-finder-title">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-light text-orange">
          <MapPin className="h-5 w-5" aria-hidden />
        </span>
        <h2 id="hero-finder-title" className="text-lg font-extrabold text-navy">
          {title}
        </h2>
      </div>
      <div className="space-y-3">
        <LocationCascade value={loc} onChange={setLoc} withCenters bare className="space-y-3" placeholderPrefix="Select" />
        <CourseSelect value={courseId} onChange={setCourseId} placeholder="Any course" />
        <Button type="submit" fullWidth size="lg" loading={busy} leftIcon={<Search className="h-4 w-4" />}>
          Find Training Center
        </Button>
      </div>
    </form>
  );
}
