-- AlterTable
ALTER TABLE "centre_applications" ADD COLUMN     "terms_accepted_at" TIMESTAMP(3),
ADD COLUMN     "terms_version_id" UUID;

-- AlterTable
ALTER TABLE "trainer_applications" ADD COLUMN     "in_charge_terms_accepted_at" TIMESTAMP(3),
ADD COLUMN     "in_charge_terms_version_id" UUID,
ADD COLUMN     "volunteer_terms_accepted_at" TIMESTAMP(3),
ADD COLUMN     "volunteer_terms_version_id" UUID;

-- CreateTable
CREATE TABLE "terms_versions" (
    "id" UUID NOT NULL,
    "document" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terms_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "terms_versions_document_version_key" ON "terms_versions"("document", "version");

-- AddForeignKey
ALTER TABLE "trainer_applications" ADD CONSTRAINT "trainer_applications_volunteer_terms_version_id_fkey" FOREIGN KEY ("volunteer_terms_version_id") REFERENCES "terms_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_applications" ADD CONSTRAINT "trainer_applications_in_charge_terms_version_id_fkey" FOREIGN KEY ("in_charge_terms_version_id") REFERENCES "terms_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centre_applications" ADD CONSTRAINT "centre_applications_terms_version_id_fkey" FOREIGN KEY ("terms_version_id") REFERENCES "terms_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the editable Terms & Conditions pages (Admin → CMS → Pages) that applicants accept before they
-- apply. Deploys run migrate deploy, not the seed, so production gets the pages here. An existing page
-- is left alone.
INSERT INTO "cms_pages" ("id", "slug", "title", "content", "excerpt", "status", "created_at", "updated_at")
VALUES (gen_random_uuid(), $terms$centre-in-charge-terms$terms$, $terms$Centre In-charge – Terms & Conditions$terms$, $terms$**Class 1–4 Learning & Academic Support Centre**

### 1. Appointment & Responsibility
Centre In-charge को Centre की daily administration, academic coordination, student discipline, attendance, records और parent communication की जिम्मेदारी दी जाएगी।

### 2. Centre Purpose
Centre का संचालन मुख्य रूप से Class 1 से Class 4 के बच्चों के academic support, foundational learning और educational development के लिए किया जाएगा।

### 3. Educational Activities
Centre पर निम्न activities कराई जा सकती हैं:

- Hindi & English Reading/Writing
- Basic Mathematics
- General Awareness
- Homework Support
- Worksheets & Practice
- Activity-Based Learning
- Drawing & Creative Activities
- Spoken English Basics
- Basic Computer/Digital Awareness
- Communication & Confidence Building
- Periodic Tests & Assessments

### 4. Centre Timing
Centre का timing Foundation/Management द्वारा निर्धारित किया जाएगा। बिना अनुमति के timing में स्थायी बदलाव नहीं किया जाएगा।

### 5. Student Admission
Admission Centre की निर्धारित capacity और Foundation के guidelines के अनुसार किया जाएगा। Student की आवश्यक जानकारी एवं parent/guardian details सही रूप से दर्ज की जाएंगी।

### 6. Attendance
Centre In-charge को daily student attendance maintain करनी होगी। लगातार अनुपस्थित रहने वाले students के parents/guardians से आवश्यकतानुसार संपर्क किया जाएगा।

### 7. Student Records
Admission, attendance, assessment, fee/payment (यदि लागू हो), parent communication और अन्य आवश्यक records व्यवस्थित एवं सुरक्षित रखने होंगे।

### 8. Teacher & Volunteer Management
Centre In-charge teachers/volunteers के attendance, timetable और assigned academic responsibilities का coordination करेगा।

### 9. Child Safety
बच्चों की safety सर्वोच्च प्राथमिकता होगी। किसी भी प्रकार का:

- Physical punishment
- Mental harassment
- Abuse
- Bullying
- Discrimination
- Inappropriate behaviour

स्वीकार्य नहीं होगा।

### 10. Discipline
Centre में students, teachers, volunteers और visitors के लिए respectful एवं disciplined behaviour अनिवार्य होगा।

### 11. Parent Communication
Centre In-charge parents/guardians को बच्चों की attendance, learning progress और आवश्यक academic information उपलब्ध कराने में सहयोग करेगा।

### 12. Learning Assessment
बच्चों की learning progress को worksheets, activities, tests या अन्य appropriate assessment methods के माध्यम से समय-समय पर check किया जा सकता है।

### 13. Premises
Centre premises को साफ-सुथरा, सुरक्षित और बच्चों के लिए उपयुक्त रखना Centre In-charge की जिम्मेदारी होगी।

### 14. Equipment & Materials
Books, registers, worksheets, computer/equipment और अन्य Centre property का उचित उपयोग एवं सुरक्षा सुनिश्चित करनी होगी।

### 15. Financial Matters
यदि Centre पर कोई fee/collection लागू है, तो सभी financial transactions Foundation द्वारा निर्धारित procedure के अनुसार किए जाएंगे। बिना authorization के कोई राशि collect नहीं की जाएगी।

### 16. Unauthorized Collection
Centre In-charge Foundation की written permission के बिना donation, admission fee, certificate fee या किसी अन्य नाम से राशि collect नहीं करेगा।

### 17. Official Communication
Foundation की अनुमति के बिना Centre In-charge Foundation की ओर से कोई legal, financial या official commitment नहीं करेगा।

### 18. Branding & Logo
Eduskill India Foundation का नाम, logo, certificate, letterhead या अन्य official material केवल authorized purpose के लिए इस्तेमाल किया जाएगा।

### 19. Government Recognition
Centre बिना संबंधित competent authority की written approval के स्वयं को Government Recognized School, Board Affiliated School या Government Centre के रूप में प्रस्तुत नहीं करेगा।

### 20. NOC & Permissions
जहाँ आवश्यक हो, premises के owner/authority की NOC और अन्य applicable permissions प्राप्त एवं सुरक्षित रखी जाएंगी।

### 21. Confidentiality
Students, parents, staff और Foundation से संबंधित confidential information को बिना authorization के किसी third party के साथ share नहीं किया जाएगा।

### 22. Photography & Video
Students की photographs/videos केवल applicable consent और Foundation policy के अनुसार उपयोग की जाएंगी।

### 23. Social Media
Foundation की written/official permission के बिना Centre या students से संबंधित misleading, confidential या unauthorized content social media पर प्रकाशित नहीं किया जाएगा।

### 24. Emergency Procedure
Medical या अन्य emergency की स्थिति में Centre In-charge parent/guardian को तुरंत inform करेगा और आवश्यकता के अनुसार appropriate assistance की व्यवस्था करेगा।

### 25. Cleanliness & Hygiene
Centre में cleanliness, drinking water, toilet access, ventilation और basic hygiene arrangements बनाए रखने का प्रयास किया जाएगा।

### 26. Inspection
Foundation के authorized representatives Centre का inspection, records verification और academic review कर सकते हैं।

### 27. Reporting
Centre In-charge आवश्यकता के अनुसार student strength, attendance, activities, assessment, requirements और अन्य operational information Foundation को report करेगा।

### 28. Misconduct
Fraud, financial irregularity, misuse of Foundation property, child-safety violation, false information या serious misconduct पाए जाने पर appropriate action लिया जा सकता है।

### 29. Conflict of Interest
Centre In-charge Foundation के Centre का उपयोग अपने निजी business/unauthorized commercial activity के लिए नहीं करेगा।

### 30. Resignation / Replacement
Centre In-charge को जिम्मेदारी छोड़ने की आवश्यकता होने पर Foundation को उचित notice देना होगा और सभी records/materials properly handover करने होंगे।

### 31. Termination
Terms & Conditions का गंभीर उल्लंघन होने पर Foundation Centre In-charge की authorization/responsibility को suspend या terminate कर सकता है, subject to applicable procedure.

### 32. Amendment
Eduskill India Foundation आवश्यकता के अनुसार इन Terms & Conditions में उचित बदलाव कर सकता है।

### 33. Compliance
Centre In-charge applicable local laws, child-safety requirements, Foundation policies और Centre guidelines का पालन करेगा।

### 34. Declaration
Centre In-charge यह स्वीकार करता/करती है कि Centre की जिम्मेदारी ईमानदारी, transparency, discipline और बच्चों के हित को प्राथमिकता देते हुए निभाई जाएगी।$terms$, $terms$Class 1–4 Learning & Academic Support Centre. Read and accept these terms before you apply to open a centre.$terms$, 'PUBLISHED', now(), now())
ON CONFLICT ("slug") DO NOTHING;
INSERT INTO "cms_pages" ("id", "slug", "title", "content", "excerpt", "status", "created_at", "updated_at")
VALUES (gen_random_uuid(), $terms$volunteer-teacher-terms$terms$, $terms$Eduskill India Foundation – Volunteer Teacher Terms & Conditions$terms$, $terms$**EDUSKILL INDIA FOUNDATION — VOLUNTEER TEACHER PROGRAM — TERMS & CONDITIONS**

**“Free Training • Community Service • Quality Education”**

### 1. PROGRAM INTRODUCTION
Eduskill India Foundation द्वारा Volunteer Teacher Program का उद्देश्य विद्यार्थियों को गुणवत्तापूर्ण शिक्षा, अतिरिक्त कक्षाएँ, Computer/Digital Skills, Basic English, General Awareness एवं अन्य शैक्षणिक सहयोग उपलब्ध कराना है।

यह कार्यक्रम सामाजिक एवं शैक्षणिक सेवा की भावना से संचालित किया जाता है।

### 2. FREE TRAINING & NO FEE POLICY
Volunteer Teacher के लिए संस्था द्वारा निर्धारित Training पूर्णतः FREE OF COST है।

- Volunteer Teacher से Training Fee नहीं ली जाएगी।
- Volunteer Teacher से Registration Fee नहीं ली जाएगी।
- Volunteer Teacher से Admission Fee नहीं ली जाएगी।
- संस्था की ओर से Training के नाम पर कोई Hidden Charge नहीं लिया जाएगा।
- किसी व्यक्ति द्वारा संस्था के नाम पर अनधिकृत शुल्क मांगना मान्य नहीं होगा।

किसी विशेष सुविधा/सामग्री के लिए यदि कोई अलग खर्च लागू हो, तो उसकी जानकारी पहले से दी जाएगी।

### 3. ELIGIBILITY
Volunteer Teacher के लिए निम्न योग्यताएँ वांछनीय हो सकती हैं:

- कम से कम 12वीं पास / Graduate को प्राथमिकता।
- विद्यार्थियों को पढ़ाने में रुचि।
- Basic communication skills।
- बच्चों के साथ सम्मानजनक व्यवहार।
- समय की उपलब्धता।
- Computer/Digital knowledge होने पर प्राथमिकता।

स्थानीय क्षेत्र एवं विद्यालय की आवश्यकताओं के अनुसार अन्य योग्यताओं पर भी विचार किया जा सकता है।

### 4. SELECTION PROCESS
Volunteer Teacher का चयन संस्था द्वारा आवश्यकता, योग्यता, उपलब्धता एवं Interview/Interaction के आधार पर किया जा सकता है।

चयन होने के बाद Volunteer Teacher को संस्था की ओर से Orientation/Training दी जा सकती है।

Selection संस्था की आवश्यकता एवं उपलब्ध पदों/केंद्रों के अनुसार होगा।

### 5. TRAINING & ORIENTATION
Volunteer Teacher को निर्धारित Training में भाग लेना आवश्यक होगा।

Training में निम्न विषय शामिल हो सकते हैं:

- Teaching Methodology
- Classroom Management
- Communication Skills
- Child-Friendly Teaching
- Basic Computer Skills
- Digital Learning
- Student Motivation
- Basic English/Language Skills
- Activity-Based Learning
- Attendance & Student Record Management
- Discipline & Child Safety
- Academic Support Methods

Volunteer Teacher को संस्था द्वारा समय-समय पर दिए गए Training/Orientation में भाग लेना होगा।

### 6. TRAINING ATTENDANCE
Volunteer Teacher को निर्धारित समय पर Training में उपस्थित होना होगा।

बिना उचित कारण Training से लगातार अनुपस्थित रहने पर संस्था Volunteer status की समीक्षा कर सकती है।

Training completion के लिए न्यूनतम attendance criteria संस्था द्वारा निर्धारित किया जा सकता है।

Emergency/Medical/Personal कारण होने पर संबंधित Coordinator को सूचना देना अपेक्षित होगा।

### 7. VOLUNTEER SERVICE
Volunteer Teacher का मुख्य उद्देश्य विद्यार्थियों एवं समुदाय को शैक्षणिक सहयोग देना होगा।

Volunteer Teacher निम्न कार्य कर सकता/सकती है:

- विद्यार्थियों को पढ़ाना।
- अतिरिक्त कक्षाएँ लेना।
- Basic Computer/Digital Skills सिखाना।
- Homework/Practice में सहायता करना।
- विद्यार्थियों को motivate करना।
- कमजोर विद्यार्थियों को अतिरिक्त academic support देना।
- Educational activities में सहयोग करना।
- संस्था द्वारा स्वीकृत awareness/learning activities में भाग लेना।

### 8. DUTIES & RESPONSIBILITIES
Volunteer Teacher को:

- समय का पालन करना होगा।
- विद्यार्थियों के साथ सम्मानजनक व्यवहार करना होगा।
- किसी भी विद्यार्थी के साथ भेदभाव नहीं करना होगा।
- विद्यार्थियों की सुरक्षा एवं dignity का ध्यान रखना होगा।
- बिना अनुमति विद्यार्थी की फोटो/video/publication नहीं करनी चाहिए।
- संस्था एवं विद्यालय की property का उचित उपयोग करना होगा।
- Academic records को सही रखना होगा।
- संस्था/विद्यालय के नियमों का पालन करना होगा।

### 9. CHILD SAFETY & PROTECTION
Volunteer Teacher को विद्यार्थियों के साथ किसी भी प्रकार का:

- दुर्व्यवहार,
- शारीरिक दंड,
- मानसिक उत्पीड़न,
- अपमानजनक व्यवहार,
- भेदभाव,
- अनुचित communication,
- अनुचित physical contact

नहीं करना होगा।

किसी गंभीर शिकायत या child-safety concern की स्थिति में संस्था आवश्यक कार्रवाई कर सकती है।

### 10. CODE OF CONDUCT
Volunteer Teacher को:

- नशे की स्थिति में Centre/School में उपस्थित नहीं होना चाहिए।
- किसी विद्यार्थी या अभिभावक से अनुचित व्यवहार नहीं करना चाहिए।
- संस्था के नाम का व्यक्तिगत/व्यावसायिक गलत उपयोग नहीं करना चाहिए।
- संस्था की अनुमति के बिना official letterhead, logo, ID card या certificate जारी नहीं करना चाहिए।
- संस्था की गोपनीय जानकारी को अनधिकृत व्यक्ति से साझा नहीं करना चाहिए।

### 11. NO SALARY / EMPLOYMENT GUARANTEE
Volunteer Teacher Program एक Volunteer/Community Service Program है।

इस Program में शामिल होने से:

- Permanent Job की गारंटी नहीं है।
- Government Job की गारंटी नहीं है।
- Fixed Salary की गारंटी नहीं है।
- भविष्य में रोजगार मिलने की कोई automatic guarantee नहीं है।

यदि किसी अलग project में paid position उपलब्ध होती है, तो उसकी शर्तें अलग से लिखित रूप में बताई जाएंगी।

### 12. TRAVEL & PERSONAL EXPENSES
Volunteer Teacher के:

- Travel,
- Food,
- Personal expenses,
- Mobile/Internet,
- अन्य व्यक्तिगत खर्च

सामान्यतः Volunteer की स्वयं की जिम्मेदारी होंगे, जब तक संस्था द्वारा लिखित रूप से अलग व्यवस्था न की गई हो।

### 13. CENTER / SCHOOL RULES
यदि Volunteer Teacher किसी Center या School पर सेवा दे रहा/रही है, तो उसे उस Center/School के निर्धारित नियमों का पालन करना होगा।

Center In-Charge/Coordinator संस्था के निर्देशों के अनुसार Volunteer Teacher की attendance, activities एवं basic performance report रख सकता है।

### 14. ATTENDANCE & REPORTING
Volunteer Teacher को:

- Attendance maintain करनी होगी।
- निर्धारित समय पर class शुरू एवं समाप्त करनी होगी।
- आवश्यक होने पर daily/weekly report देना होगा।
- Student attendance एवं academic activities की जानकारी Center In-Charge को देनी होगी।

### 15. ID CARD / CERTIFICATE
संस्था आवश्यकता एवं अपनी नीति के अनुसार Volunteer Teacher को:

- Volunteer ID Card,
- Training Certificate,
- Participation Certificate,
- Volunteer Service Certificate

जारी कर सकती है।

Certificate केवल निर्धारित Training/Service requirements पूरी होने पर जारी किया जाएगा।

### 16. CERTIFICATE MISUSE
Volunteer Teacher संस्था द्वारा जारी Certificate, ID Card या अन्य document में किसी प्रकार का बदलाव, editing या गलत उपयोग नहीं करेगा/करेगी।

ऐसा पाए जाने पर Certificate/Volunteer status वापस लिया जा सकता है।

### 17. CONFIDENTIALITY
Volunteer Teacher को विद्यार्थियों, अभिभावकों, विद्यालय एवं संस्था से संबंधित confidential information को बिना अनुमति सार्वजनिक या किसी third party के साथ साझा नहीं करना चाहिए।

### 18. SOCIAL MEDIA POLICY
Volunteer Teacher संस्था के नाम, logo, project, school, student या official activity से संबंधित सामग्री को सोशल मीडिया पर प्रकाशित करने से पहले आवश्यक अनुमति प्राप्त करेगा/करेगी।

संस्था की अनुमति के बिना कोई misleading advertisement या official announcement नहीं किया जा सकता।

### 19. FINANCIAL POLICY
Volunteer Teacher को विद्यार्थियों या अभिभावकों से संस्था के नाम पर कोई पैसा collect नहीं करना चाहिए, जब तक संस्था द्वारा लिखित authorization न दिया गया हो।

यदि कोई व्यक्ति संस्था के नाम पर unauthorized payment collect करता पाया जाता है, तो संस्था उसके विरुद्ध उचित कार्रवाई कर सकती है।

### 20. NO UNAUTHORIZED REPRESENTATION
Volunteer Teacher स्वयं को संस्था का:

- Director,
- Manager,
- Authorized Officer,
- Legal Representative,
- Government Representative

बिना लिखित authorization के नहीं बताएगा/बताएगी।

### 21. DISCIPLINARY ACTION
निम्न परिस्थितियों में संस्था Volunteer Teacher का status suspend या terminate कर सकती है:

- Misconduct
- लगातार अनुपस्थिति
- विद्यार्थी से दुर्व्यवहार
- संस्था के नाम का गलत उपयोग
- Fraud या financial misconduct
- गलत जानकारी/दस्तावेज
- Confidential information leak
- School/Centre rules का गंभीर उल्लंघन
- Child safety policy का उल्लंघन

### 22. VOLUNTARY WITHDRAWAL
Volunteer Teacher अपनी इच्छा से Program छोड़ सकता/सकती है।

यथासंभव संस्था को पहले से सूचना देना अपेक्षित होगा ताकि Center/Class की व्यवस्था प्रभावित न हो।

### 23. TERMINATION BY ORGANIZATION
Eduskill India Foundation आवश्यकता, project closure, performance, conduct, attendance या अन्य उचित कारणों के आधार पर Volunteer engagement को समाप्त कर सकती है।

### 24. NO GUARANTEE OF CONTINUOUS ASSIGNMENT
Volunteer Teacher को किसी particular School, Center या Project में लगातार assignment मिलने की guarantee नहीं है।

Assignment संस्था की आवश्यकता, project availability एवं local requirements पर निर्भर करेगा।

### 25. DOCUMENT VERIFICATION
Volunteer Teacher द्वारा दिए गए documents/details सही एवं सत्य होने चाहिए।

गलत, forged या misleading documents पाए जाने पर candidature/volunteer engagement समाप्त किया जा सकता है।

### 26. CENTER IN-CHARGE RESPONSIBILITY
Center In-Charge/Coordinator को:

- Volunteer Teacher की attendance maintain करनी होगी।
- Training participation का record रखना होगा।
- Student activities की basic monitoring करनी होगी।
- संस्था को आवश्यक report देनी होगी।
- संस्था के नाम पर unauthorized fee collection नहीं करना होगा।
- किसी भी serious complaint को संस्था के authorized team तक पहुँचाना होगा।

### 27. NO FEE TO VOLUNTEER TEACHER
**विशेष घोषणा:**

> “Eduskill India Foundation के Volunteer Teacher Training Program में चयनित Volunteer Teacher से Training, Registration या Admission के नाम पर कोई शुल्क नहीं लिया जा रहा है। यह Training Program FREE OF COST है।”

### 28. PROGRAM MODIFICATION
संस्था आवश्यकता के अनुसार Program की:

- Training schedule,
- Course content,
- Duration,
- Center allocation,
- Activities,
- Reporting system

में उचित बदलाव कर सकती है।

### 29. ACCEPTANCE OF TERMS
Volunteer Teacher द्वारा इस Program में शामिल होना यह दर्शाता है कि उसने ऊपर दिए गए Terms & Conditions को पढ़ लिया है और उनका पालन करने के लिए सहमत है।

### IMPORTANT NOTICE
This document is intended as the general Terms & Conditions for the Eduskill India Foundation Volunteer Teacher Program. Specific project, school, center, safeguarding and legal requirements may be added according to the applicable program and local requirements.$terms$, $terms$Volunteer Teacher Program: Free Training • Community Service • Quality Education. Read and accept these terms before you apply as a volunteer trainer or teacher.$terms$, 'PUBLISHED', now(), now())
ON CONFLICT ("slug") DO NOTHING;
INSERT INTO "cms_pages" ("id", "slug", "title", "content", "excerpt", "status", "created_at", "updated_at")
VALUES (gen_random_uuid(), $terms$district-in-charge-terms$terms$, $terms$District In-Charge Appointment – Terms, Roles & Conditions$terms$, $terms$**EDUSKILL INDIA FOUNDATION — District In-Charge Appointment – Terms, Roles & Conditions**

**Organization:** Eduskill India Foundation · **Designation:** District In-Charge

### 1. Appointment & Purpose
Eduskill India Foundation द्वारा District In-Charge को संबंधित जिले में Foundation के educational, skill development, training, awareness, employment-support एवं social development programs के coordination और implementation में सहायता करने के लिए नियुक्त/अधिकृत किया जा सकता है।

District In-Charge Foundation और जिले के approved centers, schools, institutions, trainers, students एवं अन्य stakeholders के बीच coordination का कार्य करेगा।

### 2. Main Objectives
District In-Charge के प्रमुख उद्देश्य:

- जिले में Foundation के programs का विस्तार करना।
- योग्य Training/Support Centers की पहचान करना।
- Students एवं beneficiaries तक programs की जानकारी पहुँचाना।
- Training एवं awareness programs को व्यवस्थित रूप से coordinate करना।
- Center activities की monitoring करना।
- Foundation को नियमित progress report देना।
- Foundation की policies, quality standards और branding guidelines का पालन सुनिश्चित करना।

### 3. Roles & Responsibilities
**A. District-Level Coordination**

District In-Charge:

- जिले में Foundation की approved activities का coordination करेगा।
- संबंधित centers एवं center in-charges से नियमित संपर्क रखेगा।
- Training schedules एवं program activities की monitoring करेगा।
- आवश्यकतानुसार district-level meetings आयोजित/coordinate करेगा।
- Foundation के authorized representatives के साथ coordination करेगा।

**B. Center Development**

District In-Charge:

- संभावित centers की पहचान कर सकता है।
- Center infrastructure और basic facilities की जानकारी collect करेगा।
- Center In-Charge के documents एवं details Foundation को verification के लिए भेजेगा।
- बिना written approval के किसी center को officially approved घोषित नहीं करेगा।

**C. Student & Training Coordination**

- Student registration/admission process में coordination।
- Training batch information maintain करना।
- Attendance और training progress की monitoring।
- Trainers के साथ coordination।
- Examination/assessment activities में सहायता।
- Certificate-related process में Foundation के निर्देशों का पालन।

### 4. School & Institutional Programs
Foundation द्वारा अनुमोदित होने पर District In-Charge निम्न प्रकार के programs के coordination में सहायता कर सकता है:

- Computer Skill Training
- Skill Development Programs
- Digital Literacy
- AI Awareness & Training
- Digital Marketing Workshop
- Spoken English
- Communication Skills
- Career Guidance
- Vocational Training
- Teacher/Volunteer Programs
- School Awareness Programs
- Employment & Placement Support
- अन्य educational/social development programs

किसी भी program को government-approved, government-certified अथवा government-sponsored बताने से पहले संबंधित लिखित authorization आवश्यक होगा।

### 5. Center Approval Rules
District In-Charge को निम्न बातों का पालन करना होगा:

- Center की final approval Foundation के authorized authority द्वारा होगी।
- Center के लिए आवश्यक documents जमा करवाए जाएंगे।
- Infrastructure एवं basic facilities की verification की जा सकती है।
- Center In-Charge से undertaking/NOC लिया जा सकता है।
- Foundation की written approval के बाद ही official branding/authorization दिया जाएगा।
- Unauthorized center को Foundation का official center नहीं बताया जाएगा।

### 6. Financial Terms
District In-Charge:

- Foundation के नाम पर unauthorized payment collect नहीं करेगा।
- किसी student/center से personal account में Foundation-related payment लेने से बचेगा।
- सभी applicable fees एवं charges Foundation द्वारा निर्धारित policy के अनुसार होंगे।
- Commission/Incentive, यदि लागू हो, तो केवल Foundation की written policy के अनुसार होगा।
- सभी financial records transparent और verifiable होने चाहिए।

**महत्वपूर्ण:** District In-Charge को अपने स्तर से कोई नया fee structure, discount, commission या financial commitment घोषित करने का अधिकार नहीं होगा।

### 7. Branding & Logo Policy
Eduskill India Foundation का:

- Name
- Logo
- Certificate
- ID Card
- Letterhead
- Official Seal
- Brochure
- Poster
- Social Media Creative

केवल Foundation की approved guidelines के अनुसार इस्तेमाल किया जाएगा।

District In-Charge Foundation के नाम पर कोई misleading advertisement प्रकाशित नहीं करेगा।

### 8. Social Media Policy
District In-Charge Foundation-related social media promotion कर सकता है, लेकिन:

- गलत information नहीं देगा।
- Fake job guarantee नहीं देगा।
- Unauthorized certificate का प्रचार नहीं करेगा।
- Foundation की अनुमति के बिना misleading government logos/official seals का उपयोग नहीं करेगा।
- विद्यार्थियों की photos/videos प्रकाशित करते समय आवश्यक consent और Foundation guidelines का पालन करेगा।

### 9. Student Protection
District In-Charge को:

- Students के साथ professional व्यवहार करना होगा।
- Student data confidential रखना होगा।
- किसी student को गलत job/training/certificate guarantee नहीं देनी होगी।
- कोई discriminatory या abusive behavior नहीं करना होगा।
- Student complaints को उचित channel के माध्यम से Foundation तक पहुँचाना होगा।

### 10. Documentation & Record Keeping
District In-Charge निम्न records maintain/coordinate करेगा:

- Center details
- Center In-Charge details
- Student registration
- Attendance
- Training batch details
- Trainer details
- Program photographs/reports
- Assessment details
- Certificate records
- Activity reports
- Financial documents, जहां applicable हों

### 11. Monthly Reporting
District In-Charge को आवश्यकता के अनुसार monthly report submit करनी होगी।

Report में शामिल हो सकता है:

1. Total Centers: ……
2. Active Centers: ……
3. Total Students: ……
4. New Admissions: ……
5. Training Batches: ……
6. Workshops Conducted: ……
7. Placement/Employment Support: ……
8. Major Activities: ……
9. Problems/Challenges: ……
10. Next Month Plan: ……

### 12. Confidentiality
District In-Charge Foundation की confidential information को किसी unauthorized person या organization के साथ share नहीं करेगा।

इसमें शामिल हो सकता है:

- Student database
- Center database
- Internal reports
- Financial information
- Official documents
- Internal policies
- Login credentials
- Business information

### 13. No Unauthorized Representation
District In-Charge अपने पद का उपयोग करके:

- कोई legal agreement sign नहीं करेगा।
- Loan/financial commitment नहीं करेगा।
- Government approval का दावा नहीं करेगा।
- Foundation की ओर से legal statement जारी नहीं करेगा।
- किसी third party को partnership/franchise guarantee नहीं देगा।

जब तक Foundation की written authorization न हो।

### 14. Code of Conduct
District In-Charge को:

- ईमानदारी और transparency बनाए रखनी होगी।
- सभी stakeholders के साथ सम्मानजनक व्यवहार करना होगा।
- किसी भी प्रकार की fraud activity से दूर रहना होगा।
- Foundation की reputation को नुकसान पहुँचाने वाली गतिविधि नहीं करनी होगी।
- किसी व्यक्ति से पद का गलत लाभ नहीं उठाना होगा।

### 15. Conflict of Interest
यदि District In-Charge Foundation के समान क्षेत्र में किसी अन्य organization के लिए काम करता है या कोई ऐसी commercial activity करता है जिससे Foundation के हित प्रभावित हो सकते हैं, तो उसे Foundation को जानकारी देनी होगी।

### 16. Appointment Period
Appointment/Authorization Period: From …… / …… / ………… To …… / …… / …………

Appointment को performance, requirement और Foundation policy के आधार पर renew किया जा सकता है।

### 17. Performance Review
District In-Charge के performance का review निम्न आधारों पर किया जा सकता है:

- Program implementation
- Center coordination
- Student support
- Reporting
- Professional conduct
- Documentation
- Target achievement
- Compliance with Foundation policies

### 18. Termination
Foundation निम्न परिस्थितियों में appointment/authorization समाप्त कर सकती है:

- Fraud या financial irregularity
- False representation
- Unauthorized collection
- Misuse of Foundation name/logo
- Confidential information leak
- Fake certificate/false promise
- Serious misconduct
- Foundation guidelines का लगातार उल्लंघन
- Reputation को गंभीर नुकसान पहुँचाना

Termination applicable agreement और कानून के अनुसार की जाएगी।

### 19. Return of Foundation Property
Appointment समाप्त होने पर District In-Charge को Foundation से संबंधित:

- ID Card
- Certificate materials
- Documents
- Official seals, यदि कोई हों
- Branding material
- Login/access credentials
- Other official property

Foundation के निर्देश के अनुसार वापस/disable करनी होगी।

### 20. No Employment Guarantee
District In-Charge की appointment को स्वतः permanent employment, salary-based employment या government employment नहीं माना जाएगा, जब तक Foundation द्वारा अलग से लिखित employment agreement जारी न किया गया हो।

### 21. No Government Authority Claim
District In-Charge स्वयं को Government Officer, Government Representative अथवा Government-authorized person के रूप में प्रस्तुत नहीं करेगा, जब तक ऐसा कोई वास्तविक और लिखित authorization उपलब्ध न हो।

### 22. Grievance & Complaint
किसी भी complaint या dispute की स्थिति में District In-Charge Foundation के designated authority को लिखित रूप में जानकारी देगा।

सभी शिकायतों का रिकॉर्ड maintain किया जाना चाहिए।

### 23. Compliance
District In-Charge को लागू कानूनों, Foundation की internal policies और program-specific guidelines का पालन करना होगा।

जहाँ किसी activity के लिए अलग government/statutory permission आवश्यक हो, वहाँ उचित permission/approval प्राप्त करना आवश्यक होगा।

**EDUSKILL INDIA FOUNDATION** — Education • Skill Development • Digital Literacy • Career Support • Social Development$terms$, $terms$Terms, roles and conditions for Block and District In-Charges of Eduskill India Foundation. Block and District level applicants read and accept them before they apply.$terms$, 'PUBLISHED', now(), now())
ON CONFLICT ("slug") DO NOTHING;
