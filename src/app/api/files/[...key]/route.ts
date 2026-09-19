import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { isPrivateKey, readStoredFile } from "@/lib/storage";

/**
 * Serves stored files. Public files (`public/...`) are cacheable and open.
 * Private files (`private/...`) require a session and an ownership/permission check:
 *   private/students/<studentId>/...   → that student, or staff with students.view / applications.view
 *   private/trainers/<trainerAppOrId>/... → that trainer/applicant, or staff with trainers.view
 *   private/staff/...                  → admin/staff only
 *   private/<anything else>            → admin/staff only
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  if (!key || key.includes("..")) return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid key" } }, { status: 400 });

  if (isPrivateKey(key)) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Login required" } }, { status: 401 });
    const allowed = await canAccessPrivate(key, user);
    if (!allowed) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "You cannot access this file" } }, { status: 403 });
  }

  const file = await readStoredFile(key);
  if (!file) return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "File not found" } }, { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": file.mimeType,
    "Content-Length": String(file.buffer.length),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": isPrivateKey(key) ? "private, no-store" : "public, max-age=31536000, immutable",
    "Content-Disposition": `inline; filename="${key.split("/").pop()}"`,
  };
  return new NextResponse(new Uint8Array(file.buffer), { status: 200, headers });
}

async function canAccessPrivate(key: string, user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>): Promise<boolean> {
  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "STAFF";
  const [, scope, ownerId] = key.split("/");

  if (scope === "students") {
    if (user.role === "STUDENT" && user.student?.id === ownerId) return true;
    if (isAdmin && hasPermission(user, ["students.view", "applications.view", "admissions.view"])) return true;
    // Trainers may view photos of students in their batches
    if (user.role === "TRAINER" && user.trainer && ownerId) {
      const shared = await db.admission.count({ where: { studentId: ownerId, batch: { trainerId: user.trainer.id } } });
      return shared > 0 && key.includes("/photo");
    }
    return false;
  }
  if (scope === "trainers") {
    if (user.role === "TRAINER" && user.trainer && ownerId) {
      if (user.trainer.id === ownerId) return true;
      const app = await db.trainer.findUnique({ where: { id: user.trainer.id }, select: { applicationId: true } });
      return app?.applicationId === ownerId;
    }
    if (isAdmin && hasPermission(user, "trainers.view")) return true;
    // Applicants (not yet trainers) access their own application files via a signed cookie-less path is not supported; they see status only.
    return false;
  }
  if (scope === "materials") {
    // Study material: any logged-in student/trainer/staff
    return true;
  }
  return isAdmin;
}
