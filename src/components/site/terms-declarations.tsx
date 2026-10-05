import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The declarations that close each Terms & Conditions document: filled in from the application on
 * a form's review step and in Admin, or left blank with write-in lines (and the Foundation's
 * countersignature / witness blocks) on the printable public terms pages.
 *
 * No hooks, so server and client components can both render them.
 */

type Gender = string | null | undefined;

/** The verb form that matches the applicant's gender — both, as the paper form prints them, when it is not known. */
function g(gender: Gender, masculine: string, feminine: string): string {
  if (gender === "MALE") return masculine;
  if (gender === "FEMALE") return feminine;
  return `${masculine}/${feminine}`;
}

function Blank({ value }: { value?: string | null }) {
  const text = value?.trim();
  if (text) return <span className="font-semibold text-navy">{text}</span>;
  return (
    <span className="relative inline-block w-48 max-w-full border-b border-dashed border-muted align-baseline">
      &nbsp;<span className="sr-only">blank</span>
    </span>
  );
}

interface Row {
  label: string;
  /** `undefined` = not collected by this form: the row is left out unless the declaration is blank. */
  value?: string | null;
  /** Shown only on the blank, printable version (appointment numbers and the like). */
  printOnly?: boolean;
}

interface DeclarationProps {
  /** Blank, printable version for the public terms page. */
  blank?: boolean;
  gender?: Gender;
  /** What stands in for the signature line, e.g. "Accepted online on …". Blank when omitted. */
  signature?: React.ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}

function DeclarationCard({
  heading,
  statement,
  rows,
  signatureLabel,
  extraSections = [],
  blank,
  signature,
  headingLevel = 3,
  className,
}: DeclarationProps & {
  heading: string;
  statement: React.ReactNode;
  rows: Row[];
  signatureLabel: string;
  /** Countersignature and witness blocks — printed blank, never filled online. */
  extraSections?: { heading: string; rows: string[] }[];
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const shown = rows.filter((r) => (blank ? true : !r.printOnly && r.value !== undefined));
  return (
    <section className={cn("rounded-card border border-navy/15 bg-lavender/40 p-4 sm:p-5", className)} aria-label={heading}>
      <Heading className="text-overline text-navy">{heading}</Heading>
      <div lang="hi" className="mt-2 space-y-2 text-body leading-relaxed text-ink">
        {statement}
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {shown.map((r) => (
          <div key={r.label} className="min-w-0">
            <dt className="text-overline text-muted">{r.label}</dt>
            <dd className="mt-0.5 text-body break-words text-ink">
              <Blank value={blank ? null : r.value} />
            </dd>
          </div>
        ))}
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-overline text-muted">{signatureLabel}</dt>
          <dd className="mt-0.5 text-body break-words text-ink">{!blank && signature ? signature : <Blank />}</dd>
        </div>
      </dl>
      {blank &&
        extraSections.map((section) => (
          <div key={section.heading} className="mt-5 border-t border-navy/10 pt-4">
            <p className="text-overline text-navy">{section.heading}</p>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {section.rows.map((label) => (
                <div key={label} className="min-w-0">
                  <dt className="text-overline text-muted">{label}</dt>
                  <dd className="mt-0.5 text-body">
                    <Blank />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
    </section>
  );
}

/* ───────────────────────── Centre In-charge (Open a Centre) ───────────────────────── */

export interface CentreDeclarationValues {
  name?: string | null;
  centreName?: string | null;
  address?: string | null;
  mobile?: string | null;
  date?: string | null;
  place?: string | null;
}

export function CentreDeclaration({ values = {}, ...props }: DeclarationProps & { values?: CentreDeclarationValues }) {
  return (
    <DeclarationCard
      {...props}
      heading="Centre In-charge Declaration"
      statement={
        <p>
          मैं, <Blank value={props.blank ? null : values.name} />, Centre In-charge, Eduskill India Foundation Learning Centre, उपरोक्त सभी Terms &amp; Conditions को पढ़कर समझ{" "}
          {g(props.gender, "चुका", "चुकी")} हूँ और Centre के संचालन के दौरान इनका पालन करने के लिए सहमत हूँ।
        </p>
      }
      rows={[
        { label: "Centre Name", value: values.centreName ?? null },
        { label: "Centre Address", value: values.address ?? null },
        { label: "Centre In-charge", value: values.name ?? null },
        { label: "Mobile No.", value: values.mobile ?? null },
        { label: "Date", value: values.date ?? null },
        { label: "Place", value: values.place ?? null },
      ]}
      signatureLabel="Centre In-charge Signature"
    />
  );
}

/* ───────────────────────── Volunteer Teacher (trainer & teacher forms) ───────────────────────── */

export interface VolunteerTeacherDeclarationValues {
  name?: string | null;
  guardianName?: string | null;
  mobile?: string | null;
  address?: string | null;
  centerName?: string | null;
  centerCode?: string | null;
  date?: string | null;
}

export function VolunteerTeacherDeclaration({ values = {}, ...props }: DeclarationProps & { values?: VolunteerTeacherDeclarationValues }) {
  const gender = props.gender;
  return (
    <DeclarationCard
      {...props}
      heading="Volunteer Declaration"
      statement={
        <>
          <p>
            मैं घोषणा {g(gender, "करता", "करती")} हूँ कि मेरे द्वारा दी गई जानकारी सही है। मैं Eduskill India Foundation के Volunteer Teacher Program के नियमों, Code of Conduct, Child Safety
            Guidelines एवं Training Requirements का पालन {g(gender, "करूंगा", "करूंगी")}।
          </p>
          <p>मैं यह भी {g(gender, "समझता", "समझती")} हूँ कि यह Volunteer/Community Service Program है और इसमें कोई Salary या Permanent Employment Guarantee नहीं है।</p>
          <p>मुझे यह जानकारी है कि Volunteer Teacher Training FREE OF COST है और Training/Registration के लिए मुझसे कोई शुल्क नहीं लिया जा रहा है।</p>
        </>
      }
      rows={[
        { label: "Volunteer Teacher Name", value: values.name },
        { label: "Father/Mother/Guardian Name", value: values.guardianName },
        { label: "Mobile No.", value: values.mobile },
        { label: "Address", value: values.address },
        { label: "Center Name", value: values.centerName },
        { label: "Center Code (if applicable)", value: values.centerCode },
        { label: "Date", value: values.date },
      ]}
      signatureLabel="Volunteer Signature"
      extraSections={[{ heading: "For Eduskill India Foundation", rows: ["Authorized Signatory", "Name", "Designation", "Signature", "Official Seal", "Date", "Place"] }]}
    />
  );
}

/* ───────────────────────── Block / District In-Charge (trainer wizard, Level step) ───────────────────────── */

export interface InChargeDeclarationValues {
  name?: string | null;
  /** "Block In-Charge" or "District In-Charge", from the chosen volunteer level. */
  designation?: string | null;
  district?: string | null;
  state?: string | null;
  mobile?: string | null;
  email?: string | null;
  date?: string | null;
  place?: string | null;
}

/**
 * The document is written for the District In-Charge and, as the Foundation decided, also binds Block
 * In-Charges — so a filled declaration names the applicant's own post. The blank, printable version
 * keeps the document's wording.
 */
export function InChargeDeclaration({ values = {}, ...props }: DeclarationProps & { values?: InChargeDeclarationValues }) {
  const gender = props.gender;
  const post = !props.blank && values.designation ? values.designation : "District In-Charge";
  return (
    <DeclarationCard
      {...props}
      heading={`Declaration by ${post}`}
      statement={
        <>
          <p>
            मैं, <Blank value={props.blank ? null : values.name} />, यह घोषणा {g(gender, "करता", "करती")} हूँ कि मैंने Eduskill India Foundation के {post} पद से संबंधित Terms &amp;
            Conditions को पढ़ लिया है और उन्हें {g(gender, "समझता", "समझती")} हूँ।
          </p>
          <p>मैं Foundation के नाम, logo, documents, student data और अन्य resources का उपयोग केवल authorized purpose के लिए {g(gender, "करूंगा", "करूंगी")}।</p>
          <p>मैं Foundation की reputation, confidentiality, transparency और professional standards को बनाए रखने का पूर्ण प्रयास {g(gender, "करूंगा", "करूंगी")}।</p>
          <p>मैं बिना authorization के कोई financial, legal या official commitment नहीं {g(gender, "करूंगा", "करूंगी")}।</p>
        </>
      }
      rows={[
        { label: `Name of ${post}`, value: values.name },
        { label: "Designation", value: values.designation },
        { label: "District", value: values.district },
        { label: "State", value: values.state },
        { label: "Appointment Date", printOnly: true },
        { label: "Appointment/Authorization No.", printOnly: true },
        { label: "Mobile No.", value: values.mobile },
        { label: "Email", value: values.email },
        { label: "Date", value: values.date },
        { label: "Place", value: values.place },
      ]}
      signatureLabel="Signature"
      extraSections={[
        { heading: "For Eduskill India Foundation", rows: ["Authorized Person Name", "Designation", "Signature", "Official Seal", "Date"] },
        { heading: "Witness – 1", rows: ["Name", "Mobile", "Signature"] },
        { heading: "Witness – 2", rows: ["Name", "Mobile", "Signature"] },
      ]}
    />
  );
}
