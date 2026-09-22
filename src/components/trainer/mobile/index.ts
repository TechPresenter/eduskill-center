/**
 * Phone-first building blocks for the trainer portal, mirroring `@/components/student/mobile`.
 * Each module keeps its own client/server boundary, so this barrel stays free of "use client".
 */
export { TrainerGreeting, type TrainerGreetingProps } from "./home-greeting";
export { TrainerIdCard, type TrainerIdCardProps } from "./trainer-id-card";
export { TrainerQuickActions, type TrainerQuickAction } from "./quick-actions";
export { TodayClasses, type TodayClass, type TodayClassesProps } from "./today-classes";
export { BatchCard, type BatchCardData } from "./batch-card";
export { NotificationRow, trainerLinkFor, type TrainerNotification, type NotificationRowProps } from "./notification-row";
export { AttendanceRoster, ATTENDANCE_STATUSES, type AttendanceRosterProps, type AttendanceStatus, type AttendanceStudent, type AttendanceMark } from "./attendance-roster";
export { AssignmentCard, type CourseworkRow, type AssignmentCardProps } from "./assignment-card";
export { AssessmentCard, type AssessmentRow, type AssessmentCardProps } from "./assessment-card";
export { ResultsEntryList, previewGrade, marksInputId, type ResultRow, type ResultEntry, type ResultsEntryListProps } from "./results-entry-list";
export { StudentCard, attendanceTone, attendanceTextClass, type TrainerStudentRow } from "./student-card";
export { MaterialCard, type MaterialRow } from "./material-card";
