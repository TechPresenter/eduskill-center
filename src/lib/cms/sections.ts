/**
 * Registry of editable website sections. Each section stores a JSON document in `cms_sections`.
 * The registry defines the fields (so the admin editor can render a form) and the defaults
 * (used until the admin saves a version). Text fields support `[[word]]` to highlight in orange.
 */

export type CmsFieldType = "text" | "textarea" | "image" | "url" | "number" | "boolean" | "icon";

export interface CmsField {
  key: string;
  label: string;
  type: CmsFieldType;
  help?: string;
}

export interface CmsListField {
  key: string;
  label: string;
  type: "list";
  itemFields: CmsField[];
  max?: number;
}

export type CmsAnyField = CmsField | CmsListField;

export interface CmsSectionDef {
  key: string;
  name: string;
  page: string;
  description: string;
  fields: CmsAnyField[];
  defaults: Record<string, unknown>;
}

const cta = (key: string, label: string): CmsField[] => [
  { key: `${key}Label`, label: `${label} label`, type: "text" },
  { key: `${key}Href`, label: `${label} link`, type: "url" },
];

export const CMS_SECTIONS: CmsSectionDef[] = [
  {
    key: "home.hero",
    name: "Hero",
    page: "Homepage",
    description: "Main banner with headline, supporting text, calls to action and the training center finder card.",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Headline", type: "textarea", help: "Wrap words in [[ ]] to highlight in orange. Use line breaks for new lines." },
      { key: "subtitle", label: "Supporting text", type: "textarea" },
      ...cta("primary", "Primary button"),
      ...cta("secondary", "Secondary button"),
      ...cta("tertiary", "Text link"),
      { key: "imageUrl", label: "Hero image", type: "image", help: "Portrait/landscape photo of a student. Leave empty for the built-in illustration." },
      { key: "imageAlt", label: "Image alt text", type: "text" },
      { key: "badgeLabel", label: "Floating badge label", type: "text" },
      { key: "badgeValueKey", label: "Floating badge statistic", type: "text", help: "Impact stat key: students, centers, trainers, states, completion" },
      { key: "cardTitle", label: "Finder card title", type: "text" },
    ],
    defaults: {
      eyebrow: "Skill Development • Education • Opportunity",
      title: "Empowering India's Youth\nThrough [[Skills]], [[Education]]\n& Opportunity",
      subtitle:
        "EduSkill India Foundation is working to create accessible skill development and training opportunities for students and communities across India.",
      primaryLabel: "Explore Programs",
      primaryHref: "/programs",
      secondaryLabel: "Find Training Center",
      secondaryHref: "/training-centers",
      tertiaryLabel: "Become a Volunteer Trainer",
      tertiaryHref: "/become-a-trainer",
      imageUrl: "",
      imageAlt: "Young Indian student learning at an EduSkill training center",
      badgeLabel: "Students Reached",
      badgeValueKey: "students",
      cardTitle: "Find a Training Center",
    },
  },
  {
    key: "home.trust",
    name: "Trust strip",
    page: "Homepage",
    description: "Light lavender band under the hero with heading and partner logos (logos are managed under Partners).",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "subheading", label: "Sub heading", type: "text" },
      { key: "showWhenEmpty", label: "Show band even when no partner logos exist", type: "boolean" },
    ],
    defaults: {
      heading: "Building Skills. Creating Opportunities. Transforming Lives.",
      subheading: "Working with communities, institutions and supporters across India.",
      showWhenEmpty: true,
    },
  },
  {
    key: "home.about",
    name: "About introduction",
    page: "Homepage",
    description: "Two-column introduction with four feature cards.",
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "title", label: "Heading", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      ...cta("cta", "Button"),
      {
        key: "features",
        label: "Feature cards",
        type: "list",
        max: 4,
        itemFields: [
          { key: "icon", label: "Icon", type: "icon" },
          { key: "title", label: "Title", type: "text" },
          { key: "description", label: "Description", type: "textarea" },
        ],
      },
    ],
    defaults: {
      label: "About EduSkill India Foundation",
      title: "Skill Development That Reaches [[Every Community]]",
      description:
        "EduSkill India Foundation works to make quality skill training, digital education and career guidance available to underprivileged and underserved students. Through local training centers, volunteer trainers and scholarship support, we help young people move from learning to livelihood.",
      ctaLabel: "Learn more about us",
      ctaHref: "/about",
      features: [
        { icon: "BookOpen", title: "Accessible Learning", description: "Low-cost and free courses designed for first-generation learners." },
        { icon: "Users", title: "Community-Based Training", description: "Centers located inside the communities we serve, close to home." },
        { icon: "Briefcase", title: "Career-Oriented Skills", description: "Practical, job-ready curriculum aligned to real employment needs." },
        { icon: "HeartHandshake", title: "Inclusive Opportunities", description: "Special focus on women, rural youth and differently-abled learners." },
      ],
    },
  },
  {
    key: "home.programs",
    name: "Programs section heading",
    page: "Homepage",
    description: "Heading for the programs grid (program cards are managed under Programs).",
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "title", label: "Heading", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
    ],
    defaults: {
      label: "Our Programs",
      title: "Learning Opportunities\nDesigned for [[Real-World Growth]]",
      description: "From digital literacy to entrepreneurship, every program is built around practical skills that open doors.",
    },
  },
  {
    key: "home.courses",
    name: "Popular courses heading",
    page: "Homepage",
    description: "Heading for the popular courses grid (featured courses are managed under Courses).",
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "title", label: "Heading", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
    ],
    defaults: {
      label: "Popular Courses",
      title: "Courses That Lead to [[Livelihoods]]",
      description: "Short, practical courses delivered at local training centers with scholarship support where needed.",
    },
  },
  {
    key: "home.centerSearch",
    name: "Find a training center",
    page: "Homepage",
    description: "Heading and helper text for the center search block.",
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "title", label: "Heading", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
    ],
    defaults: {
      label: "Find a Training Center",
      title: "Training Close to [[Home]]",
      description: "Search by state, district, block and course, or use a center name, code or PIN code.",
    },
  },
  {
    key: "home.process",
    name: "Admission process",
    page: "Homepage",
    description: "Four-step admission process timeline.",
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "title", label: "Heading", type: "text" },
      ...cta("cta", "Button"),
      {
        key: "steps",
        label: "Steps",
        type: "list",
        max: 4,
        itemFields: [
          { key: "title", label: "Title", type: "text" },
          { key: "description", label: "Description", type: "textarea" },
        ],
      },
    ],
    defaults: {
      label: "Admission Process",
      title: "Four Simple Steps to [[Start Learning]]",
      ctaLabel: "Start Your Admission Process",
      ctaHref: "/register",
      steps: [
        { title: "Choose Program", description: "Browse programs and courses and pick the skill you want to build." },
        { title: "Select Training Center", description: "Find the nearest EduSkill center by state, district and block." },
        { title: "Complete Application", description: "Register, upload documents and apply for scholarship if needed." },
        { title: "Start Learning", description: "Get your Student ID, join your batch and begin training." },
      ],
    },
  },
  {
    key: "home.fees",
    name: "Fees & scholarship",
    page: "Homepage",
    description: "Heading for the fee / scholarship presentation (amounts come from the featured course).",
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "title", label: "Heading", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      ...cta("cta", "Button"),
    ],
    defaults: {
      label: "Fees & Scholarships",
      title: "Affordable Training with [[Scholarship Support]]",
      description:
        "Most EduSkill courses are free or heavily subsidised. Need-based and merit scholarships reduce the payable fee further, and installments are available for paid courses.",
      ctaLabel: "Check Eligibility",
      ctaHref: "/scholarship",
    },
  },
  {
    key: "home.why",
    name: "Why EduSkill",
    page: "Homepage",
    description: "Eight feature cards.",
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "title", label: "Heading", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "features",
        label: "Feature cards",
        type: "list",
        max: 8,
        itemFields: [
          { key: "icon", label: "Icon", type: "icon" },
          { key: "title", label: "Title", type: "text" },
          { key: "description", label: "Description", type: "textarea" },
        ],
      },
    ],
    defaults: {
      label: "Why EduSkill",
      title: "Why Students and Communities [[Trust Us]]",
      description: "A learner-first approach backed by verified trainers, local centers and transparent processes.",
      features: [
        { icon: "BookOpen", title: "Accessible Training", description: "Free and low-cost courses for every background." },
        { icon: "UserCheck", title: "Experienced Trainers", description: "Verified volunteer trainers with real industry and teaching experience." },
        { icon: "Users", title: "Community Learning", description: "Peer learning in small, supportive batches." },
        { icon: "Briefcase", title: "Career-Oriented Skills", description: "Curriculum aligned with jobs and self-employment." },
        { icon: "Clock", title: "Flexible Learning", description: "Morning, evening and weekend batches to fit your life." },
        { icon: "Coins", title: "Scholarship Support", description: "Need-based and merit scholarships for deserving students." },
        { icon: "BadgeCheck", title: "Verified Certificates", description: "Every certificate carries a unique number verifiable online." },
        { icon: "MapPin", title: "Local Training Centers", description: "Centers in your district and block, close to home." },
      ],
    },
  },
  {
    key: "home.impact",
    name: "Impact across India",
    page: "Homepage",
    description: "Heading for the India map and coverage statistics.",
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "title", label: "Heading", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
    ],
    defaults: {
      label: "Our Reach",
      title: "Building Skills [[Across India]]",
      description: "Every marker is a real EduSkill training center. Coverage grows as new centers are verified.",
    },
  },
  {
    key: "home.stories",
    name: "Success stories heading",
    page: "Homepage",
    description: "Heading for published success stories.",
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "title", label: "Heading", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
    ],
    defaults: {
      label: "Success Stories",
      title: "Real Students. [[Real Change]].",
      description: "Stories from learners who turned training into opportunity.",
    },
  },
  {
    key: "home.cta",
    name: "Closing call to action",
    page: "Homepage",
    description: "Navy band above the footer.",
    fields: [
      { key: "title", label: "Heading", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      ...cta("primary", "Primary button"),
      ...cta("secondary", "Secondary button"),
    ],
    defaults: {
      title: "Ready to Build Your [[Future]]?",
      description: "Register today, find a training center near you and take the first step towards a skilled career.",
      primaryLabel: "Apply Now",
      primaryHref: "/register",
      secondaryLabel: "Become a Volunteer Trainer",
      secondaryHref: "/become-a-trainer",
    },
  },
  {
    key: "about.page",
    name: "About page",
    page: "About",
    description: "Mission, vision and values on the About page (the long-form story is a CMS page).",
    fields: [
      { key: "heroTitle", label: "Hero heading", type: "text" },
      { key: "heroDescription", label: "Hero description", type: "textarea" },
      { key: "mission", label: "Mission", type: "textarea" },
      { key: "vision", label: "Vision", type: "textarea" },
      {
        key: "values",
        label: "Values",
        type: "list",
        max: 6,
        itemFields: [
          { key: "icon", label: "Icon", type: "icon" },
          { key: "title", label: "Title", type: "text" },
          { key: "description", label: "Description", type: "textarea" },
        ],
      },
    ],
    defaults: {
      heroTitle: "Empowering Communities. Spreading Hope. [[Creating Change]].",
      heroDescription:
        "EduSkill India Foundation is a non-profit initiative that brings skill development, digital education and career-oriented training to underprivileged and underserved students across India.",
      mission:
        "To make practical, career-oriented skill training accessible to every young person in India regardless of income, location or background.",
      vision: "An India where every community has a local pathway from learning to livelihood.",
      values: [
        { icon: "HeartHandshake", title: "Inclusion", description: "We prioritise those with the least access." },
        { icon: "ShieldCheck", title: "Integrity", description: "Transparent processes, verified trainers and verifiable certificates." },
        { icon: "Sprout", title: "Community", description: "Local centers run with and for the community." },
        { icon: "Target", title: "Outcomes", description: "We measure success by employment, enterprise and confidence." },
      ],
    },
  },
  {
    key: "trainer.page",
    name: "Become a trainer page",
    page: "Become a Trainer",
    description: "Content for the volunteer trainer landing page.",
    fields: [
      { key: "title", label: "Heading", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "benefits",
        label: "Why volunteer",
        type: "list",
        max: 6,
        itemFields: [
          { key: "icon", label: "Icon", type: "icon" },
          { key: "title", label: "Title", type: "text" },
          { key: "description", label: "Description", type: "textarea" },
        ],
      },
      {
        key: "levels",
        label: "Volunteer levels",
        type: "list",
        max: 3,
        itemFields: [
          { key: "title", label: "Title", type: "text" },
          { key: "description", label: "Description", type: "textarea" },
        ],
      },
    ],
    defaults: {
      title: "Share Your Skills. [[Change a Life]].",
      description:
        "Volunteer trainers are the heart of EduSkill. Apply at block, district or state level and help students in your own community gain skills that lead to work.",
      benefits: [
        { icon: "Award", title: "Trainer ID & Recognition", description: "Receive an official EduSkill Trainer ID and certificate of service." },
        { icon: "Users", title: "Community Impact", description: "Teach students from your own block, district or state." },
        { icon: "Clock", title: "Flexible Commitment", description: "Choose batches and timings that suit your availability." },
        { icon: "TrendingUp", title: "Grow as a Mentor", description: "Access training materials and trainer development sessions." },
      ],
      levels: [
        { title: "Block Level", description: "Train at centers within a specific block. Ideal for local professionals and graduates." },
        { title: "District Level", description: "Support multiple centers across a district, including trainer mentoring." },
        { title: "State Level", description: "Lead curriculum delivery and master-training across a state." },
      ],
    },
  },
  {
    key: "scholarship.page",
    name: "Scholarship page",
    page: "Scholarship",
    description: "Intro and eligibility text for the scholarship page (programs come from Scholarships).",
    fields: [
      { key: "title", label: "Heading", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "eligibility", label: "Eligibility (one per line)", type: "textarea" },
      { key: "process", label: "How it works (one per line)", type: "textarea" },
    ],
    defaults: {
      title: "Scholarships That Remove the [[Fee Barrier]]",
      description:
        "EduSkill scholarships are decided by the Foundation during application review. Tell us about your situation when you apply and our team will assess eligibility.",
      eligibility:
        "Annual family income below ₹2.5 lakh\nFirst-generation learners and school dropouts returning to education\nWomen, rural youth and differently-abled applicants\nMeritorious students with strong motivation",
      process:
        "Tick 'I need scholarship support' in your application\nUpload income or other supporting documents\nFoundation staff review and decide the scholarship amount\nPay the reduced fee (if any) and confirm your admission",
    },
  },
  {
    key: "donate.page",
    name: "Donate page",
    page: "Donate",
    description: "Donation page content (campaigns are managed under Donations).",
    fields: [
      { key: "title", label: "Heading", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "note", label: "Tax / receipt note", type: "textarea" },
      {
        key: "impacts",
        label: "What your donation does",
        type: "list",
        max: 4,
        itemFields: [
          { key: "amount", label: "Amount (₹)", type: "number" },
          { key: "description", label: "Description", type: "text" },
        ],
      },
    ],
    defaults: {
      title: "Sponsor a Student's [[Skill Journey]]",
      description: "Your contribution funds scholarships, training materials and local center operations.",
      note: "Receipts are issued for every donation. Tax exemption details will be shown here once configured by the Foundation.",
      impacts: [
        { amount: 1500, description: "Sponsors one student's digital literacy course" },
        { amount: 5000, description: "Provides a full scholarship for a vocational course" },
        { amount: 25000, description: "Supports a training center's materials for a month" },
      ],
    },
  },
  {
    key: "site.footer",
    name: "Footer",
    page: "Global",
    description: "Footer description and legal line.",
    fields: [
      { key: "description", label: "Short description", type: "textarea" },
      { key: "legalLine", label: "Legal / registration line", type: "text" },
    ],
    defaults: {
      description:
        "A non-profit foundation creating accessible skill development, education and career opportunities for underserved communities across India.",
      legalLine: "",
    },
  },
];

export function getSectionDef(key: string): CmsSectionDef | undefined {
  return CMS_SECTIONS.find((s) => s.key === key);
}

export function mergeSectionData<T extends object = Record<string, unknown>>(def: CmsSectionDef, data: unknown): T {
  const base = { ...def.defaults } as Record<string, unknown>;
  if (data && typeof data === "object") {
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (v !== undefined && v !== null) base[k] = v;
    }
  }
  return base as T;
}

/** Icons allowed in CMS icon fields (subset of lucide-react). */
export const CMS_ICONS = [
  "BookOpen", "Laptop", "Wrench", "GraduationCap", "Briefcase", "Lightbulb", "Users", "HeartHandshake", "Sprout",
  "Layers", "MapPin", "Award", "ShieldCheck", "Clock", "Globe", "Accessibility", "Building2", "School", "Handshake",
  "Star", "TrendingUp", "Target", "Sparkles", "Monitor", "Smartphone", "Scissors", "Calculator", "Languages", "Store",
  "Sun", "Leaf", "Home", "Heart", "CheckCircle2", "BadgeCheck", "Coins", "BookMarked", "UserCheck", "Rocket",
  "Megaphone", "Palette", "Code2", "Wifi", "Camera", "Truck", "Stethoscope", "Hammer", "PenTool", "LineChart",
] as const;

export type CmsIconName = (typeof CMS_ICONS)[number];
