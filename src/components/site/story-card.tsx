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

export function StoryCard({ story, full }: { story: StoryCardData; full?: boolean }) {
  return (
    <article className="card card-hover relative flex h-full flex-col card-p">
      <Quote className="absolute top-5 right-5 h-8 w-8 text-lavender" aria-hidden />
      <div className="flex items-center gap-4 pr-9">
        <Avatar name={story.studentName} src={story.photoUrl} size={56} className="ring-4 ring-lavender" />
        <div className="min-w-0">
          <h3 className="truncate text-h4 text-navy">{story.studentName}</h3>
          {story.courseName && <p className="truncate text-body-sm font-medium text-orange">{story.courseName}</p>}
        </div>
      </div>
      {(story.centerName || story.location) && (
        <p className="mt-3 flex items-start gap-1.5 text-caption text-muted">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange" aria-hidden />
          <span>{[story.centerName, story.location].filter(Boolean).join(" · ")}</span>
        </p>
      )}
      {story.achievement && (
        <Badge tone="success" className="mt-3 max-w-full items-start self-start text-left whitespace-normal">
          <Award className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /><span className="min-w-0">{story.achievement}</span>
        </Badge>
      )}
      <p className="mt-4 flex-1 text-body text-ink/90">{full ? story.story : truncate(story.story, 220)}</p>
    </article>
  );
}
