"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api-client";

export interface CourseOption {
  id: string;
  name: string;
  slug?: string;
}

let coursesPromise: Promise<CourseOption[]> | null = null;

/** Loads active courses once per page and shares the result between selects. */
export function useCourseOptions(initial?: CourseOption[]) {
  const [courses, setCourses] = React.useState<CourseOption[]>(initial ?? []);
  React.useEffect(() => {
    if (initial && initial.length) return;
    if (!coursesPromise) {
      coursesPromise = api
        .get<{ courses: CourseOption[] }>("/api/public/courses")
        .then((d) => d.courses.map((c) => ({ id: c.id, name: c.name, slug: c.slug })))
        .catch(() => {
          coursesPromise = null;
          return [];
        });
    }
    let alive = true;
    void coursesPromise.then((list) => alive && setCourses(list));
    return () => {
      alive = false;
    };
  }, [initial]);
  return courses;
}

export function CourseSelect({
  value,
  onChange,
  courses: initial,
  placeholder = "Any course",
  name = "courseId",
  className,
  ariaLabel = "Course",
}: {
  value: string;
  onChange: (id: string) => void;
  courses?: CourseOption[];
  placeholder?: string;
  name?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const courses = useCourseOptions(initial);
  return (
    <Select
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={courses.map((c) => ({ value: c.id, label: c.name }))}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
