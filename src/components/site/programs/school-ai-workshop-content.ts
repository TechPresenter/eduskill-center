import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  Award,
  BadgeCheck,
  Bot,
  Brain,
  BrainCircuit,
  Briefcase,
  Compass,
  Gamepad2,
  GraduationCap,
  ImagePlus,
  Laptop,
  Lightbulb,
  ListChecks,
  Mic,
  Palette,
  PenTool,
  Presentation,
  Projector,
  Puzzle,
  Rocket,
  School,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  WandSparkles,
  Wifi,
} from "lucide-react";

/**
 * School AI Training & Awareness Workshop — the Foundation's own wording (October 2026), shown on
 * /programs/ai-workshop-training by `SchoolAiWorkshop`. Edit the text here; the layout lives in
 * school-ai-workshop.tsx.
 */

export const WORKSHOP_SLUG = "ai-workshop-training";

export const HERO = {
  eyebrow: "Eduskill India Foundation",
  title: "School AI Training & [[Awareness Workshop]]",
  quote: "Empowering Students with AI Skills for a Smart Future",
  /** Cycled in the hero, one after the other. */
  rotating: ["Learn AI", "Create with AI", "Prepare for the Future"],
  chips: ["Class VI to XII", "Government & Private Schools", "Certificate for All Participants"],
};

/** The two taglines, run as a moving strip under the hero. */
export const TICKER = ["AI Ideas", "Learning", "Creativity", "Future", "AI Today", "Better Learning", "Tomorrow"];

export const ABOUT = {
  paragraphs: [
    "Eduskill India Foundation organizes School AI Training & Awareness Workshops for students to introduce them to Artificial Intelligence, Generative AI and modern digital technologies.",
    "The workshop combines awareness, practical learning, creativity and career guidance to help students understand how AI works, how it can be used for education and projects, its benefits and limitations, and how to use AI safely and responsibly.",
  ],
  highlights: [
    { icon: Users, label: "Interactive Learning" },
    { icon: Puzzle, label: "Practical Activities" },
    { icon: GraduationCap, label: "Expert Trainers" },
    { icon: Award, label: "Certificate for All Participants" },
    { icon: Laptop, label: "Hands-on AI Tools" },
    { icon: Palette, label: "Creativity & Innovation Activities" },
  ] satisfies { icon: LucideIcon; label: string }[],
};

export const OBJECTIVES = [
  "Introduce students to Artificial Intelligence",
  "Build digital skills and creativity",
  "Demonstrate practical AI applications in education",
  "Teach safe and responsible use of AI",
  "Develop problem-solving and innovation skills",
  "Improve digital literacy",
  "Create awareness about AI-related careers",
  "Encourage students to explore future technologies",
];

export const TARGET_GROUP = {
  classes: "Class VI to XII",
  schools: "Government & Private Schools",
  levels: [
    { level: "Junior", classes: "Class VI–VIII", tone: "orange" },
    { level: "Middle", classes: "Class IX–X", tone: "navy" },
    { level: "Senior", classes: "Class XI–XII", tone: "green" },
  ] as const,
};

export const MODULES: { title: string; icon: LucideIcon; topics: string[] }[] = [
  { title: "Introduction to AI", icon: Brain, topics: ["What is AI?", "History & examples", "AI in daily life", "How AI works"] },
  {
    title: "Generative AI",
    icon: Sparkles,
    topics: ["Text generation", "Image generation", "Audio & video generation", "Educational applications", "Introduction to popular AI tools"],
  },
  { title: "AI for Education", icon: GraduationCap, topics: ["Notes & study material", "Revision", "Quiz creation", "Project assistance", "Presentations", "Language learning"] },
  { title: "Prompt Engineering Basics", icon: PenTool, topics: ["What is a prompt?", "How to write better prompts", "Prompt techniques", "Examples for study & projects"] },
  { title: "AI Creative Workshop", icon: WandSparkles, topics: ["Content creation", "Story writing", "Image generation", "Creative projects", "Project idea generation"] },
  {
    title: "Digital Safety & Responsible AI",
    icon: ShieldCheck,
    topics: ["Personal data safety", "Privacy awareness", "Fake information & misinformation", "Copyright", "Academic integrity", "Responsible AI usage"],
  },
  { title: "AI Career Awareness", icon: Briefcase, topics: ["Future job opportunities", "AI-related career paths", "Skills required for the future", "Guidance on AI careers"] },
];

export const ACTIVITIES: { icon: LucideIcon; label: string }[] = [
  { icon: Bot, label: "AI tool demonstration" },
  { icon: PenTool, label: "Hands-on prompt writing" },
  { icon: ListChecks, label: "Create quizzes using AI" },
  { icon: Lightbulb, label: "Generate project ideas" },
  { icon: ImagePlus, label: "Create AI images and creative content" },
  { icon: Sparkles, label: "Story and content creation" },
  { icon: Users, label: "Group innovation activities" },
  { icon: SearchCheck, label: "Verify AI-generated information" },
  { icon: Compass, label: "Explore AI applications for learning" },
];

/** `kind: "break"` rows are shaded differently in the table. */
export const SCHEDULE: { time: string; activity: string; kind?: "break" | "closing" }[] = [
  { time: "09:30–10:00", activity: "Registration & Introduction" },
  { time: "10:00–10:30", activity: "Introduction to AI" },
  { time: "10:30–11:15", activity: "Generative AI" },
  { time: "11:15–11:30", activity: "Break", kind: "break" },
  { time: "11:30–12:15", activity: "AI Tools & Education" },
  { time: "12:15–01:00", activity: "Prompt Writing" },
  { time: "01:00–01:45", activity: "Practical Activities" },
  { time: "01:45–02:15", activity: "Digital Safety & Responsible AI" },
  { time: "02:15–02:45", activity: "AI Career Awareness" },
  { time: "02:45–03:00", activity: "Quiz, Feedback & Closing", kind: "closing" },
];

export const DURATIONS = [
  { duration: "2 Hours", program: "AI Awareness Session" },
  { duration: "3–4 Hours", program: "Practical AI Workshop" },
  { duration: "1 Day", program: "Full-Day AI Program" },
  { duration: "3–5 Days", program: "AI Skill Development Program" },
];
export const DURATION_NOTE = "Duration can be customized according to school requirements.";

export const BENEFITS = [
  "Basic understanding of Artificial Intelligence",
  "Practical AI learning experience",
  "Improved creativity and problem-solving",
  "Better digital literacy",
  "AI safety and privacy awareness",
  "Experience with modern AI tools",
  "Career guidance in AI and technology",
  "Confidence to explore innovation",
  "Participation certificate",
];

export const TEACHER_ORIENTATION = {
  intro: "A dedicated teacher session can cover:",
  topics: [
    "AI for classroom use",
    "Lesson planning with AI",
    "Worksheet & quiz generation",
    "Student engagement using AI",
    "Academic integrity",
    "Responsible AI usage",
    "AI-assisted teaching methods",
  ],
};

export const OUTCOMES = {
  intro: "By the end of the workshop, students will be able to:",
  items: [
    "Understand fundamental AI concepts",
    "Identify common applications of AI",
    "Use selected AI tools for learning",
    "Write effective basic prompts",
    "Explore AI for creative projects",
    "Verify AI-generated information",
    "Understand privacy, copyright and responsible AI",
    "Recognize future AI career opportunities",
    "Develop confidence and innovation skills",
  ],
};

export const INFRASTRUCTURE: { icon: LucideIcon; label: string }[] = [
  { icon: School, label: "Classroom / Seminar Hall" },
  { icon: Projector, label: "Projector / Smart Board" },
  { icon: Laptop, label: "Computers / Laptops (if available)" },
  { icon: Wifi, label: "Internet / Wi-Fi" },
  { icon: Mic, label: "Microphone & Speaker" },
  { icon: Armchair, label: "Suitable Seating Arrangement" },
];

export const CERTIFICATE = {
  title: "Certificate of Participation",
  text: "Participants who successfully complete the workshop can receive an official Certificate of Participation from Eduskill India Foundation.",
};

export const SUPPORT = {
  title: "For Government & [[Private Schools]]",
  cards: [
    { icon: Target, title: "Customizable Program", text: "Designed according to school requirements, student level and available infrastructure." },
    { icon: Presentation, title: "Expert Trainers & Learning Support", text: "Interactive sessions combining demonstrations, practical activities and guided learning." },
  ] satisfies { icon: LucideIcon; title: string; text: string }[],
};

export const BOOKING = {
  title: "Organize This Workshop at [[Your School]]",
  subtitle: "Give Your Students the Skills to Learn, Create & Innovate with AI",
  tagline: ["Learn AI", "Create with AI", "Stay Safe", "Prepare for the Future"],
  organizer: "Eduskill India Foundation",
  pillars: ["Education", "Skill Development", "Digital Literacy", "Innovation"],
  /** Pre-filled in the enquiry form so the Foundation's team knows what the school is asking for. */
  enquirySubject: "School AI Training & Awareness Workshop",
};

/** Small icons for the quick facts strip in the booking section. */
export const BOOKING_FACTS: { icon: LucideIcon; label: string }[] = [
  { icon: BrainCircuit, label: "7 modules" },
  { icon: Gamepad2, label: "9 hands-on activities" },
  { icon: Rocket, label: "2 hours to 5 days" },
  { icon: BadgeCheck, label: "Certificate for every participant" },
];
