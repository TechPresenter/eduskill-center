import type { LucideIcon } from "lucide-react";
import {
  Award,
  BadgeCheck,
  Bot,
  Briefcase,
  Building2,
  Clapperboard,
  ClipboardCheck,
  FileCheck,
  Globe,
  GraduationCap,
  HeartHandshake,
  IdCard,
  ImagePlus,
  Library,
  ListChecks,
  Mail,
  Megaphone,
  MessageCircle,
  MonitorPlay,
  Palette,
  PenLine,
  PenTool,
  Presentation,
  Rocket,
  School,
  Search,
  Share2,
  Smartphone,
  Sparkles,
  Store,
  UserCheck,
} from "lucide-react";

/**
 * Digital Marketing Training & Awareness Program — the Foundation's own wording (October 2026,
 * Hindi and English as written), shown on /programs/digital-marketing-training by
 * `DigitalMarketingProgram`. Edit the text here; the layout lives in digital-marketing.tsx.
 */

export const DM_SLUG = "digital-marketing-training";

export const DM_HERO = {
  eyebrow: "Eduskill India Foundation",
  title: "Digital Marketing Training & [[Awareness Program]]",
  tagline: "Learn Digital Marketing • Create • Promote • Grow",
  rotating: ["Learn Digital Marketing", "Create Content", "Build Your Brand", "Grow Digitally"],
  chips: ["Offline / Online", "Students, Teachers, Youth, Job Seekers & Entrepreneurs", "Certificate as per assessment"],
};

export const DM_TICKER = ["Learn Digital Marketing", "Create Content", "Build Your Brand", "Grow Digitally", "Social Media", "SEO", "Canva", "AI Tools", "YouTube", "WhatsApp Business"];

export const DM_INTRO =
  "Eduskill India Foundation द्वारा विद्यार्थियों, युवाओं, शिक्षकों, job seekers, entrepreneurs तथा छोटे व्यवसायों के लिए Digital Marketing Training & Awareness Program आयोजित किया जा सकता है। इसका उद्देश्य प्रतिभागियों को डिजिटल प्लेटफॉर्म, ऑनलाइन प्रमोशन, सोशल मीडिया, कंटेंट क्रिएशन और आधुनिक AI आधारित Marketing Tools की व्यावहारिक जानकारी देना है।";

/** "Proposed Program Branding" — shown as the programme's fact card. */
export const DM_BRANDING = {
  name: "Digital Marketing Training & Awareness Program",
  line: "Learn Digital Marketing | Create Content | Build Your Brand | Grow Digitally",
  facts: [
    { label: "Organized by", value: "Eduskill India Foundation" },
    { label: "Program Category", value: "Skill Development & Digital Education" },
    { label: "Mode", value: "Offline / Online" },
    { label: "Target Group", value: "Students, Teachers, Youth, Job Seekers & Entrepreneurs" },
  ],
};

export const DM_OBJECTIVES = [
  "Digital Marketing की मूल अवधारणाओं को समझाना",
  "विद्यार्थियों को career-oriented digital skills देना",
  "Social Media Marketing की practical knowledge देना",
  "Online branding और promotion समझाना",
  "SEO और Google Search की basic जानकारी देना",
  "Canva एवं creative content creation सिखाना",
  "AI Tools का Digital Marketing में उपयोग समझाना",
  "Freelancing एवं digital career opportunities से परिचित कराना",
  "छोटे व्यवसायों को online presence बनाने में सहायता करना",
  "Digital safety एवं responsible online behaviour के प्रति जागरूक करना",
];

export const DM_PARTICIPANTS: { icon: LucideIcon; label: string }[] = [
  { icon: School, label: "School Students" },
  { icon: GraduationCap, label: "College Students" },
  { icon: Library, label: "University Students" },
  { icon: Presentation, label: "Teachers & Trainers" },
  { icon: Sparkles, label: "Freshers" },
  { icon: Briefcase, label: "Job Seekers" },
  { icon: Rocket, label: "Entrepreneurs" },
  { icon: Store, label: "Small Business Owners" },
  { icon: UserCheck, label: "Self-employed Professionals" },
  { icon: HeartHandshake, label: "NGO/Community Members" },
];

export const DM_MODULES: { title: string; icon: LucideIcon; topics: string[] }[] = [
  { title: "Digital Marketing Introduction", icon: Megaphone, topics: ["Digital Marketing क्या है?", "Traditional vs Digital Marketing", "Digital Marketing ecosystem", "Career opportunities"] },
  { title: "Social Media Marketing", icon: Share2, topics: ["Facebook Marketing", "Instagram Marketing", "LinkedIn Basics", "Social Media Page Management", "Audience & Engagement"] },
  { title: "Content Marketing", icon: PenLine, topics: ["Content क्या है?", "Content planning", "Captions & hashtags", "Educational/promotional content", "Blog & article basics"] },
  { title: "Canva & Creative Design", icon: Palette, topics: ["Canva introduction", "Poster design", "Social media posts", "Presentation design", "Basic branding"] },
  { title: "SEO", icon: Search, topics: ["Search Engine Optimization", "Keywords", "On-page SEO basics", "Website visibility", "Google Search fundamentals"] },
  { title: "Google & Online Promotion", icon: Globe, topics: ["Google Business Profile basics", "Search marketing concepts", "Online visibility", "Digital campaign fundamentals"] },
  { title: "Video & YouTube Marketing", icon: Clapperboard, topics: ["YouTube basics", "Short videos/Reels", "Video titles & descriptions", "Thumbnail basics", "Audience engagement"] },
  { title: "WhatsApp Business", icon: MessageCircle, topics: ["WhatsApp Business profile", "Catalogue", "Customer communication", "Broadcast & promotional communication", "Basic lead management"] },
  {
    title: "AI for Digital Marketing",
    icon: Bot,
    topics: ["AI introduction", "AI-assisted content creation", "Caption generation", "Marketing ideas", "Image & creative assistance", "Productivity tools", "Responsible use of AI"],
  },
  { title: "Email Marketing", icon: Mail, topics: ["Email marketing basics", "Campaign concepts", "Customer communication", "Email content"] },
  { title: "Personal Branding", icon: IdCard, topics: ["Professional digital profile", "LinkedIn profile basics", "Portfolio", "Online reputation", "Career visibility"] },
  {
    title: "Freelancing & Career Awareness",
    icon: Briefcase,
    topics: ["Digital Marketing career roles", "Freelancing basics", "Portfolio development", "Client communication", "Entry-level opportunities"],
  },
];

export const DM_ACTIVITIES_INTRO = "Participants को केवल theory नहीं, बल्कि practical activities भी कराई जा सकती हैं:";
export const DM_ACTIVITIES: { icon: LucideIcon; label: string }[] = [
  { icon: Megaphone, label: "एक sample social media campaign बनाना" },
  { icon: Palette, label: "Canva में promotional poster बनाना" },
  { icon: Smartphone, label: "Instagram/Facebook content तैयार करना" },
  { icon: Search, label: "SEO keyword exercise" },
  { icon: ImagePlus, label: "YouTube thumbnail बनाना" },
  { icon: MessageCircle, label: "WhatsApp Business catalogue exercise" },
  { icon: Bot, label: "AI की सहायता से marketing content तैयार करना" },
  { icon: UserCheck, label: "Personal branding profile तैयार करना" },
];

export const DM_DURATIONS: [string, string][] = [
  ["Awareness Workshop", "1 Day"],
  ["Basic Digital Marketing", "3 Days"],
  ["Foundation Program", "7 Days"],
  ["Skill Development Program", "15 Days"],
  ["Certificate Training", "21 Days"],
  ["Advanced Program", "30 Days"],
];

export const DM_MODES: { icon: LucideIcon; title: string; items: string[] }[] = [
  { icon: Building2, title: "Offline Classroom Training", items: ["School", "College", "Training Centre", "Community Centre"] },
  { icon: MonitorPlay, title: "Online Training", items: ["Live Classes", "Video Sessions", "Digital Study Material", "Assignments", "Practical Activities"] },
];

export const DM_OUTCOMES = {
  intro: "कार्यक्रम पूरा करने के बाद प्रतिभागी:",
  items: [
    "Digital Marketing fundamentals समझ सकेंगे",
    "Social Media platforms का professional उपयोग समझ सकेंगे",
    "Basic promotional content तैयार कर सकेंगे",
    "Canva से digital creatives बना सकेंगे",
    "SEO की basic concepts समझ सकेंगे",
    "AI tools का responsible उपयोग कर सकेंगे",
    "Personal branding की शुरुआत कर सकेंगे",
    "Digital career और freelancing opportunities को समझ सकेंगे",
  ],
};

export const DM_CERTIFICATE =
  "सफलतापूर्वक training/workshop पूरा करने वाले प्रतिभागियों को Eduskill India Foundation की ओर से participation/training certificate प्रदान किया जा सकता है, कार्यक्रम की प्रकृति और निर्धारित assessment के अनुसार।";

export const DM_IMPLEMENTATION_INTRO = "Eduskill India Foundation इस कार्यक्रम को educational institutions में निम्न रूप में आयोजित कर सकता है:";
export const DM_IMPLEMENTATION: [string, string][] = [
  ["School Digital Awareness Workshop", "Students + Teachers"],
  ["College Digital Skill Program", "Students + Job Seekers"],
  ["Teacher Digital Marketing Awareness", "Teachers + Academic Staff"],
  ["Entrepreneurship Digital Marketing Workshop", "Small Businesses + Entrepreneurs"],
];

export const DM_ASSESSMENT: { icon: LucideIcon; label: string }[] = [
  { icon: ClipboardCheck, label: "Pre-training assessment" },
  { icon: ListChecks, label: "Module-wise activities" },
  { icon: PenTool, label: "Practical assignment" },
  { icon: FileCheck, label: "Final assessment" },
  { icon: Award, label: "Participation/Training Certificate" },
];

export const DM_INSTITUTION_BENEFITS = [
  "Students में digital awareness",
  "Career-oriented skill development",
  "Practical technology exposure",
  "AI & digital tools की awareness",
  "Entrepreneurship awareness",
  "Digital safety awareness",
  "Certificate-based learning activity",
];

/** `kind` shades the break and the closing rows. Times as the Foundation wrote them. */
export const DM_SCHEDULE: { cells: [string, string]; kind?: "break" | "closing" }[] = [
  { cells: ["09:30 AM – 10:00 AM", "Registration"] },
  { cells: ["10:00 AM – 10:20 AM", "Introduction to Digital Marketing"] },
  { cells: ["10:20 AM – 11:15 AM", "Social Media Marketing"] },
  { cells: ["11:15 AM – 12:00 PM", "Canva & Content Creation"] },
  { cells: ["12:00 PM – 12:15 PM", "Break"], kind: "break" },
  { cells: ["12:15 PM – 01:00 PM", "SEO & Google Marketing"] },
  { cells: ["01:00 PM – 01:45 PM", "AI Tools for Marketing"] },
  { cells: ["01:45 PM – 02:30 PM", "Practical Activity"] },
  { cells: ["02:30 PM – 03:00 PM", "Career & Freelancing Awareness"] },
  { cells: ["03:00 PM – 03:30 PM", "Assessment & Certificate Distribution"], kind: "closing" },
];

export const DM_VISION =
  "Eduskill India Foundation के Digital Marketing Program का उद्देश्य युवाओं और विद्यार्थियों को digital literacy से आगे बढ़ाकर practical, career-oriented digital skills से जोड़ना है।";

export const DM_BOOKING = {
  title: "Organize This Program at [[Your Institution]]",
  subtitle: "Schools, colleges, training centres and community centres can host it — offline or online.",
  enquirySubject: "Digital Marketing Training & Awareness Program",
  facts: [
    { icon: Megaphone, label: "12 modules" },
    { icon: Palette, label: "8 practical activities" },
    { icon: Building2, label: "1 to 30 days" },
    { icon: BadgeCheck, label: "Assessment-based certificate" },
  ] satisfies { icon: LucideIcon; label: string }[],
};
