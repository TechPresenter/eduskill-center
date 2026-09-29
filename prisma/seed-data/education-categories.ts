/**
 * The EduSkill catalogue above Normal Education (Class 1–4): School Education (Class 5–10),
 * Senior Secondary (Class 11–12) and Competitive Exam Training.
 *
 * Class 1–4 lives in ./shiksha-mission.ts and is not touched here. These three categories
 * extend the same pattern upwards — one course per school class — so that the header's
 * "Popular courses" menu and /courses?category=<slug> have real rows to show: the menu lists
 * active categories that have at least one ACTIVE course (src/server/nav-menu.ts), so a
 * category without courses would never appear.
 *
 * This is real programme data (not demo data): it is seeded whether or not demo data is on,
 * and the Foundation can edit every field from Admin → Courses afterwards.
 *
 * Nothing here is invented beyond what the Foundation has stated. The category descriptions
 * are its own wording, the classes carry no fee (like Class 1–4), and the subjects, timetable,
 * assessment schedule and the examinations covered are left to the centre to announce rather
 * than guessed at.
 */

export interface EducationCourseSeed {
  /** Natural key. `CLASS-5` … `CLASS-12` continue the Class 1–4 codes. */
  code: string;
  name: string;
  /** The school class taught, or null for a course that is not tied to one class. */
  classNumber: number | null;
  shortDescription: string;
  /** Lucide icon name from the DynamicIcon allow-list (src/components/ui/icon.tsx). */
  icon: string;
  durationText: string;
  durationWeeks: number;
  /** 0 when the number of classes is not fixed; the course page hides the row then. */
  totalClasses: number;
  /** Continues the Class 1–4 order (they are 1–4). */
  sortOrder: number;
}

export interface EducationCategorySeed {
  name: string;
  /** Lucide icon name from the DynamicIcon allow-list; the menu and the catalogue render it. */
  icon: string;
  /**
   * Normal Education (Class 1–4) is 0, so 1–3 put these 2nd, 3rd and 4th in the menu.
   *
   * These three values COLLIDE with the older skill categories seeded in prisma/seed-data:
   * Digital Literacy is also 1, Computer Education also 2, Vocational Trades also 3. The menu
   * query (src/server/nav-menu.ts) breaks ties with `name asc` and takes only the first four,
   * and "Computer Education" / "Digital Literacy" sort before "School Education" / "Senior
   * Secondary". The order is correct today only because every legacy course is INACTIVE, so
   * those categories do not qualify; re-activating any one of them from Admin → Courses (which
   * scripts/apply-shiksha-mission.ts explicitly invites) pushes Senior Secondary and
   * Competitive Exam Training out of the menu. Fixing it properly means renumbering the legacy
   * categories out of the 0–3 band, which is a Foundation decision, not this script's.
   */
  sortOrder: number;
  /** The Foundation's own one-line description; shown as the muted line in the mega menu. */
  description: string;
  courses: EducationCourseSeed[];
}

/** An academic-year class, following the four Class 1–4 course records in ./shiksha-mission.ts. */
function schoolClass(classNumber: number, shortDescription: string): EducationCourseSeed {
  return {
    code: `CLASS-${classNumber}`,
    name: `Class ${classNumber}`,
    classNumber,
    shortDescription,
    icon: "BookOpen",
    durationText: "Full academic year",
    durationWeeks: 40,
    totalClasses: 200,
    sortOrder: classNumber,
  };
}

export const EDUCATION_CATEGORIES: EducationCategorySeed[] = [
  {
    name: "School Education (Class 5–10)",
    icon: "School",
    sortOrder: 1,
    description: "Complete academic support and skill development for students from Class 5 to 10.",
    courses: [
      schoolClass(5, "Academic support and skill development for students of Class 5."),
      schoolClass(6, "Academic support and skill development for students of Class 6."),
      schoolClass(7, "Academic support and skill development for students of Class 7."),
      schoolClass(8, "Academic support and skill development for students of Class 8."),
      schoolClass(9, "Academic support and skill development for students of Class 9."),
      schoolClass(10, "Academic support and skill development for students of Class 10."),
    ],
  },
  {
    name: "Senior Secondary (Class 11–12)",
    icon: "GraduationCap",
    sortOrder: 2,
    description: "Subject-focused learning and preparation for Class 11 and 12 students.",
    courses: [
      schoolClass(11, "Subject-focused learning and examination preparation for students of Class 11."),
      schoolClass(12, "Subject-focused learning and examination preparation for students of Class 12."),
    ],
  },
  {
    name: "Competitive Exam Training",
    icon: "Target",
    sortOrder: 3,
    description: "Focused preparation for competitive and entrance examinations.",
    courses: [
      {
        code: "EXAM-PREP",
        name: "Competitive Exam Training",
        classNumber: null,
        shortDescription: "Focused preparation for competitive and entrance examinations at an EduSkill centre.",
        icon: "Target",
        // Not an academic-year course and no fixed class count: each centre announces the
        // schedule for its own intake, so nothing is stated here that would be a guess.
        durationText: "As announced by the centre",
        durationWeeks: 0,
        totalClasses: 0,
        sortOrder: 13,
      },
    ],
  },
];

/**
 * Typical age band for a school class — the same band the Class 1–4 courses use
 * (Class 1 is 5–8), i.e. the class number plus 4 to plus 7. Eligibility guidance, not a rule.
 */
export function classAgeBand(classNumber: number): { minAge: number; maxAge: number } {
  return { minAge: classNumber + 4, maxAge: classNumber + 7 };
}

/** Eligibility line on the course page and in the apply wizard. */
export function educationEligibility(course: EducationCourseSeed): string {
  if (course.classNumber === null) {
    return "Open to anyone preparing for a competitive or entrance examination. The centre offering the course confirms eligibility.";
  }
  const { minAge, maxAge } = classAgeBand(course.classNumber);
  return `Students of ${course.name} age (about ${minAge}–${maxAge} years). Open to all students in the centre's village or panchayat.`;
}

/** Certificate rule; the class courses carry the same rule as Class 1–4. */
export function educationCertificateEligibility(course: EducationCourseSeed): string {
  return course.classNumber === null
    ? "Minimum 75% attendance."
    : "Minimum 75% attendance and completion of the monthly assessments.";
}

/** Long description shown on each course page. */
export function educationCourseDescription(category: EducationCategorySeed, course: EducationCourseSeed): string {
  return [
    course.shortDescription,
    "",
    `This course is offered under **${category.name}** — ${category.description}`,
    "",
    "Classes are held at the EduSkill training centre offering the course, and there is no course fee.",
    "",
    "The subjects, timetable and assessment schedule are set by the Foundation and announced by the centre.",
  ].join("\n");
}
