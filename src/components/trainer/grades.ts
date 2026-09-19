import type { BadgeTone } from "@/components/ui/badge";

/**
 * Grade scale shared by the server (stored grades) and the trainer portal (live preview while entering marks).
 * Percentage of max marks; anything below the passing marks is always "Fail".
 */
export function gradeFor(marks: number, maxMarks: number, passingMarks: number): string {
  if (marks < passingMarks) return "Fail";
  const pct = maxMarks > 0 ? (marks / maxMarks) * 100 : 0;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  return "Pass";
}

export function gradeTone(grade: string | null | undefined): BadgeTone {
  if (!grade) return "neutral";
  if (grade === "Fail") return "danger";
  if (grade === "Pass" || grade === "C") return "warning";
  return "success";
}

export const ASSESSMENT_TYPES = [
  { value: "QUIZ", label: "Quiz" },
  { value: "PRACTICAL", label: "Practical" },
  { value: "MID_TERM", label: "Mid-term" },
  { value: "FINAL", label: "Final" },
  { value: "OTHER", label: "Other" },
] as const;
