"use client";

import { Award, Bell, BookOpen, CalendarDays, ClipboardCheck, ClipboardList, CreditCard, FileText, FolderOpen, GraduationCap, LayoutDashboard, LifeBuoy, ListChecks, MapPin, School, Settings, TrendingUp, UserCircle } from "lucide-react";
import type { NavGroup, NavItem } from "@/components/portal/shell";

export const STUDENT_NAV: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
      { label: "My Profile", href: "/student/profile", icon: UserCircle },
      { label: "My Courses", href: "/student/courses", icon: GraduationCap },
      { label: "Find a Center & Apply", href: "/student/apply", icon: MapPin },
      { label: "My Applications", href: "/student/applications", icon: ClipboardList },
      { label: "Documents", href: "/student/documents", icon: FolderOpen },
      { label: "Fees & Payments", href: "/student/payments", icon: CreditCard },
    ],
  },
  {
    title: "My Training",
    items: [
      { label: "Training", href: "/student/training", icon: School, exact: true },
      { label: "Timetable", href: "/student/timetable", icon: CalendarDays },
      { label: "Attendance", href: "/student/attendance", icon: ClipboardCheck },
      { label: "Study Material", href: "/student/materials", icon: BookOpen },
      { label: "Assignments", href: "/student/assignments", icon: FileText },
      { label: "Assessments", href: "/student/assessments", icon: ListChecks },
      { label: "Progress", href: "/student/progress", icon: TrendingUp },
      { label: "Certificates", href: "/student/certificates", icon: Award },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Notifications", href: "/student/notifications", icon: Bell },
      { label: "Support", href: "/student/support", icon: LifeBuoy },
      { label: "Settings", href: "/student/settings", icon: Settings },
    ],
  },
];

/** Every route that belongs to the "Training" hub, so the bottom-nav tab stays lit inside it. */
export const STUDENT_TRAINING_ROUTES = ["/student/timetable", "/student/attendance", "/student/materials", "/student/assignments", "/student/assessments", "/student/progress", "/student/certificates"];

export const STUDENT_BOTTOM_NAV: NavItem[] = [
  { label: "Home", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Courses", href: "/student/courses", icon: GraduationCap },
  { label: "Applications", href: "/student/applications", icon: ClipboardList },
  { label: "Training", href: "/student/training", icon: School, match: STUDENT_TRAINING_ROUTES },
  { label: "Profile", href: "/student/profile", icon: UserCircle },
];
