/**
 * Deep links for trainer notifications. Deliberately NOT a client module: the phone home (a server
 * component) and the inbox rows (client) both call it, and a function exported from a "use client"
 * file cannot be called during server rendering.
 */
export interface LinkableNotification {
  templateKey?: string | null;
  data?: unknown;
}

/**
 * Where a notification takes the trainer. Trainer payloads carry names rather than ids (see
 * `assignTrainer` / `announceToBatch` in src/server), so the event in `templateKey` is the reliable
 * signal and any id in `data` is used when it happens to be there. A row with no sensible destination
 * stays a button that only marks itself read — it never pretends to navigate.
 */
export function trainerLinkFor(n: LinkableNotification): string | null {
  const d = (n.data && typeof n.data === "object" ? n.data : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : null);
  const batchId = str("batchId");
  if (batchId) return `/trainer/batches/${batchId}`;

  const event = n.templateKey?.split(":")[0] ?? "";
  switch (event) {
    case "TRAINER_ASSIGNED":
      return "/trainer/assignments";
    case "TRAINER_APPROVED":
    case "TRAINER_APPLICATION_STATUS":
    case "TRAINER_APPLICATION_SUBMITTED":
      return "/trainer/profile";
    case "ANNOUNCEMENT":
      return "/trainer/announcements";
    case "ATTENDANCE_ALERT":
      return "/trainer/attendance";
    case "BATCH_ALLOCATED":
    case "BATCH_CHANGED":
    case "TRAINING_STARTED":
    case "ADMISSION_CONFIRMED":
    case "ADMISSION_CANCELLED":
      return "/trainer/batches";
    case "PASSWORD_RESET":
      return "/trainer/settings";
    default:
      return null;
  }
}

