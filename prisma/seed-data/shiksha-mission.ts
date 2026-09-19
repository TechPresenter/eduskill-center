/**
 * Project EduSkill Shiksha Mission — Normal Education Centre (Class 1 to 4).
 *
 * Every EduSkill centre runs this programme: regular study, practice and extra academic
 * support for children of Class 1–4 in panchayat and rural areas. Computer courses are
 * NOT part of this programme.
 *
 * This is real programme data (not demo data): it is seeded whether or not demo data is on,
 * and the Foundation can edit every field from Admin → Courses / CMS afterwards.
 */

export const SHIKSHA_CATEGORY = {
  name: "Normal Education (Class 1–4)",
  icon: "BookOpen",
  sortOrder: 0,
  description: "Foundational schooling for children of Class 1 to 4 at EduSkill Normal Education Centres.",
} as const;

/** Subjects taught in every class of the programme. */
export const SHIKSHA_SUBJECTS = ["हिंदी (Hindi)", "English", "Mathematics", "EVS / प्रारंभिक पर्यावरण अध्ययन"] as const;

/** Support given alongside the subjects, according to each child's need. */
export const SHIKSHA_SUPPORT = ["Reading practice", "Writing practice", "Revision", "Homework support"] as const;

/** Activities run at every Normal Education Centre. */
export const SHIKSHA_ACTIVITIES = [
  "Daily Classes",
  "Reading Practice",
  "Writing Practice",
  "Mathematics Practice",
  "Homework Support",
  "Revision Classes",
  "Weekly Test",
  "Monthly Assessment",
  "Student Progress Record",
  "Parent–Teacher Interaction",
] as const;

/** Objectives of a Normal Education Centre. */
export const SHIKSHA_OBJECTIVES = [
  "Strengthen children's foundational education.",
  "Develop reading and writing skills.",
  "Build a strong basic understanding of mathematics.",
  "Help children develop the habit of regular study.",
  "Give extra academic support to children who need it.",
  "Provide a quality learning environment in rural areas.",
] as const;

export interface ShikshaClass {
  code: string;
  name: string;
  /** Typical age band for the class; used for eligibility guidance, not a hard rule. */
  minAge: number;
  maxAge: number;
  shortDescription: string;
}

export const SHIKSHA_CLASSES: ShikshaClass[] = [
  {
    code: "CLASS-1",
    name: "Class 1",
    minAge: 5,
    maxAge: 8,
    shortDescription: "First steps in reading, writing and numbers, with daily practice and homework support.",
  },
  {
    code: "CLASS-2",
    name: "Class 2",
    minAge: 6,
    maxAge: 9,
    shortDescription: "Building sentence reading, neat writing and confident addition and subtraction.",
  },
  {
    code: "CLASS-3",
    name: "Class 3",
    minAge: 7,
    maxAge: 10,
    shortDescription: "Reading with understanding, paragraph writing and multiplication, division and measurement.",
  },
  {
    code: "CLASS-4",
    name: "Class 4",
    minAge: 8,
    maxAge: 11,
    shortDescription: "Independent reading and writing, stronger mathematics and revision for school examinations.",
  },
];

/** Long description shown on each class page. */
export function shikshaDescription(c: ShikshaClass): string {
  return [
    `${c.name} at an EduSkill Normal Education Centre gives children regular classes, guided practice and extra academic support close to home.`,
    "",
    "**Subjects taught**",
    ...SHIKSHA_SUBJECTS.map((s) => `- ${s}`),
    "",
    "**Support given as needed**",
    ...SHIKSHA_SUPPORT.map((s) => `- ${s}`),
    "",
    "**At the centre**",
    ...SHIKSHA_ACTIVITIES.map((a) => `- ${a}`),
    "",
    "Progress is recorded for every child, with weekly tests, monthly assessments and regular parent–teacher interaction.",
  ].join("\n");
}

/** Syllabus modules stored on the course record (one per subject). */
export function shikshaSyllabus(): { module: number; title: string; topics: string[] }[] {
  return [
    { module: 1, title: "हिंदी (Hindi)", topics: ["वर्णमाला और मात्राएँ", "शब्द और वाक्य", "पठन अभ्यास", "लेखन अभ्यास"] },
    { module: 2, title: "English", topics: ["Alphabet and phonics", "Words and sentences", "Reading practice", "Writing practice"] },
    { module: 3, title: "Mathematics", topics: ["Numbers and counting", "Addition and subtraction", "Multiplication and division", "Shapes and measurement"] },
    { module: 4, title: "EVS / प्रारंभिक पर्यावरण अध्ययन", topics: ["Our family and home", "Plants and animals", "Water, food and health", "Our village and surroundings"] },
  ];
}

/** The programme entry shown under Programs on the website. */
export const SHIKSHA_PROGRAM = {
  title: "EduSkill Shiksha Mission",
  icon: "School",
  summary:
    "Normal Education Centres for Class 1 to 4 in panchayat and rural areas, giving children regular classes, practice and extra academic support close to home.",
  content: [
    "## Project EduSkill Shiksha Mission",
    "",
    "Under Project EduSkill Shiksha Mission, EduSkill India Foundation opens **Normal Education Centres** for children in panchayat and rural areas.",
    "",
    "Each centre gives children of **Class 1 to 4** regular study, practice and extra academic support. Computer courses are not part of this programme.",
    "",
    "### Objectives",
    ...SHIKSHA_OBJECTIVES.map((o) => `- ${o}`),
    "",
    "### Classes and subjects",
    "",
    "Class 1, Class 2, Class 3 and Class 4 — each with:",
    ...SHIKSHA_SUBJECTS.map((s) => `- ${s}`),
    "",
    "Reading, writing, revision and homework support are also given according to each child's need.",
    "",
    "### Activities at the centre",
    ...SHIKSHA_ACTIVITIES.map((a) => `- ${a}`),
    "",
    "### Opening a centre",
    "",
    "Anyone who can provide a suitable space in their village or panchayat may apply to open a centre. The Foundation follows a seven-step process: application, documents verification, centre verification, selection, authorisation/agreement, orientation and centre start.",
  ].join("\n"),
} as const;
