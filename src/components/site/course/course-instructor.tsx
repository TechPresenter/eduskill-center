import { BadgeCheck, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { Media } from "@/components/site/safe-image";

export interface InstructorView {
  id: string;
  name: string;
  qualification: string | null;
  bio: string | null;
  skills: string[];
  /** "Block trainer, Rampur block, Varanasi" — built from the trainer's own level and location. */
  area: string | null;
}

/**
 * Instructor.
 *
 * Two real sources, both configured by the Foundation: the instructor image on the course record,
 * and the approved trainers actually assigned to this course. Only professional profile fields are
 * published — name, qualification, teaching area, skills, bio. No email, no mobile, no document.
 *
 * With a photo but no assignment yet, the section says what happens instead of inventing a person.
 */
export function CourseInstructor({ imageSrc, trainers, courseName, seed }: { imageSrc: string | null; trainers: InstructorView[]; courseName: string; seed: string }) {
  if (!imageSrc && trainers.length === 0) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
      {imageSrc && (
        <div className="lg:col-span-4">
          <div className="overflow-hidden rounded-card-lg shadow-e1">
            <Media src={imageSrc} alt={`Trainer teaching ${courseName}`} seed={`${seed}-instructor`} ratio="4x3" sizes="(max-width: 1024px) 100vw, 380px" />
          </div>
        </div>
      )}
      <div className={imageSrc ? "lg:col-span-8" : "lg:col-span-12"}>
        {trainers.length === 0 ? (
          <div className="card card-p">
            <h3 className="flex items-center gap-2 text-h4 text-navy">
              <GraduationCap className="h-5 w-5 shrink-0 text-orange" aria-hidden /> Taught by an approved EduSkill trainer
            </h3>
            <p className="mt-2 text-body text-muted">
              Every batch is led by a trainer whose qualifications and documents the Foundation has verified. Your trainer is named on your admission letter once you are placed in a batch at your
              centre.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {trainers.map((t) => (
              <li key={t.id} className="card flex h-full flex-col gap-3 card-p">
                <div className="flex items-start gap-3">
                  <Avatar name={t.name} size={48} />
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 text-h4 text-navy">
                      <span className="min-w-0 break-words">{t.name}</span>
                      <BadgeCheck className="h-4 w-4 shrink-0 text-success" aria-label="Verified trainer" />
                    </h3>
                    {t.qualification && <p className="mt-0.5 text-body-sm font-medium text-ink">{t.qualification}</p>}
                    {t.area && <p className="mt-0.5 text-body-sm text-muted">{t.area}</p>}
                  </div>
                </div>
                {t.bio && <p className="text-body-sm text-muted">{t.bio}</p>}
                {t.skills.length > 0 && (
                  <ul className="mt-auto flex flex-wrap gap-1.5">
                    {t.skills.slice(0, 6).map((s) => (
                      <li key={s}>
                        <Badge tone="navy">{s}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
