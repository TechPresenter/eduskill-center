/**
 * Phone-first building blocks for the student portal.
 * Each module keeps its own client/server boundary, so this barrel stays free of "use client".
 */
export { HomeGreeting, type HomeGreetingProps } from "./home-greeting";
export { StudentIdCard, type StudentIdCardProps } from "./student-id-card";
export { ApplicationTracker, type ApplicationTrackerProps } from "./application-tracker";
export { QuickActions, type QuickAction } from "./quick-actions";
export { ProgressSummaryCard, type ProgressSummary, type ProgressSummaryCardProps } from "./progress-summary-card";
export { ProfileHub, profileCompletionPct, type ProfileHubProps, type ProfileCompletionInput } from "./profile-hub";
export { SupportActions, type SupportActionsProps, type SupportContact } from "./support-actions";
export { PaymentRowCard, type PaymentRow } from "./payment-row-card";
export { AttendanceRowCard, AttendanceRecordsList, type AttendanceRow } from "./attendance-row-card";
