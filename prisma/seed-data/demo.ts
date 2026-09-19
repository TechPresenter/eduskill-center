/**
 * DEMO DATA – clearly fictional records used to showcase the platform.
 * Created only when SEED_DEMO is not "false". Remove from production with `npm run db:seed -- --no-demo`
 * or by deleting the demo records from the admin panel (all demo accounts use the *.demo.eduskill.local domain).
 */

export const DEMO_PASSWORD = "Demo@1234";

export const DEMO_COURSES = [
  { code: "DLF-101", name: "Digital Literacy Foundation", category: "Digital Literacy", level: "BEGINNER", mode: "OFFLINE", durationText: "6 Weeks", durationWeeks: 6, totalClasses: 24, courseFee: 0, registrationFee: 0, scholarshipAvailable: false, isFeatured: true, minAge: 14, eligibility: "Basic reading ability in any language. No prior computer experience needed.", shortDescription: "Computers, smartphones, internet safety and digital payments for first-time users.", requiredDocuments: ["photo", "id_proof"], icon: "Laptop", syllabus: ["Introduction to computers & smartphones", "Typing and file management", "Using the internet safely", "Email, messaging and video calls", "Digital payments (UPI) and government services", "Assessment & certification"] },
  { code: "BCA-102", name: "Basic Computer Applications", category: "Computer Education", level: "BEGINNER", mode: "OFFLINE", durationText: "3 Months", durationWeeks: 12, totalClasses: 60, courseFee: 2500, registrationFee: 100, examFee: 200, certificateFee: 0, scholarshipAvailable: true, isFeatured: true, minAge: 15, eligibility: "Class 8 pass or equivalent.", shortDescription: "MS Office, internet, email and office productivity for entry-level jobs.", requiredDocuments: ["photo", "id_proof", "education_certificate"], icon: "Monitor", syllabus: ["Computer fundamentals & Windows", "MS Word", "MS Excel", "MS PowerPoint", "Internet, email & online forms", "Typing speed building", "Project & assessment"] },
  { code: "ACC-201", name: "Tally & Accounting Essentials", category: "Computer Education", level: "INTERMEDIATE", mode: "OFFLINE", durationText: "3 Months", durationWeeks: 12, totalClasses: 60, courseFee: 4000, registrationFee: 100, examFee: 300, scholarshipAvailable: true, isFeatured: true, minAge: 17, eligibility: "Class 12 pass (Commerce preferred).", shortDescription: "Book-keeping, GST basics and Tally for accounts assistant roles.", requiredDocuments: ["photo", "id_proof", "education_certificate"], icon: "Calculator", syllabus: ["Accounting fundamentals", "Tally setup & masters", "Vouchers & inventory", "GST & TDS basics", "Reports & MIS", "Practical assessment"] },
  { code: "ENG-101", name: "Spoken English & Communication", category: "Communication & Soft Skills", level: "BEGINNER", mode: "HYBRID", durationText: "2 Months", durationWeeks: 8, totalClasses: 40, courseFee: 1500, registrationFee: 0, scholarshipAvailable: true, isFeatured: true, minAge: 14, eligibility: "Open to all.", shortDescription: "Confidence-building spoken English, interview skills and workplace communication.", requiredDocuments: ["photo", "id_proof"], icon: "Languages", syllabus: ["Everyday conversation", "Grammar in use", "Listening & pronunciation", "Presentations", "Interview preparation", "Final speaking assessment"] },
  { code: "MRT-201", name: "Mobile Repair Technician", category: "Vocational Trades", level: "INTERMEDIATE", mode: "OFFLINE", durationText: "3 Months", durationWeeks: 12, totalClasses: 72, courseFee: 5000, registrationFee: 200, examFee: 300, certificateFee: 100, scholarshipAvailable: true, isFeatured: false, minAge: 18, eligibility: "Class 10 pass.", shortDescription: "Hardware and software repair of smartphones with hands-on lab practice.", requiredDocuments: ["photo", "id_proof", "education_certificate"], icon: "Smartphone", syllabus: ["Tools & safety", "Mobile hardware architecture", "Software flashing & unlocking", "Screen, battery & port replacement", "Troubleshooting", "Shop setup & customer service"] },
  { code: "TGM-101", name: "Tailoring & Garment Making", category: "Women Empowerment", level: "BEGINNER", mode: "OFFLINE", durationText: "4 Months", durationWeeks: 16, totalClasses: 80, courseFee: 2000, registrationFee: 0, scholarshipAvailable: true, isFeatured: true, minAge: 16, eligibility: "Open to all; women-only batches available.", shortDescription: "Measurement, cutting, stitching and finishing for home-based enterprise.", requiredDocuments: ["photo", "id_proof"], icon: "Scissors", syllabus: ["Machine handling & safety", "Measurements & drafting", "Ladies' garments", "Kids' garments", "Alterations & finishing", "Costing & selling"] },
  { code: "BWF-101", name: "Beauty & Wellness Foundation", category: "Vocational Trades", level: "BEGINNER", mode: "OFFLINE", durationText: "3 Months", durationWeeks: 12, totalClasses: 60, courseFee: 3000, registrationFee: 100, scholarshipAvailable: true, isFeatured: false, minAge: 16, eligibility: "Class 8 pass.", shortDescription: "Skin care, hair care and salon basics with hygiene and customer handling.", requiredDocuments: ["photo", "id_proof"], icon: "Sparkles", syllabus: ["Hygiene & safety", "Skin care basics", "Hair care & styling", "Make-up fundamentals", "Client handling", "Salon setup"] },
  { code: "DEO-102", name: "Data Entry & Office Automation", category: "Computer Education", level: "BEGINNER", mode: "OFFLINE", durationText: "2 Months", durationWeeks: 8, totalClasses: 40, courseFee: 1800, registrationFee: 100, scholarshipAvailable: true, isFeatured: false, minAge: 16, eligibility: "Class 10 pass.", shortDescription: "High-speed typing, spreadsheets and online forms for data operator jobs.", requiredDocuments: ["photo", "id_proof", "education_certificate"], icon: "Monitor", syllabus: ["Typing mastery", "Spreadsheet data handling", "Online forms & portals", "Document formatting", "Speed & accuracy test"] },
  { code: "RSA-201", name: "Retail Sales Associate", category: "Career Development", level: "BEGINNER", mode: "OFFLINE", durationText: "6 Weeks", durationWeeks: 6, totalClasses: 30, courseFee: 0, registrationFee: 0, scholarshipAvailable: false, isFeatured: false, minAge: 18, eligibility: "Class 10 pass.", shortDescription: "Customer service, billing and merchandising for retail jobs.", requiredDocuments: ["photo", "id_proof", "education_certificate"], icon: "Store", syllabus: ["Retail basics", "Customer service", "Billing & POS", "Visual merchandising", "Placement readiness"] },
  { code: "ESE-301", name: "Entrepreneurship & Self-Employment", category: "Entrepreneurship", level: "INTERMEDIATE", mode: "HYBRID", durationText: "2 Months", durationWeeks: 8, totalClasses: 32, courseFee: 1000, registrationFee: 0, scholarshipAvailable: true, isFeatured: true, minAge: 18, eligibility: "Open to all with a business idea.", shortDescription: "Business planning, digital marketing basics and access to micro-finance schemes.", requiredDocuments: ["photo", "id_proof"], icon: "Lightbulb", syllabus: ["Idea to business model", "Costing & pricing", "Digital marketing basics", "Government schemes & loans", "Pitch & plan presentation"] },
  { code: "WDM-202", name: "Web & Digital Marketing Basics", category: "Career Development", level: "INTERMEDIATE", mode: "ONLINE", durationText: "3 Months", durationWeeks: 12, totalClasses: 48, courseFee: 3500, registrationFee: 100, scholarshipAvailable: true, isFeatured: false, minAge: 17, eligibility: "Class 12 pass with basic computer knowledge.", shortDescription: "Websites, social media marketing and freelancing fundamentals.", requiredDocuments: ["photo", "id_proof", "education_certificate"], icon: "Globe", syllabus: ["Web basics & website builders", "Social media marketing", "Content & design tools", "Search & ads basics", "Freelancing platforms", "Capstone project"] },
  { code: "SOL-201", name: "Solar Technician Basics", category: "Vocational Trades", level: "BEGINNER", mode: "OFFLINE", durationText: "2 Months", durationWeeks: 8, totalClasses: 40, courseFee: 2500, registrationFee: 100, scholarshipAvailable: true, isFeatured: false, minAge: 18, eligibility: "Class 10 pass.", shortDescription: "Installation and maintenance of rooftop and rural solar systems.", requiredDocuments: ["photo", "id_proof", "education_certificate"], icon: "Sun", syllabus: ["Solar energy fundamentals", "Components & wiring", "Installation practice", "Maintenance & safety", "Assessment"] },
] as const;

export interface DemoCenter {
  name: string;
  state: string;
  district: string;
  block: string;
  address: string;
  villageTown: string;
  pincode: string;
  lat: number;
  lng: number;
  phone: string;
  email: string;
  capacity: number;
  facilities: string[];
  courses: string[];
  verified: boolean;
  description: string;
}

export const DEMO_CENTERS: DemoCenter[] = [
  { name: "EduSkill Kolkata Skill Center", state: "WB", district: "Kolkata", block: "Kolkata South", address: "12/1 Rashbehari Avenue, Near Gariahat Crossing", villageTown: "Gariahat", pincode: "700029", lat: 22.5185, lng: 88.3646, phone: "9800000001", email: "kolkata@demo.eduskill.local", capacity: 120, facilities: ["Computer Lab (30 seats)", "Smart Classroom", "Library", "Wi-Fi", "Drinking Water", "Wheelchair Access"], courses: ["BCA-102", "DLF-101", "ACC-201", "ENG-101", "ESE-301"], verified: true, description: "Our flagship Kolkata center offers computer education, accounting and communication courses with morning and evening batches." },
  { name: "EduSkill Patna Community Training Center", state: "BR", district: "Patna", block: "Patna Sadar", address: "Boring Road, Opposite Krishna Apartment", villageTown: "Boring Road", pincode: "800001", lat: 25.6151, lng: 85.1112, phone: "9800000002", email: "patna@demo.eduskill.local", capacity: 90, facilities: ["Computer Lab (25 seats)", "Classroom", "Wi-Fi", "Drinking Water"], courses: ["DLF-101", "BCA-102", "DEO-102", "MRT-201", "ENG-101"], verified: true, description: "Community training center serving Patna Sadar with computer and mobile repair courses." },
  { name: "EduSkill Noida Youth Skill Hub", state: "UP", district: "Gautam Buddha Nagar", block: "Bisrakh", address: "C-Block, Sector 62", villageTown: "Noida", pincode: "201309", lat: 28.6274, lng: 77.3717, phone: "9800000003", email: "noida@demo.eduskill.local", capacity: 150, facilities: ["Computer Lab (40 seats)", "Smart Classroom", "Placement Cell", "Wi-Fi", "Cafeteria"], courses: ["BCA-102", "WDM-202", "RSA-201", "ENG-101", "ESE-301"], verified: true, description: "Youth skill hub focusing on digital marketing, retail and communication skills with placement support." },
  { name: "EduSkill Lucknow Women's Center", state: "UP", district: "Lucknow", block: "Sarojini Nagar", address: "Kanpur Road, Near Alambagh Bus Stand", villageTown: "Alambagh", pincode: "226005", lat: 26.8206, lng: 80.9024, phone: "9800000004", email: "lucknow@demo.eduskill.local", capacity: 80, facilities: ["Tailoring Lab (20 machines)", "Beauty Lab", "Classroom", "Creche", "Drinking Water"], courses: ["TGM-101", "BWF-101", "DLF-101", "ESE-301"], verified: true, description: "Women-led center offering tailoring, beauty & wellness and entrepreneurship courses." },
  { name: "EduSkill Pune Skill Center", state: "MH", district: "Pune", block: "Haveli", address: "Hadapsar Industrial Estate Road", villageTown: "Hadapsar", pincode: "411028", lat: 18.5089, lng: 73.9260, phone: "9800000005", email: "pune@demo.eduskill.local", capacity: 100, facilities: ["Computer Lab (30 seats)", "Electrical Lab", "Wi-Fi"], courses: ["BCA-102", "ACC-201", "SOL-201", "ENG-101"], verified: true, description: "Industrial-area center with accounting and solar technician training." },
  { name: "EduSkill Bengaluru Learning Center", state: "KA", district: "Bengaluru Urban", block: "Bengaluru South", address: "80 Feet Road, Koramangala 4th Block", villageTown: "Koramangala", pincode: "560034", lat: 12.9345, lng: 77.6260, phone: "9800000006", email: "bengaluru@demo.eduskill.local", capacity: 110, facilities: ["Computer Lab (35 seats)", "Smart Classroom", "Wi-Fi", "Library"], courses: ["WDM-202", "BCA-102", "ENG-101", "ESE-301"], verified: true, description: "Urban learning center for digital skills and communication." },
  { name: "EduSkill Jaipur Vocational Center", state: "RJ", district: "Jaipur", block: "Sanganer", address: "Tonk Road, Near Sanganer Flyover", villageTown: "Sanganer", pincode: "302029", lat: 26.8206, lng: 75.7856, phone: "9800000007", email: "jaipur@demo.eduskill.local", capacity: 75, facilities: ["Tailoring Lab", "Computer Lab (20 seats)", "Classroom"], courses: ["TGM-101", "DLF-101", "RSA-201", "SOL-201"], verified: true, description: "Vocational center for tailoring, retail and solar skills." },
  { name: "EduSkill Ranchi Rural Skill Center", state: "JH", district: "Ranchi", block: "Kanke", address: "Kanke Road, Near BAU Gate", villageTown: "Kanke", pincode: "834006", lat: 23.4271, lng: 85.3206, phone: "9800000008", email: "ranchi@demo.eduskill.local", capacity: 60, facilities: ["Classroom", "Computer Lab (15 seats)", "Drinking Water"], courses: ["DLF-101", "SOL-201", "TGM-101", "ESE-301"], verified: true, description: "Rural skill center serving Kanke block with digital literacy and solar courses." },
  { name: "EduSkill Guwahati Center", state: "AS", district: "Kamrup Metropolitan", block: "Guwahati Sadar", address: "GS Road, Near Bhangagarh", villageTown: "Bhangagarh", pincode: "781005", lat: 26.1584, lng: 91.7683, phone: "9800000009", email: "guwahati@demo.eduskill.local", capacity: 70, facilities: ["Computer Lab (20 seats)", "Classroom", "Wi-Fi"], courses: ["DLF-101", "BCA-102", "ENG-101", "MRT-201"], verified: false, description: "New center in Guwahati, pending final verification." },
  { name: "EduSkill Bhopal Skill Center", state: "MP", district: "Bhopal", block: "Phanda", address: "MP Nagar Zone II", villageTown: "MP Nagar", pincode: "462011", lat: 23.2332, lng: 77.4343, phone: "9800000010", email: "bhopal@demo.eduskill.local", capacity: 85, facilities: ["Computer Lab (25 seats)", "Smart Classroom", "Wi-Fi"], courses: ["BCA-102", "DEO-102", "ENG-101", "ACC-201"], verified: true, description: "Central Bhopal center for computer and accounting courses." },
];

export const DEMO_STAFF = [
  { name: "Ananya Sen", email: "admissions@demo.eduskill.local", mobile: "9810000001", role: "admissions-staff", designation: "Admissions Officer", department: "Admissions" },
  { name: "Rahul Verma", email: "finance@demo.eduskill.local", mobile: "9810000002", role: "finance-staff", designation: "Finance Executive", department: "Finance" },
  { name: "Meera Iyer", email: "content@demo.eduskill.local", mobile: "9810000003", role: "content-staff", designation: "Communications Lead", department: "Communications" },
] as const;

export const DEMO_TRAINERS = [
  { name: "Arindam Bose", email: "trainer.kolkata@demo.eduskill.local", mobile: "9820000001", gender: "MALE", level: "BLOCK", state: "WB", district: "Kolkata", block: "Kolkata South", qualification: "MCA", skills: ["MS Office", "Tally", "Computer Fundamentals"], languages: ["Bengali", "Hindi", "English"], experienceYears: 8, teachingExperienceYears: 5, center: 0, courses: ["BCA-102", "ACC-201"], dob: "1988-04-12", address: "Jadavpur, Kolkata", pincode: "700032", motivation: "I want to help students in my neighbourhood become job-ready with computer skills." },
  { name: "Priya Kumari", email: "trainer.patna@demo.eduskill.local", mobile: "9820000002", gender: "FEMALE", level: "DISTRICT", state: "BR", district: "Patna", block: null, qualification: "B.Ed, M.A. English", skills: ["Spoken English", "Soft Skills", "Digital Literacy"], languages: ["Hindi", "English", "Maithili"], experienceYears: 6, teachingExperienceYears: 6, center: 1, courses: ["ENG-101", "DLF-101"], dob: "1991-09-25", address: "Kankarbagh, Patna", pincode: "800020", motivation: "Communication skills change how young people see themselves. I want to bring that confidence to Patna." },
  { name: "Mohammad Faisal", email: "trainer.up@demo.eduskill.local", mobile: "9820000003", gender: "MALE", level: "STATE", state: "UP", district: null, block: null, qualification: "B.Tech (CSE)", skills: ["Digital Marketing", "Web Development", "Entrepreneurship"], languages: ["Hindi", "English", "Urdu"], experienceYears: 10, teachingExperienceYears: 4, center: 2, courses: ["WDM-202", "ESE-301"], dob: "1986-01-30", address: "Gomti Nagar, Lucknow", pincode: "226010", motivation: "As a state-level master trainer I want to build a network of digital skill trainers across Uttar Pradesh." },
  { name: "Sunita Devi", email: "trainer.lucknow@demo.eduskill.local", mobile: "9820000004", gender: "FEMALE", level: "BLOCK", state: "UP", district: "Lucknow", block: "Sarojini Nagar", qualification: "Diploma in Fashion Design", skills: ["Tailoring", "Garment Making", "Embroidery"], languages: ["Hindi"], experienceYears: 12, teachingExperienceYears: 7, center: 3, courses: ["TGM-101"], dob: "1984-07-08", address: "Alambagh, Lucknow", pincode: "226005", motivation: "Tailoring gave me independence. I want every woman in my block to have the same chance." },
] as const;

export const DEMO_TRAINER_APPLICATIONS_PENDING = [
  { name: "Kavya Nair", email: "kavya.applicant@demo.eduskill.local", mobile: "9830000001", gender: "FEMALE", level: "DISTRICT", state: "KA", district: "Bengaluru Urban", block: null, qualification: "MBA", skills: ["Retail", "Sales", "Communication"], languages: ["Kannada", "English"], experienceYears: 5, teachingExperienceYears: 1, status: "SUBMITTED", dob: "1993-11-02", address: "BTM Layout, Bengaluru", pincode: "560076", motivation: "I want to mentor youth entering retail and sales careers." },
  { name: "Deepak Sharma", email: "deepak.applicant@demo.eduskill.local", mobile: "9830000002", gender: "MALE", level: "BLOCK", state: "RJ", district: "Jaipur", block: "Sanganer", qualification: "ITI Electrician", skills: ["Solar Installation", "Electrical Wiring"], languages: ["Hindi"], experienceYears: 9, teachingExperienceYears: 2, status: "INTERVIEW", dob: "1989-03-15", address: "Sanganer, Jaipur", pincode: "302029", motivation: "Solar is the future of rural employment and I can train technicians hands-on." },
  { name: "Rina Das", email: "rina.applicant@demo.eduskill.local", mobile: "9830000003", gender: "FEMALE", level: "STATE", state: "AS", district: null, block: null, qualification: "M.Sc Computer Science", skills: ["Computer Education", "Data Entry"], languages: ["Assamese", "Bengali", "English"], experienceYears: 7, teachingExperienceYears: 5, status: "UNDER_REVIEW", dob: "1990-06-21", address: "Beltola, Guwahati", pincode: "781028", motivation: "Assam needs more digital educators and I want to lead that effort." },
] as const;

export interface DemoStudent {
  name: string;
  email: string;
  mobile: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  dob: string;
  guardianName: string;
  guardianRelation: string;
  state: string;
  district: string;
  block: string;
  villageTown: string;
  address: string;
  pincode: string;
  qualification: string;
  institution: string;
  passingYear: number;
  familyIncome: string;
  occupation: string;
  areaType: "RURAL" | "URBAN";
  scholarshipRequired: boolean;
  /** index into DEMO_CENTERS */
  center: number;
  course: string;
  status: "SUBMITTED" | "UNDER_REVIEW" | "DOCUMENTS_REQUIRED" | "APPROVED" | "PAYMENT_PENDING" | "PAYMENT_COMPLETED" | "ADMISSION_CONFIRMED" | "WAITLISTED" | "REJECTED" | "COMPLETED";
}

export const DEMO_STUDENTS: DemoStudent[] = [
  { name: "Riya Mondal", email: "student1@demo.eduskill.local", mobile: "9840000001", gender: "FEMALE", dob: "2004-05-14", guardianName: "Subhash Mondal", guardianRelation: "Father", state: "WB", district: "Kolkata", block: "Kolkata South", villageTown: "Gariahat", address: "45 Hindustan Park", pincode: "700029", qualification: "Class 12", institution: "Kolkata Girls High School", passingYear: 2022, familyIncome: "Below ₹1.5 lakh", occupation: "Student", areaType: "URBAN", scholarshipRequired: true, center: 0, course: "BCA-102", status: "ADMISSION_CONFIRMED" },
  { name: "Aman Kumar", email: "student2@demo.eduskill.local", mobile: "9840000002", gender: "MALE", dob: "2003-08-22", guardianName: "Ramesh Kumar", guardianRelation: "Father", state: "BR", district: "Patna", block: "Patna Sadar", villageTown: "Boring Road", address: "Lane 4, Boring Canal Road", pincode: "800001", qualification: "Class 10", institution: "Patna High School", passingYear: 2020, familyIncome: "Below ₹2.5 lakh", occupation: "Part-time worker", areaType: "URBAN", scholarshipRequired: true, center: 1, course: "MRT-201", status: "SUBMITTED" },
  { name: "Sneha Gupta", email: "student3@demo.eduskill.local", mobile: "9840000003", gender: "FEMALE", dob: "2002-12-03", guardianName: "Anil Gupta", guardianRelation: "Father", state: "UP", district: "Gautam Buddha Nagar", block: "Bisrakh", villageTown: "Noida", address: "Sector 62, House 118", pincode: "201309", qualification: "Graduate", institution: "Delhi University (SOL)", passingYear: 2023, familyIncome: "₹2.5 – 5 lakh", occupation: "Job seeker", areaType: "URBAN", scholarshipRequired: false, center: 2, course: "WDM-202", status: "UNDER_REVIEW" },
  { name: "Farheen Bano", email: "student4@demo.eduskill.local", mobile: "9840000004", gender: "FEMALE", dob: "1999-02-17", guardianName: "Shakeel Ahmad", guardianRelation: "Husband", state: "UP", district: "Lucknow", block: "Sarojini Nagar", villageTown: "Alambagh", address: "Near Alambagh Bus Stand", pincode: "226005", qualification: "Class 8", institution: "Govt Girls School Alambagh", passingYear: 2013, familyIncome: "Below ₹1.5 lakh", occupation: "Homemaker", areaType: "URBAN", scholarshipRequired: true, center: 3, course: "TGM-101", status: "PAYMENT_PENDING" },
  { name: "Omkar Patil", email: "student5@demo.eduskill.local", mobile: "9840000005", gender: "MALE", dob: "2001-10-09", guardianName: "Vitthal Patil", guardianRelation: "Father", state: "MH", district: "Pune", block: "Haveli", villageTown: "Hadapsar", address: "Gadital, Hadapsar", pincode: "411028", qualification: "ITI", institution: "ITI Aundh", passingYear: 2021, familyIncome: "₹2.5 – 5 lakh", occupation: "Job seeker", areaType: "URBAN", scholarshipRequired: false, center: 4, course: "SOL-201", status: "PAYMENT_COMPLETED" },
  { name: "Lakshmi R", email: "student6@demo.eduskill.local", mobile: "9840000006", gender: "FEMALE", dob: "2005-01-25", guardianName: "Rajan", guardianRelation: "Father", state: "KA", district: "Bengaluru Urban", block: "Bengaluru South", villageTown: "Koramangala", address: "Ejipura Main Road", pincode: "560047", qualification: "Class 12", institution: "Govt PU College", passingYear: 2023, familyIncome: "Below ₹1.5 lakh", occupation: "Student", areaType: "URBAN", scholarshipRequired: true, center: 5, course: "BCA-102", status: "DOCUMENTS_REQUIRED" },
  { name: "Mahesh Meena", email: "student7@demo.eduskill.local", mobile: "9840000007", gender: "MALE", dob: "2000-06-30", guardianName: "Kailash Meena", guardianRelation: "Father", state: "RJ", district: "Jaipur", block: "Sanganer", villageTown: "Sanganer", address: "Ward 12, Sanganer", pincode: "302029", qualification: "Class 10", institution: "Govt Sr Sec School Sanganer", passingYear: 2017, familyIncome: "Below ₹1.5 lakh", occupation: "Farm worker", areaType: "RURAL", scholarshipRequired: true, center: 6, course: "SOL-201", status: "WAITLISTED" },
  { name: "Birsa Oraon", email: "student8@demo.eduskill.local", mobile: "9840000008", gender: "MALE", dob: "2003-03-11", guardianName: "Sukhram Oraon", guardianRelation: "Father", state: "JH", district: "Ranchi", block: "Kanke", villageTown: "Kanke", address: "Village Hochar, Kanke", pincode: "834006", qualification: "Class 12", institution: "Kanke Inter College", passingYear: 2021, familyIncome: "Below ₹1.5 lakh", occupation: "Student", areaType: "RURAL", scholarshipRequired: true, center: 7, course: "DLF-101", status: "ADMISSION_CONFIRMED" },
  { name: "Pooja Yadav", email: "student9@demo.eduskill.local", mobile: "9840000009", gender: "FEMALE", dob: "2002-09-19", guardianName: "Suresh Yadav", guardianRelation: "Father", state: "MP", district: "Bhopal", block: "Phanda", villageTown: "MP Nagar", address: "Zone I, MP Nagar", pincode: "462011", qualification: "Graduate", institution: "Barkatullah University", passingYear: 2023, familyIncome: "₹2.5 – 5 lakh", occupation: "Job seeker", areaType: "URBAN", scholarshipRequired: false, center: 9, course: "ACC-201", status: "REJECTED" },
  { name: "Sanjay Das", email: "student10@demo.eduskill.local", mobile: "9840000010", gender: "MALE", dob: "1998-11-05", guardianName: "Nirmal Das", guardianRelation: "Father", state: "WB", district: "Kolkata", block: "Kolkata South", villageTown: "Tollygunge", address: "Prince Anwar Shah Road", pincode: "700033", qualification: "Graduate", institution: "Calcutta University", passingYear: 2020, familyIncome: "Below ₹2.5 lakh", occupation: "Job seeker", areaType: "URBAN", scholarshipRequired: true, center: 0, course: "DLF-101", status: "COMPLETED" },
];

export const DEMO_SUCCESS_STORIES = [
  { studentName: "Demo Story: Riya M.", courseCode: "BCA-102", center: 0, location: "Kolkata, West Bengal", achievement: "Placed as Office Assistant", story: "After completing the Basic Computer Applications course, Riya secured her first job at a logistics firm in Kolkata. \"The trainers believed in me before I believed in myself,\" she says. (Demo story – replace with a real student story from the admin panel.)" },
  { studentName: "Demo Story: Sunil K.", courseCode: "MRT-201", center: 1, location: "Patna, Bihar", achievement: "Started a mobile repair shop", story: "Sunil used the practical lab hours at the Patna center to master smartphone repair. Six months later he opened his own shop that now employs two more EduSkill graduates. (Demo story – replace with a real student story from the admin panel.)" },
  { studentName: "Demo Story: Farida B.", courseCode: "TGM-101", center: 3, location: "Lucknow, Uttar Pradesh", achievement: "Home-based tailoring business", story: "Farida joined the women-only tailoring batch in Lucknow with a full scholarship. Today she earns from home and trains her neighbours. (Demo story – replace with a real student story from the admin panel.)" },
] as const;

/**
 * Applications to open a Normal Education Centre (Project EduSkill Shiksha Mission),
 * spread across the seven-step process so the admin queue and the public tracker both
 * have something real to show. `stepsDone` replays the status history up to `status`.
 */
export const DEMO_CENTRE_APPLICATIONS = [
  {
    applicantName: "Ramesh Kumar Verma",
    mobile: "9876501234",
    email: "ramesh.centre@demo.eduskill.local",
    dob: "1986-02-11",
    gender: "MALE",
    qualification: "B.A., D.El.Ed",
    occupation: "Private tutor",
    teachingExperienceYears: 8,
    state: "BR",
    district: "Patna",
    block: "Patna Sadar",
    villageTown: "Rampur",
    address: "Near the panchayat bhawan, Rampur",
    pincode: "800001",
    proposedName: "Saraswati Shiksha Kendra, Rampur",
    spaceType: "OWN",
    roomCount: 2,
    areaSqft: 650,
    seatingCapacity: 45,
    hasElectricity: true,
    hasToilet: true,
    hasDrinkingWater: true,
    hasFurniture: false,
    expectedStudents: 40,
    classes: ["CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4"],
    motivation: "Children here travel more than four kilometres for extra help with reading and mathematics. I already teach a few of them at home and want to run a proper centre.",
    status: "SUBMITTED",
    submittedDaysAgo: 3,
  },
  {
    applicantName: "Sunita Devi",
    mobile: "9812345670",
    email: "sunita.centre@demo.eduskill.local",
    dob: "1991-08-24",
    gender: "FEMALE",
    qualification: "B.Ed",
    occupation: "Anganwadi worker",
    teachingExperienceYears: 5,
    state: "BR",
    district: "Patna",
    block: "Barh",
    villageTown: "Bakhtiyarpur",
    address: "Ward 4, near the primary health centre, Bakhtiyarpur",
    pincode: "803212",
    proposedName: "Gyan Jyoti Shiksha Kendra",
    spaceType: "COMMUNITY",
    roomCount: 1,
    areaSqft: 400,
    seatingCapacity: 30,
    hasElectricity: true,
    hasToilet: false,
    hasDrinkingWater: true,
    hasFurniture: true,
    expectedStudents: 28,
    classes: ["CLASS_1", "CLASS_2"],
    motivation: "The panchayat has offered us a room free of cost. I want to start with Class 1 and 2 and add the higher classes once the centre settles.",
    status: "CENTRE_VERIFICATION",
    verificationInDays: 6,
    submittedDaysAgo: 18,
  },
  {
    applicantName: "Manoj Patil",
    mobile: "9820011223",
    email: "manoj.centre@demo.eduskill.local",
    dob: "1983-12-05",
    gender: "MALE",
    qualification: "M.A. Marathi, B.Ed",
    occupation: "Retired school teacher",
    teachingExperienceYears: 22,
    state: "MH",
    district: "Pune",
    block: "Khed",
    villageTown: "Rajgurunagar",
    address: "Shivaji Chowk, Rajgurunagar",
    pincode: "410505",
    proposedName: "Vidya Deep Shiksha Kendra",
    spaceType: "RENTED",
    roomCount: 3,
    areaSqft: 900,
    seatingCapacity: 60,
    hasElectricity: true,
    hasToilet: true,
    hasDrinkingWater: true,
    hasFurniture: true,
    expectedStudents: 55,
    classes: ["CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4"],
    motivation: "After thirty years in a zilla parishad school I want to keep teaching. I have the space and two former colleagues willing to join me.",
    status: "ORIENTATION",
    verificationInDays: -9,
    orientationInDays: 4,
    agreementReference: "ESK/AGR/2026/0007",
    submittedDaysAgo: 42,
  },
  {
    applicantName: "Farhana Begum",
    mobile: "9830044556",
    email: "farhana.centre@demo.eduskill.local",
    dob: "1994-05-19",
    gender: "FEMALE",
    qualification: "B.Sc",
    occupation: "Homemaker",
    teachingExperienceYears: 1,
    state: "WB",
    district: "South 24 Parganas",
    block: "Baruipur",
    villageTown: "Kalyanpur",
    address: "Station Road, Kalyanpur",
    pincode: "700144",
    proposedName: "Kalyanpur Shiksha Kendra",
    spaceType: "OWN",
    roomCount: 1,
    areaSqft: 220,
    seatingCapacity: 12,
    hasElectricity: true,
    hasToilet: false,
    hasDrinkingWater: false,
    hasFurniture: false,
    expectedStudents: 20,
    classes: ["CLASS_1"],
    motivation: "I want to teach the younger children of our lane who cannot afford private tuition and often miss school.",
    status: "DOCUMENTS_REQUIRED",
    reviewNotes: "Please upload a clearer address proof, and a photograph of the room with the seating arranged.",
    submittedDaysAgo: 7,
  },
] as const;
