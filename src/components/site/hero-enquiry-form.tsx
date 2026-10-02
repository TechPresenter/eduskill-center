"use client";

import * as React from "react";
import { ArrowRight, CheckCircle2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { Field } from "@/components/ui/form";
import { Input, Checkbox } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/feedback";
import type { CourseOption } from "@/components/site/course-select";
import { api, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export interface HeroChipData {
  icon?: string;
  label?: string;
}

export interface HeroStat {
  key: string;
  value: number;
  suffix: string;
  label: string;
}

/**
 * The hero's admission enquiry card — the right-hand column of the homepage hero.
 *
 * It posts to the REAL endpoint (`POST /api/public/enquiries` → `createEnquiry`), which stores an
 * `Enquiry` row and calls `notifyStaff("support.view")`
 * so the Foundation is told a new enquiry arrived. There is no local "thanks!" that quietly drops
 * the message.
 *
 * TWO FIELDS THE VISITOR NEVER SEES, and why they are not padding:
 *   `subject` is the chosen course's real name, and `message` is composed from that same choice —
 *   the endpoint requires at least ten characters of message, and the honest way to satisfy that is
 *   to write down what the visitor actually told us, not to pad a string. A staff member opening
 *   Admin → Support → Enquiries reads a sentence that says which course and where it came from.
 *
 * WHY THE CONTROLS ARE WHITE ON A DARK CARD. The card is translucent navy, like the reference's.
 * The inputs inside it are the product's own `Input`/`Select` — white, 16px on phones so Android
 * never zooms, 44px tall — because a dark translucent input over a dark translucent card over a
 * navy band cannot be held above 4.5:1 as the background art moves underneath it. Only the chrome
 * around them is repainted for the dark bed: labels to white, and field errors into a white chip
 * (`text-danger` on white is 4.83:1, where `text-danger` straight onto the card is 2.7:1).
 */
export function HeroEnquiryForm({
  heading,
  consentText,
  ctaLabel,
  note,
  courses,
  className,
}: {
  heading: string;
  consentText: string;
  ctaLabel: string;
  note?: string;
  courses: CourseOption[];
  className?: string;
}) {
  const [name, setName] = React.useState("");
  const [mobile, setMobile] = React.useState("");
  const [courseId, setCourseId] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [website, setWebsite] = React.useState(""); // honeypot
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"idle" | "busy" | "done">("idle");
  const [sentTo, setSentTo] = React.useState<{ name: string; course: string } | null>(null);

  const hasCourses = courses.length > 0;
  const courseName = courses.find((c) => c.id === courseId)?.name ?? "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Client-side checks mirror the server schema plus the two controls the server never sees (the
    // course choice and the consent box). They are a courtesy, not the gate: the server validates
    // again and its field errors land on these same inputs.
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Enter your name";
    if (!/^(\+?91[\s-]?)?[6-9]\d{9}$/.test(mobile.trim().replace(/[\s-]/g, ""))) next.mobile = "Enter a valid 10-digit mobile number";
    if (hasCourses && !courseId) next.courseId = "Choose what you want to study";
    if (!consent) next.consent = "Please tick the box so we may contact you";
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setStatus("busy");
    try {
      await api.post("/api/public/enquiries", {
        name: name.trim(),
        mobile: mobile.trim(),
        type: "ADMISSION",
        subject: courseName || "Admission enquiry",
        // Composed from what the visitor actually chose, so the ten-character minimum is met by
        // real information rather than by padding. Without a course list there is no course to
        // name, and the sentence says so instead of inventing one.
        message: courseName
          ? `Admission enquiry for ${courseName} at an EduSkill centre. Please tell me about the nearest centre and how to join.`
          : "Admission enquiry from the EduSkill homepage. Please tell me about the nearest centre and how to join.",
        website,
      });
      setSentTo({ name: name.trim(), course: courseName });
      setStatus("done");
    } catch (err) {
      setStatus("idle");
      if (err instanceof ApiClientError) {
        const fields = err.fieldErrors;
        setErrors(fields);
        // 422 is answered by the inputs themselves; anything else (rate limit, network, 500) has no
        // field to sit on, so it gets said out loud instead of being swallowed.
        setFormError(Object.keys(fields).length > 0 ? null : err.message);
      } else {
        setFormError("We could not send that just now. Please try again in a moment.");
      }
    }
  };

  const reset = () => {
    setName("");
    setMobile("");
    setCourseId("");
    setConsent(false);
    setErrors({});
    setFormError(null);
    setSentTo(null);
    setStatus("idle");
  };

  return (
    <div
      className={cn(
        // Translucent navy glass on the dark band. `border-white/15` is what gives it an edge once
        // the blob drifts behind it; without the border the card dissolves.
        "rounded-card-lg border border-white/15 bg-white/8 p-4 shadow-e3 backdrop-blur-md sm:p-5",
        className,
      )}
    >
      {status === "done" ? (
        <div role="status" className="py-4 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-success-dark">
            <CheckCircle2 className="h-7 w-7" aria-hidden />
          </span>
          <h3 className="mt-4 font-heading text-2xl font-extrabold text-white">
            {sentTo?.name ? `Thank you, ${sentTo.name.split(" ")[0]}!` : "Thank you!"}
          </h3>
          <p className="mt-2 text-body-sm text-white/80">
            Your enquiry {sentTo?.course ? <>about {sentTo.course} </> : null}has reached the EduSkill team.
          </p>
          <ul className="mt-5 space-y-2.5 text-left text-body-sm text-white/80">
            {[
              "A team member replies on your mobile number, usually within two working days.",
              "We share the nearest EduSkill centre and the dates of the next batch.",
              "There is no fee to enquire. Each course page shows its fee.",
            ].map((line) => (
              <li key={line} className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-on-navy" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <Button variant="white" className="mt-6" onClick={reset}>
            Send another enquiry
          </Button>
        </div>
      ) : (
        <>
          <h2 id="hero-enquiry-title" className="text-center font-heading text-base leading-snug font-extrabold text-white sm:text-lg">
            {heading}
          </h2>

          <form
            onSubmit={submit}
            noValidate
            aria-labelledby="hero-enquiry-title"
            // `relative` so the honeypot below is positioned against this form and can never widen
            // the page. Labels go white and field errors become a white chip: see the file header.
            className={cn(
              "relative mt-3 space-y-2.5",
              "[&_label]:text-white",
              // `p[role=alert]`, not `[role=alert]`: `Field`'s message is a <p>, while `Alert`
              // (below) is a <div role="alert"> that must keep its own danger styling.
              "[&_p[role=alert]]:rounded-md [&_p[role=alert]]:bg-white [&_p[role=alert]]:px-2 [&_p[role=alert]]:py-1 [&_p[role=alert]]:text-danger",
            )}
          >
            {formError && <Alert tone="danger">{formError}</Alert>}

            <Field label="Full name" htmlFor="hero-name" required error={errors.name}>
              <Input id="hero-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} invalid={!!errors.name} />
            </Field>

            {/* Mobile with a country prefix. The prefix is a static control, not a select: the
                endpoint only accepts Indian mobiles, so a country dropdown would be a promise we
                cannot keep. `pl-16` clears it; the field is still one 44px target. */}
            {/* The shared country-code field, same as every other mobile input on the site — the
                static "+91" prefix this replaced could not express anything but an Indian number. */}
            <Field label="Mobile number" htmlFor="hero-mobile" required error={errors.mobile}>
              <PhoneInput id="hero-mobile" value={mobile} onChange={setMobile} invalid={!!errors.mobile} required />
            </Field>

            {/* No active courses means nothing honest to put in this select, so it is not rendered
                at all — and the enquiry still goes through, saying only what the visitor told us. */}
            {hasCourses && (
              <Field label="What do you want to study?" htmlFor="hero-course" required error={errors.courseId}>
                <Select
                  id="hero-course"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  options={courses.map((c) => ({ value: c.id, label: c.name }))}
                  placeholder="Choose a class or course"
                  invalid={!!errors.courseId}
                />
              </Field>
            )}

            <Checkbox
              id="hero-consent"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              aria-invalid={!!errors.consent || undefined}
              aria-describedby={errors.consent ? "hero-consent-error" : undefined}
              label={consentText}
              className="items-start pt-1 [&>input]:mt-0.5 [&>span>span]:text-caption [&>span>span]:leading-relaxed [&>span>span]:font-normal [&>span>span]:text-white/80"
            />
            {errors.consent && (
              <p id="hero-consent-error" role="alert" className="text-caption font-semibold">
                {errors.consent}
              </p>
            )}

            {/* Honeypot — hidden from people, filled by bots. Off to the LEFT: a negative
                inline-start offset cannot extend document.scrollWidth the way a right-hand one
                would (the same trick as enquiry-form.tsx). */}
            <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
              <label htmlFor="hero-website">Website</label>
              <input id="hero-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>

            <Button type="submit" fullWidth size="lg" loading={status === "busy"} rightIcon={<ArrowRight className="h-4 w-4" />} className="mt-1">
              {ctaLabel}
            </Button>
            {note && (
              <p className="flex items-center justify-center gap-1.5 text-caption text-white/70">
                <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {note}
              </p>
            )}
          </form>
        </>
      )}
    </div>
  );
}
