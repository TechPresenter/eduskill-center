import { db, type DbClient } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { pad } from "@/lib/utils";

/**
 * Atomically increments and returns the next value for a named sequence.
 * Implemented as a single INSERT ... ON CONFLICT ... RETURNING statement so it is
 * safe under concurrency and never produces duplicates, even across instances.
 */
export async function nextSequence(key: string, client: DbClient = db): Promise<number> {
  const rows = await client.$queryRaw<{ value: number }[]>`
    INSERT INTO "id_sequences" ("key", "value", "updated_at")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE
      SET "value" = "id_sequences"."value" + 1, "updated_at" = now()
    RETURNING "value"`;
  return Number(rows[0]?.value ?? 0);
}

/** Renders `{PREFIX}-{STATE}-{DISTRICT}-{SEQ:4}` style formats. */
export function renderCodeFormat(format: string, vars: Record<string, string | number>): string {
  return format.replace(/\{([A-Z_]+)(?::(\d+))?\}/g, (_m, name: string, width?: string) => {
    const v = vars[name];
    if (v === undefined || v === null) return "";
    return width ? pad(Number(v), Number(width)) : String(v);
  });
}

const year = () => new Date().getFullYear();

export async function generateCenterCode(stateCode: string, districtCode: string, client: DbClient = db) {
  const prefix = await getSetting<string>("codes.centerPrefix");
  const format = await getSetting<string>("codes.centerFormat");
  const st = stateCode.toUpperCase();
  const dt = districtCode.toUpperCase();
  const seq = await nextSequence(`center:${st}:${dt}`, client);
  return { code: renderCodeFormat(format, { PREFIX: prefix, STATE: st, DISTRICT: dt, SEQ: seq }), sequence: seq };
}

export async function generateStudentId(client: DbClient = db) {
  const prefix = await getSetting<string>("codes.studentPrefix");
  const y = year();
  const seq = await nextSequence(`student:${y}`, client);
  return `${prefix}-${y}-${pad(seq, 5)}`;
}

export async function generateTrainerId(client: DbClient = db) {
  const prefix = await getSetting<string>("codes.trainerPrefix");
  const y = year();
  const seq = await nextSequence(`trainer:${y}`, client);
  return `${prefix}-${y}-${pad(seq, 5)}`;
}

export async function generateApplicationNo(client: DbClient = db) {
  const y = year();
  const seq = await nextSequence(`application:${y}`, client);
  return `APP-${y}-${pad(seq, 6)}`;
}

export async function generateTrainerApplicationNo(client: DbClient = db) {
  const y = year();
  const seq = await nextSequence(`trainer_application:${y}`, client);
  return `TAP-${y}-${pad(seq, 6)}`;
}

export async function generateCentreApplicationNo(client: DbClient = db) {
  const y = year();
  const seq = await nextSequence(`centre_application:${y}`, client);
  return `CEN-${y}-${pad(seq, 6)}`;
}

export async function generateAdmissionNo(client: DbClient = db) {
  const y = year();
  const seq = await nextSequence(`admission:${y}`, client);
  return `ADM-${y}-${pad(seq, 6)}`;
}

export async function generatePaymentNumbers(client: DbClient = db) {
  const y = year();
  const seq = await nextSequence(`payment:${y}`, client);
  return { paymentNo: `PAY-${y}-${pad(seq, 6)}`, invoiceNo: `INV-${y}-${pad(seq, 6)}` };
}

export async function generateReceiptNo(client: DbClient = db) {
  const y = year();
  const seq = await nextSequence(`receipt:${y}`, client);
  return `RCP-${y}-${pad(seq, 6)}`;
}

export async function generateCertificateNo(client: DbClient = db) {
  const prefix = await getSetting<string>("codes.certificatePrefix");
  const y = year();
  const seq = await nextSequence(`certificate:${y}`, client);
  return `${prefix}-${y}-${pad(seq, 6)}`;
}

export async function generateBatchCode(centerCode: string, client: DbClient = db) {
  const seq = await nextSequence(`batch:${centerCode}`, client);
  return `${centerCode}-B${pad(seq, 3)}`;
}

export async function generateTicketNo(client: DbClient = db) {
  const seq = await nextSequence("ticket", client);
  return `TKT-${pad(seq, 6)}`;
}

export async function generateDonationNo(client: DbClient = db) {
  const y = year();
  const seq = await nextSequence(`donation:${y}`, client);
  return `DON-${y}-${pad(seq, 6)}`;
}

export async function generateEmployeeCode(client: DbClient = db) {
  const seq = await nextSequence("employee", client);
  return `EMP-${pad(seq, 4)}`;
}
