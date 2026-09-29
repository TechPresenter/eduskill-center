import { Award, MapPin, Quote } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { truncate } from "@/lib/utils";

export interface StoryCardData {
  id: string;
  studentName: string;
  photoUrl: string | null;
  courseName: string | null;
  centerName: string | null;
  location: string | null;
  story: string;
  achievement: string | null;
}

/**
 * One graduate's story. The quietest member of the card family (see program-card.tsx for the shared
 * spine): no link, so no hover hue and no focus ring — only the `card-hover` lift, which keeps a
 * carousel of these feeling alive under a mouse.
 *
 * The achievement is the one thing on the card that outranks the story text, so it is the one thing
 * in brand green: this is the outcome the Foundation is pointing at, not a system status, which is
 * why it leaves `Badge tone="success"` behind.
 */
export function StoryCard({ story, full }: { story: StoryCardData; full?: boolean }) {
  return (
    <article className="card card-hover relative flex h-full flex-col card-p">
      {/* Pale blue rather than lavender so the decoration reads as the logo's blue. Decorative. */}
      <Quote className="absolute top-5 right-5 h-8 w-8 text-navy-soft" aria-hidden />
      <div className="flex items-center gap-4 pr-9">
        <Avatar name={story.studentName} src={story.photoUrl} size={56} className="ring-4 ring-navy-soft" />
        <div className="min-w-0">
          <h3 className="truncate text-h4 text-navy">{story.studentName}</h3>
          {/* navy-light (5.82:1), not orange: at 13.5px orange is 3.72:1 and fails AA. */}
          {story.courseName && <p className="truncate text-body-sm font-medium text-navy-light">{story.courseName}</p>}
        </div>
      </div>
      {(story.centerName || story.location) && (
        <p className="mt-3 flex items-start gap-1.5 text-body-sm text-muted">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-navy-light" aria-hidden />
          <span>{[story.centerName, story.location].filter(Boolean).join(" · ")}</span>
        </p>
      )}
      {story.achievement && (
        /* The green tone `Badge` does not have yet — the same three classes the course card's
           scholarship badge uses, so one achievement and one scholarship look alike. green-dark on
           green-light is 5.89:1. */
        <Badge className="mt-3 max-w-full items-start self-start border-green/20 bg-green-light text-left text-green-dark whitespace-normal">
          <Award className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span className="min-w-0">{story.achievement}</span>
        </Badge>
      )}
      <p className="mt-4 flex-1 text-body text-ink/90">{full ? story.story : truncate(story.story, 220)}</p>
    </article>
  );
}
