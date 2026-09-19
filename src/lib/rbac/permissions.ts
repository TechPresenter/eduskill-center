import type { UserRole } from "@/generated/prisma/enums";

/**
 * Permission catalog. Keys are `${module}.${action}`.
 * Super Admin implicitly holds every permission. Foundation Staff receive permissions
 * through their Role plus any direct grants made by the Super Admin.
 */
export const PERMISSION_MODULES = [
  { key: "dashboard", label: "Dashboard", actions: ["view"] },
  { key: "locations", label: "Locations (States / Districts / Blocks)", actions: ["view", "create", "update", "delete", "import", "export"] },
  { key: "centers", label: "Training Centers", actions: ["view", "create", "update", "delete", "verify"] },
  { key: "students", label: "Students", actions: ["view", "create", "update", "delete", "export"] },
  { key: "trainers", label: "Trainers & Trainer Applications", actions: ["view", "update", "approve", "reject", "assign", "delete", "export"] },
  { key: "centre_applications", label: "Centre Applications", actions: ["view", "update", "verify", "approve", "reject", "export"] },
  { key: "courses", label: "Courses", actions: ["view", "create", "update", "delete"] },
  { key: "batches", label: "Batches", actions: ["view", "create", "update", "delete"] },
  { key: "applications", label: "Student Applications", actions: ["view", "update", "approve", "reject", "export"] },
  { key: "admissions", label: "Admissions", actions: ["view", "update", "approve", "export"] },
  { key: "payments", label: "Payments", actions: ["view", "create", "verify", "refund", "export"] },
  { key: "scholarships", label: "Scholarships", actions: ["view", "create", "update", "approve", "delete"] },
  { key: "attendance", label: "Attendance", actions: ["view", "mark", "export"] },
  { key: "progress", label: "Student Progress", actions: ["view", "update"] },
  { key: "certificates", label: "Certificates", actions: ["view", "issue", "revoke", "export"] },
  { key: "reports", label: "Reports & Analytics", actions: ["view", "export"] },
  { key: "cms", label: "Website Content (CMS)", actions: ["view", "update", "publish"] },
  { key: "notifications", label: "Notifications", actions: ["view", "send", "templates"] },
  { key: "users", label: "Staff & User Accounts", actions: ["view", "create", "update", "delete"] },
  { key: "roles", label: "Roles & Permissions", actions: ["view", "create", "update", "delete"] },
  { key: "settings", label: "Settings", actions: ["view", "update"] },
  { key: "audit_logs", label: "Audit Logs", actions: ["view"] },
  { key: "support", label: "Support Tickets & Enquiries", actions: ["view", "respond"] },
  { key: "donations", label: "Donations & Campaigns", actions: ["view", "update"] },
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number]["key"];

export interface PermissionDef {
  key: string;
  module: PermissionModule;
  label: string;
}

const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  update: "Edit",
  delete: "Delete",
  import: "Import",
  export: "Export",
  verify: "Verify",
  approve: "Approve",
  reject: "Reject",
  assign: "Assign",
  refund: "Refund",
  mark: "Mark",
  issue: "Issue",
  revoke: "Revoke",
  publish: "Publish",
  send: "Send",
  templates: "Manage Templates",
  respond: "Respond",
};

export const ALL_PERMISSIONS: PermissionDef[] = PERMISSION_MODULES.flatMap((m) =>
  m.actions.map((a) => ({ key: `${m.key}.${a}`, module: m.key, label: `${ACTION_LABELS[a] ?? a} ${m.label}` }))
);

export const PERMISSION_KEYS = new Set(ALL_PERMISSIONS.map((p) => p.key));

export function hasPermission(
  user: { role: UserRole; permissions: string[] } | null | undefined,
  required: string | string[]
): boolean {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN" || user.permissions.includes("*")) return true;
  if (user.role !== "STAFF") return false;
  const needed = Array.isArray(required) ? required : [required];
  return needed.some((k) => user.permissions.includes(k));
}

export function hasAllPermissions(
  user: { role: UserRole; permissions: string[] } | null | undefined,
  required: string[]
): boolean {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN" || user.permissions.includes("*")) return true;
  return required.every((k) => user.permissions.includes(k));
}

export function isAdminRole(role: UserRole | undefined | null) {
  return role === "SUPER_ADMIN" || role === "STAFF";
}

/** Default Foundation Staff roles created by the seed. Super Admin can edit them freely. */
export const DEFAULT_STAFF_ROLES: { name: string; slug: string; description: string; permissions: string[] }[] = [
  {
    name: "Admissions Staff",
    slug: "admissions-staff",
    description: "Reviews student applications, verifies documents and confirms admissions.",
    permissions: [
      "dashboard.view", "students.view", "students.update", "applications.view", "applications.update",
      "applications.approve", "applications.reject", "admissions.view", "admissions.update", "admissions.approve",
      "batches.view", "centers.view", "courses.view", "scholarships.view", "payments.view", "notifications.view",
      "notifications.send", "support.view", "support.respond", "locations.view",
    ],
  },
  {
    name: "Center Management Staff",
    slug: "center-management-staff",
    description: "Creates and maintains training centers, batches and trainer assignments.",
    permissions: [
      "dashboard.view", "locations.view", "locations.create", "locations.update", "centers.view", "centers.create",
      "centre_applications.view", "centre_applications.update", "centre_applications.verify", "centre_applications.approve", "centre_applications.reject",
      "centers.update", "centers.verify", "batches.view", "batches.create", "batches.update", "courses.view",
      "trainers.view", "trainers.assign", "students.view", "reports.view",
    ],
  },
  {
    name: "Trainer Management Staff",
    slug: "trainer-management-staff",
    description: "Reviews volunteer trainer applications, schedules interviews and manages assignments.",
    permissions: [
      "dashboard.view", "trainers.view", "trainers.update", "trainers.approve", "trainers.reject", "trainers.assign",
      "centers.view", "batches.view", "courses.view", "locations.view", "notifications.view", "notifications.send",
    ],
  },
  {
    name: "Finance Staff",
    slug: "finance-staff",
    description: "Verifies payments, manages scholarships, fees and financial reports.",
    permissions: [
      "dashboard.view", "payments.view", "payments.create", "payments.verify", "payments.refund", "payments.export",
      "scholarships.view", "scholarships.create", "scholarships.update", "scholarships.approve", "applications.view",
      "students.view", "reports.view", "reports.export", "donations.view", "donations.update",
    ],
  },
  {
    name: "Content Staff",
    slug: "content-staff",
    description: "Manages website content, programs, stories, blog, events, gallery and FAQs.",
    permissions: ["dashboard.view", "cms.view", "cms.update", "cms.publish", "courses.view"],
  },
  {
    name: "Report Staff",
    slug: "report-staff",
    description: "Read-only access to dashboards, records and report exports.",
    permissions: [
      "dashboard.view", "reports.view", "reports.export", "students.view", "trainers.view", "centers.view",
      "courses.view", "batches.view", "applications.view", "admissions.view", "payments.view", "scholarships.view",
      "attendance.view", "certificates.view", "locations.view",
    ],
  },
];
