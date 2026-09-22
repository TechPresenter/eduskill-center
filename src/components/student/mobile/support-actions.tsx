import { Clock, Mail, MapPin, MessageCircle, MessageSquarePlus, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SupportContact {
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  hours: string;
}

export interface SupportActionsProps {
  contact: SupportContact;
  /** Added to the pre-filled WhatsApp message so the team can find the student. */
  studentId?: string | null;
  /** Anchor of the ticket form on the same page. */
  enquiryHref?: string;
  className?: string;
}

const TILE = "card card-hover flex min-h-[72px] flex-col justify-center gap-1 p-3 tap-highlight-none transition-transform active:scale-[0.98] motion-reduce:transition-none";

function Tile({ href, icon, label, hint, tone = "navy", external }: { href: string; icon: React.ReactNode; label: string; hint?: string; tone?: "navy" | "green" | "orange"; external?: boolean }) {
  const wrap = tone === "green" ? "bg-success-light text-success-dark" : tone === "orange" ? "bg-orange-light text-orange" : "bg-lavender text-navy";
  return (
    <a href={href} className={TILE} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-md", wrap)}>{icon}</span>
      <span className="text-body-sm font-semibold text-ink">{label}</span>
      {hint && <span className="truncate text-caption text-muted">{hint}</span>}
    </a>
  );
}

/**
 * Contact-the-Foundation launcher: Call / WhatsApp / Email / Submit enquiry as 2-column tiles,
 * with office hours and address underneath. WhatsApp only appears when a number is configured.
 */
export function SupportActions({ contact, studentId, enquiryHref = "#new-ticket", className }: SupportActionsProps) {
  const waNumber = contact.whatsapp.replace(/\D/g, "");
  const waText = encodeURIComponent(`Hello, I need help with my EduSkill application${studentId ? ` (Student ID ${studentId})` : ""}.`);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-2 gap-3">
        {contact.phone && <Tile href={`tel:${contact.phone.replace(/\s+/g, "")}`} icon={<Phone className="h-[18px] w-[18px]" aria-hidden />} label="Call support" hint={contact.phone} />}
        {waNumber && <Tile href={`https://wa.me/${waNumber}?text=${waText}`} icon={<MessageCircle className="h-[18px] w-[18px]" aria-hidden />} label="WhatsApp" hint={contact.whatsapp} tone="green" external />}
        {contact.email && <Tile href={`mailto:${contact.email}`} icon={<Mail className="h-[18px] w-[18px]" aria-hidden />} label="Email us" hint={contact.email} />}
        <Tile href={enquiryHref} icon={<MessageSquarePlus className="h-[18px] w-[18px]" aria-hidden />} label="Submit enquiry" hint="Raise a ticket" tone="orange" />
      </div>
      <div className="card space-y-1.5 p-4 text-body-sm text-muted">
        {contact.hours && (
          <p className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-navy" aria-hidden /> {contact.hours}
          </p>
        )}
        {contact.address && (
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-navy" aria-hidden /> {contact.address}
          </p>
        )}
      </div>
    </div>
  );
}
