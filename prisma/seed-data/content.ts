/**
 * Baseline platform content: document types, programs, FAQs, CMS pages, impact stat
 * definitions, course categories and scholarship programs. Everything here is editable
 * from the admin panel after seeding.
 */

export const DOCUMENT_TYPES = [
  { key: "photo", name: "Passport-size photograph", appliesTo: "STUDENT", isRequired: true, sortOrder: 1, description: "Recent colour photograph (JPG/PNG)." },
  { key: "id_proof", name: "Identity proof (Aadhaar / Voter ID / PAN)", appliesTo: "STUDENT", isRequired: true, sortOrder: 2 },
  { key: "address_proof", name: "Address proof", appliesTo: "STUDENT", isRequired: false, sortOrder: 3 },
  { key: "education_certificate", name: "Highest qualification certificate / marksheet", appliesTo: "STUDENT", isRequired: true, sortOrder: 4 },
  { key: "income_certificate", name: "Income certificate (for scholarship)", appliesTo: "STUDENT", isRequired: false, sortOrder: 5, description: "Required only if you request scholarship support." },
  { key: "category_certificate", name: "Caste / category certificate (optional)", appliesTo: "STUDENT", isRequired: false, sortOrder: 6 },
  { key: "resume", name: "Resume / CV", appliesTo: "TRAINER", isRequired: true, sortOrder: 1 },
  { key: "qualification_certificate", name: "Qualification certificate", appliesTo: "TRAINER", isRequired: true, sortOrder: 2 },
  { key: "experience_certificate", name: "Experience certificate", appliesTo: "TRAINER", isRequired: false, sortOrder: 3 },
  { key: "identity_document", name: "Identity document", appliesTo: "TRAINER", isRequired: true, sortOrder: 4 },
  { key: "other_supporting", name: "Other supporting documents", appliesTo: "TRAINER", isRequired: false, sortOrder: 5 },
] as const;

export const PROGRAMS = [
  { title: "Digital Literacy", icon: "Laptop", summary: "Foundational computer, internet and smartphone skills for first-time users, delivered in local languages." },
  { title: "Computer Education", icon: "Monitor", summary: "Office applications, typing, data entry and basic IT skills that open doors to clerical and administrative jobs." },
  { title: "Skill Development", icon: "Layers", summary: "Short, certified skill courses aligned with local employment opportunities and national skill frameworks." },
  { title: "Vocational Training", icon: "Wrench", summary: "Hands-on trades such as electrical work, mobile repair, tailoring and beauty & wellness." },
  { title: "Career Development", icon: "Briefcase", summary: "Spoken English, interview preparation, workplace readiness and job placement support." },
  { title: "Entrepreneurship", icon: "Lightbulb", summary: "Business basics, digital marketing and micro-enterprise support for aspiring self-employed youth." },
  { title: "Women Empowerment", icon: "HeartHandshake", summary: "Safe, women-led batches building financial independence through skills and enterprise." },
  { title: "Youth Empowerment", icon: "Rocket", summary: "Leadership, life skills and mentoring programs for students aged 16 to 25." },
  { title: "Rural Skill Development", icon: "Sprout", summary: "Agri-allied, solar and rural service skills delivered at block-level centers." },
  { title: "Other Foundation Programs", icon: "Sparkles", summary: "Community awareness drives, scholarship support and special initiatives run by the Foundation." },
] as const;

export const FAQS = [
  { category: "Admissions", question: "Who can apply for EduSkill courses?", answer: "Any student or young adult who meets the course eligibility (usually age 15+ and a minimum qualification) can apply. Priority is given to underprivileged and underserved applicants." },
  { category: "Admissions", question: "How do I find a training center near me?", answer: "Use the Find a Training Center search on the homepage. Select your state, district and block, or search by center name, center code or PIN code." },
  { category: "Admissions", question: "What documents do I need?", answer: "Typically a photograph, an identity proof and your highest qualification certificate. If you request scholarship support, an income certificate helps us decide faster. The exact list is shown when you apply." },
  { category: "Fees", question: "Are the courses free?", answer: "Many courses are free. Paid courses have a small fee and scholarship support is available. Fees are shown on each course page and in your application before you submit." },
  { category: "Fees", question: "How does the scholarship work?", answer: "Tick the scholarship option in your application and upload supporting documents. Foundation staff review your case and decide on a full or partial scholarship. The reduced fee is shown in your dashboard." },
  { category: "Trainers", question: "How can I become a volunteer trainer?", answer: "Apply through the Become a Volunteer Trainer page. Choose block, district or state level, submit your profile and documents, and our team will review, verify and, if required, interview you." },
  { category: "Certificates", question: "How do I verify a certificate?", answer: "Every EduSkill certificate has a unique number. Enter it on the Verify Certificate page or scan the QR code printed on the certificate." },
  { category: "Trainers", question: "Do volunteer trainers get paid?", answer: "Volunteer trainers serve the community and receive a Trainer ID, recognition and training support. Any honorarium is decided by the Foundation for specific programs." },
] as const;

export const CMS_PAGES = [
  {
    slug: "about",
    title: "About EduSkill India Foundation",
    excerpt: "Who we are and how we work.",
    content: `## Our Story

EduSkill India Foundation was created with a simple belief: talent is everywhere, but opportunity is not. Across India's villages, small towns and urban neighbourhoods, young people are ready to learn but lack access to affordable, practical training close to home.

We build local training centers, mobilise volunteer trainers from the same communities and connect students to career-oriented courses, scholarships and verified certification.

## How We Work

- **Local centers** are established block by block and verified by the Foundation.
- **Volunteer trainers** apply at block, district or state level and are verified before assignment.
- **Students** register online or at a center, apply for a course and batch, and receive a Student ID on admission.
- **One centralised administration** at the Foundation keeps standards, fees, approvals and certificates consistent across India.

## Governance

All admissions, scholarships, trainer approvals and certificates are controlled by EduSkill India Foundation staff. There are no separate state, district or center administrators, which keeps the process transparent and consistent.`,
  },
  {
    slug: "scholarship",
    title: "Scholarship Support",
    excerpt: "Need-based and merit scholarships for deserving students.",
    content: `## Scholarship Programs

EduSkill India Foundation offers full and partial scholarships so that the course fee is never the reason a student cannot learn. Scholarship decisions are made by Foundation staff during application review.`,
  },
  {
    slug: "volunteer",
    title: "Become a Volunteer Trainer",
    excerpt: "Teach in your community as a verified EduSkill volunteer trainer.",
    content: `## Volunteer With Us

Our volunteer trainers are teachers, professionals, graduates and entrepreneurs who want to give back. After verification you receive an EduSkill Trainer ID and are assigned to centers, courses and batches by the Foundation.`,
  },
  {
    slug: "donate",
    title: "Support Our Work",
    excerpt: "Fund scholarships, materials and training centers.",
    content: `## Why Donate

Every rupee goes towards student scholarships, learning materials and running community training centers.`,
  },
  {
    slug: "contact",
    title: "Contact Us",
    excerpt: "Reach the Foundation team.",
    content: `We would love to hear from you. Use the form to send an enquiry, or reach us using the contact details on this page.`,
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    excerpt: "How we collect, use and protect your information.",
    content: `## Privacy Policy

EduSkill India Foundation ("we", "us") respects your privacy. This policy explains what information we collect through this platform and how we use it.

### Information we collect
- Registration and profile details (name, guardian name, date of birth, contact details, address, education).
- Documents you upload for admission or volunteer trainer applications.
- Attendance, assessment and payment records related to your training.
- Technical information such as IP address and browser type, used for security and analytics.

### How we use it
- To process applications, admissions, scholarships, payments and certificates.
- To communicate with you by email, SMS, WhatsApp or in-app notifications.
- To improve our programs and report aggregated impact.

### Document security
Uploaded documents are stored privately and are only accessible to you and authorised Foundation staff.

### Your rights
You may request a copy, correction or deletion of your personal data by contacting us.

_This policy can be updated from the admin panel. Last updated on seeding._`,
  },
  {
    slug: "terms",
    title: "Terms & Conditions",
    excerpt: "Terms governing use of the EduSkill platform.",
    content: `## Terms & Conditions

By registering on this platform you agree to provide accurate information, use the platform lawfully and follow the code of conduct at training centers.

- Admission is subject to verification of documents and availability of seats.
- Fees, scholarships and refunds are governed by the Foundation's policies.
- Certificates are issued only on meeting attendance and assessment requirements.
- The Foundation may suspend accounts that provide false information or misuse the platform.

_Edit this page from Admin → CMS → Pages._`,
  },
  {
    slug: "refund-policy",
    title: "Refund Policy",
    excerpt: "When and how fees are refunded.",
    content: `## Refund Policy

- Registration fees are non-refundable.
- Course fees paid for a batch that is cancelled by the Foundation are refunded in full.
- Requests for withdrawal before the batch start date are eligible for a refund of the course fee less any processing charges.
- No refund is payable after training has started, except in exceptional circumstances approved by the Foundation.

_Edit this page from Admin → CMS → Pages._`,
  },
  {
    slug: "disclaimer",
    title: "Disclaimer",
    excerpt: "Important information about this website.",
    content: `## Disclaimer

Information on this website is provided in good faith. Course availability, fees, batch schedules and center details may change; the details in your application and dashboard are authoritative. EduSkill India Foundation does not guarantee employment on completion of a course.`,
  },
] as const;

export const IMPACT_STATS = [
  { key: "students", label: "Students Reached", sortOrder: 1, suffix: "+" },
  { key: "centers", label: "Training Centers", sortOrder: 2, suffix: "+" },
  { key: "trainers", label: "Volunteer Trainers", sortOrder: 3, suffix: "+" },
  { key: "states", label: "States / Regions", sortOrder: 4, suffix: "+" },
  { key: "completion", label: "Course Completion", sortOrder: 5, suffix: "%" },
] as const;

export const COURSE_CATEGORIES = [
  { name: "Digital Literacy", icon: "Laptop", sortOrder: 1 },
  { name: "Computer Education", icon: "Monitor", sortOrder: 2 },
  { name: "Vocational Trades", icon: "Wrench", sortOrder: 3 },
  { name: "Communication & Soft Skills", icon: "Languages", sortOrder: 4 },
  { name: "Entrepreneurship", icon: "Lightbulb", sortOrder: 5 },
  { name: "Women Empowerment", icon: "HeartHandshake", sortOrder: 6 },
  { name: "Career Development", icon: "Briefcase", sortOrder: 7 },
] as const;

export const SCHOLARSHIP_PROGRAMS = [
  {
    name: "EduSkill Need-Based Full Scholarship",
    slug: "need-based-full",
    type: "FULL",
    percentage: 100,
    description: "Full fee waiver for students from families with annual income below ₹2.5 lakh.",
    eligibilityCriteria: "Annual family income below ₹2.5 lakh with supporting income certificate.",
  },
  {
    name: "EduSkill Merit Scholarship",
    slug: "merit-50",
    type: "PARTIAL",
    percentage: 50,
    description: "50% fee reduction for meritorious students (60%+ in last qualifying exam).",
    eligibilityCriteria: "Minimum 60% marks in the last qualifying examination.",
  },
  {
    name: "Women Empowerment Assistance",
    slug: "women-assistance",
    type: "NEED_BASED",
    percentage: 75,
    description: "75% fee support for women learners in vocational and entrepreneurship courses.",
    eligibilityCriteria: "Women applicants enrolling in vocational or entrepreneurship courses.",
  },
] as const;
