"use client";

import { Bell, BookOpen, Building2, CalendarDays, ClipboardCheck, FileText, LayoutDashboard, ListChecks, Megaphone, Settings, UserCircle, Users, UsersRound } from "lucide-react";
import type { NavGroup, NavItem } from "@/components/portal/shell";

export const TRAINER_NAV: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "/trainer/dashboard", icon: LayoutDashboard },
      { label: "My Profile", href: "/trainer/profile", icon: UserCircle },
      { label: "My Assignments", href: "/trainer/assignments", icon: Building2 },
    ],
  },
  {
    title: "Teaching",
    items: [
      { label: "Batches", href: "/trainer/batches", icon: UsersRound },
      { label: "Students", href: "/trainer/students", icon: Users },
      { label: "Timetable", href: "/trainer/timetable", icon: CalendarDays },
      { label: "Attendance", href: "/trainer/attendance", icon: ClipboardCheck },
      { label: "Coursework", href: "/trainer/coursework", icon: FileText },
      { label: "Assessments", href: "/trainer/assessments", icon: ListChecks },
      { label: "Training Materials", href: "/trainer/materials", icon: BookOpen },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Announcements", href: "/trainer/announcements", icon: Megaphone },
      { label: "Notifications", href: "/trainer/notifications", icon: Bell },
      { label: "Settings", href: "/trainer/settings", icon: Settings },
    ],
  },
];

export const TRAINER_BOTTOM_NAV: NavItem[] = [
  { label: "Home", href: "/trainer/dashboard", icon: LayoutDashboard },
  { label: "Batches", href: "/trainer/batches", icon: UsersRound },
  { label: "Students", href: "/trainer/students", icon: Users },
  { label: "Attendance", href: "/trainer/attendance", icon: ClipboardCheck },
  { label: "Profile", href: "/trainer/profile", icon: UserCircle },
];
