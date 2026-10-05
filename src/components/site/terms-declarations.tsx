import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The declarations that close each Terms & Conditions document: filled in from the application on
 * a form's review step and in Admin, or left blank with write-in lines (and the Foundation's
 * countersignature / witness blocks) on the printable public terms pages.
 *
 * No hooks, so server and client components can both render them.
 */

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
      <div className="mt-2 space-y-2 text-body leading-relaxed text-ink">
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
          I, <Blank value={props.blank ? null : values.name} />, Centre In-charge, Eduskill India Foundation Learning Centre, have read and understood all the above Terms &amp; Conditions
          and agree to follow them while running the Centre.
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
  return (
    <DeclarationCard
      {...props}
      heading="Volunteer Declaration"
      statement={
        <>
          <p>
            I declare that the information I have given is correct. I will follow the rules, Code of Conduct, Child Safety Guidelines and Training Requirements of the Eduskill India
            Foundation Volunteer Teacher Program.
          </p>
          <p>I also understand that this is a Volunteer/Community Service Program and that it carries no Salary or Permanent Employment Guarantee.</p>
          <p>I am aware that the Volunteer Teacher Training is FREE OF COST and that no fee is being charged to me for Training/Registration.</p>
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
  const post = !props.blank && values.designation ? values.designation : "District In-Charge";
  return (
    <DeclarationCard
      {...props}
      heading={`Declaration by ${post}`}
      statement={
        <>
          <p>
            I, <Blank value={props.blank ? null : values.name} />, declare that I have read and understood the Terms &amp; Conditions relating to the post of {post} of Eduskill India
            Foundation.
          </p>
          <p>I will use the Foundation&rsquo;s name, logo, documents, student data and other resources only for authorized purposes.</p>
          <p>I will make every effort to maintain the Foundation&rsquo;s reputation, confidentiality, transparency and professional standards.</p>
          <p>I will not make any financial, legal or official commitment without authorization.</p>
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
