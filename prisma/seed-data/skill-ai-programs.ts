/**
 * Programmes the Foundation runs alongside Project EduSkill Shiksha Mission (October 2026):
 * Computer & Skill Development Training, AI Workshop & Training, and Digital Marketing Training.
 * The wording is the Foundation's own. They are listed on /programs, on the homepage programmes
 * band and each has its own page at /programs/<slug>.
 *
 * Applied by scripts/apply-skill-ai-programs.ts (npm run content:programs, and prisma/seed.ts).
 * After that, Admin → CMS → Programs is the place to edit them.
 */

const WHO_CAN_JOIN = ["Students", "Teachers", "Job Seekers", "Professionals", "Entrepreneurs", "Beginners"];
const CLOSING_LINE = "**Learn Today. Upgrade Your Skills. Become Future Ready.**";

const COMPUTER_SKILL_TOPICS = [
  "Basic & Advanced Computer Skills",
  "MS Office & Digital Productivity",
  "Digital Literacy & Internet Skills",
  "Communication & Soft Skills",
  "Job-Oriented Skill Development",
  "Career & Professional Development",
  "Digital Marketing & Technology Skills",
  "AI & Emerging Technology Training",
];

const AI_WORKSHOP_TOPICS = [
  "Introduction to Artificial Intelligence",
  "Generative AI & AI Tools",
  "ChatGPT & AI Productivity",
  "AI for Education & Learning",
  "AI for Business & Marketing",
  "Prompt Engineering",
  "AI Automation",
  "Practical AI Projects",
  "Career Opportunities in AI",
];

export interface ProgramSeed {
  title: string;
  /** A name from DynamicIcon's allow-list (src/components/ui/icon.tsx). */
  icon: string;
  summary: string;
  content: string;
}

const DIGITAL_MARKETING_MODULES = [
  "Digital Marketing Introduction",
  "Social Media Marketing",
  "Content Marketing",
  "Canva & Creative Design",
  "SEO",
  "Google & Online Promotion",
  "Video & YouTube Marketing",
  "WhatsApp Business",
  "AI for Digital Marketing",
  "Email Marketing",
  "Personal Branding",
  "Freelancing & Career Awareness",
];

/** In display order; they sit directly after Shiksha Mission (sortOrder 0). */
export const SKILL_AI_PROGRAMS: ProgramSeed[] = [
  {
    title: "Computer & Skill Development Training",
    icon: "Code2",
    // The summary is the page's hero line and the card text; the content opens with the tagline.
    summary: "Learn practical, industry-relevant skills and prepare yourself for better career opportunities.",
    content: [
      "## Empowering Skills. Building Future Careers.",
      "",
      "### Our training programs include",
      ...COMPUTER_SKILL_TOPICS.map((t) => `- ${t}`),
      "",
      "### Who can join?",
      "",
      WHO_CAN_JOIN.join(" • "),
      "",
      CLOSING_LINE,
    ].join("\n"),
  },
  {
    title: "AI Workshop & Training",
    icon: "Sparkles",
    summary: "Our AI workshops are designed for students, educators, professionals, entrepreneurs and beginners who want to understand and use AI in real-world situations.",
    content: [
      "## Learn Artificial Intelligence. Build the Future.",
      "",
      "### AI workshop topics",
      ...AI_WORKSHOP_TOPICS.map((t) => `- ${t}`),
      "",
      "### Who can join?",
      "",
      WHO_CAN_JOIN.join(" • "),
      "",
      CLOSING_LINE,
    ].join("\n"),
  },
  {
    // Its page has its own landing layout (src/components/site/programs/digital-marketing.tsx);
    // this content is the plain fallback and the source of the search/social description.
    title: "Digital Marketing Training",
    icon: "Megaphone",
    summary:
      "Practical digital marketing training for students, youth, teachers, job seekers, entrepreneurs and small businesses — social media, content, Canva, SEO, AI tools and freelancing.",
    content: [
      "## Learn Digital Marketing • Create • Promote • Grow",
      "",
      "Eduskill India Foundation का Digital Marketing Training & Awareness Program — offline और online।",
      "",
      "### Training modules",
      ...DIGITAL_MARKETING_MODULES.map((t) => `- ${t}`),
      "",
      "**Learn Digital Marketing | Create Content | Build Your Brand | Grow Digitally**",
    ].join("\n"),
  },
];
