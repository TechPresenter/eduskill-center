import { isOfferEffective, type OfferWindow } from "@/lib/course-pricing";
import type { BadgeTone } from "@/components/ui/badge";

/**
 * How one offer relates to "right now". Derived from `isOfferEffective()` — the same predicate the
 * public page and `activeOfferWhere()`'s SQL use — so this screen cannot label an offer live when
 * the site would not show it. The only thing decided here is which side of its window an
 * *ineffective* offer sits on, which is what tells "scheduled" apart from "expired".
 *
 * `effectiveOfferId` must come from `getCourseCmsBundle()` (i.e. `pickEffectiveOffer`), so the
 * single offer the page actually renders is the one marked LIVE; other in-window offers are
 * SUPERSEDED because a lower `sortOrder` wins.
 */
export type OfferState = "LIVE" | "SUPERSEDED" | "SCHEDULED" | "EXPIRED" | "INACTIVE";

export function offerState(offer: OfferWindow & { id: string }, effectiveOfferId: string | null, now: Date): OfferState {
  if (!offer.isActive) return "INACTIVE";
  if (isOfferEffective(offer, now)) return offer.id === effectiveOfferId ? "LIVE" : "SUPERSEDED";
  const start = offer.startsAt == null ? null : new Date(offer.startsAt).getTime();
  if (start !== null && Number.isFinite(start) && now.getTime() < start) return "SCHEDULED";
  return "EXPIRED";
}

export const OFFER_STATE_META: Record<OfferState, { label: string; tone: BadgeTone; hint: string }> = {
  LIVE: { label: "Active now", tone: "success", hint: "The offer that would be shown — the public page does not show offers until billing applies them." },
  SUPERSEDED: { label: "Active, outranked", tone: "warning", hint: "Inside its dates, but another offer is higher in the order." },
  SCHEDULED: { label: "Scheduled", tone: "info", hint: "Starts automatically on its start date — nothing to switch on." },
  EXPIRED: { label: "Expired", tone: "neutral", hint: "Past its end date." },
  INACTIVE: { label: "Off", tone: "neutral", hint: "Switched off by hand, whatever the dates say." },
};
