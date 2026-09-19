/**
 * Builds the "Apply Now" destination for the public website.
 * Anonymous visitors register first and are bounced to the application with the same
 * center/course preselected; logged-in users go straight to the student application.
 */
export interface ApplyLinkOptions {
  centerId?: string | null;
  courseId?: string | null;
}

export function studentApplyPath(opts: ApplyLinkOptions = {}) {
  const sp = new URLSearchParams();
  if (opts.centerId) sp.set("centerId", opts.centerId);
  if (opts.courseId) sp.set("courseId", opts.courseId);
  const qs = sp.toString();
  return `/student/apply${qs ? `?${qs}` : ""}`;
}

export function applyHref(user: { role: string } | null | undefined, opts: ApplyLinkOptions = {}) {
  const target = studentApplyPath(opts);
  if (!user) return `/register?next=${encodeURIComponent(target)}`;
  // Students go straight in; trainers/staff hit the portal which redirects them appropriately.
  return target;
}
