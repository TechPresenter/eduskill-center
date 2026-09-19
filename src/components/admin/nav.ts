"use client";

import {
  Award, BarChart3, Bell, BookOpen, Building2, CalendarDays, ClipboardCheck, ClipboardList, Coins, CreditCard, FileText, GraduationCap, HandCoins, HelpCircle,
  History, Image as ImageIcon, KeyRound, LayoutDashboard, LifeBuoy, Map, Menu, Newspaper, School, Settings, ShieldCheck, TrendingUp, UserCheck, UserCog, UsersRound,
} from "lucide-react";
import type { NavGroup, NavItem } from "@/components/portal/shell";

export const ADMIN_NAV: NavGroup[] = [
  { items: [{ label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, permission: "dashboard.view" }] },
  {
    title: "Network",
    items: [
      { label: "Locations", href: "/admin/locations", icon: Map, permission: "locations.view" },
      { label: "Training Centers", href: "/admin/centers", icon: Building2, permission: "centers.view" },
      { label: "Centre Applications", href: "/admin/centre-applications", icon: School, permission: "centre_applications.view" },
    ],
  },
  {
    title: "Academics",
    items: [
      { label: "Courses", href: "/admin/courses", icon: BookOpen, permission: "courses.view" },
      { label: "Batches", href: "/admin/batches", icon: CalendarDays, permission: "batches.view" },
      { label: "Attendance", href: "/admin/attendance", icon: ClipboardCheck, permission: "attendance.view" },
      { label: "Student Progress", href: "/admin/progress", icon: TrendingUp, permission: "progress.view" },
      { label: "Certificates", href: "/admin/certificates", icon: Award, permission: "certificates.view" },
    ],
  },
  {
    title: "Students",
    items: [
      { label: "Students", href: "/admin/students", icon: GraduationCap, permission: "students.view" },
      { label: "Applications", href: "/admin/applications", icon: ClipboardList, permission: "applications.view" },
      { label: "Admissions", href: "/admin/admissions", icon: UserCheck, permission: "admissions.view" },
      { label: "Payments", href: "/admin/payments", icon: CreditCard, permission: "payments.view" },
      { label: "Scholarships", href: "/admin/scholarships", icon: Coins, permission: "scholarships.view" },
    ],
  },
  {
    title: "Trainers",
    items: [
      { label: "Trainer Applications", href: "/admin/trainer-applications", icon: FileText, permission: "trainers.view" },
      { label: "Trainers", href: "/admin/trainers", icon: UsersRound, permission: "trainers.view" },
    ],
  },
  { title: "Insights", items: [{ label: "Reports", href: "/admin/reports", icon: BarChart3, permission: "reports.view" }] },
  {
    title: "Website",
    items: [
      { label: "Content (CMS)", href: "/admin/cms", icon: Newspaper, permission: "cms.view" },
      { label: "Gallery", href: "/admin/gallery", icon: ImageIcon, permission: "cms.view" },
      { label: "Blog", href: "/admin/blog", icon: FileText, permission: "cms.view" },
      { label: "Events", href: "/admin/events", icon: CalendarDays, permission: "cms.view" },
      { label: "FAQs", href: "/admin/faqs", icon: HelpCircle, permission: "cms.view" },
      { label: "Donations", href: "/admin/donations", icon: HandCoins, permission: "donations.view" },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "Notifications", href: "/admin/notifications", icon: Bell, permission: "notifications.view" },
      { label: "Support & Enquiries", href: "/admin/support", icon: LifeBuoy, permission: "support.view" },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Staff", href: "/admin/staff", icon: UserCog, permission: "users.view" },
      { label: "Roles", href: "/admin/roles", icon: ShieldCheck, permission: "roles.view" },
      { label: "Permissions", href: "/admin/permissions", icon: KeyRound, permission: "roles.view" },
      { label: "Settings", href: "/admin/settings", icon: Settings, permission: "settings.view" },
      { label: "Audit Logs", href: "/admin/audit-logs", icon: History, permission: "audit_logs.view" },
    ],
  },
];

/**
 * Phone bottom navigation (≤ 5 items; the shell drops the ones the staff user lacks permission for).
 * "More" opens the full navigation drawer (every ADMIN_NAV group + Log out) instead of navigating.
 */
export const ADMIN_BOTTOM_NAV: NavItem[] = [
  { label: "Home", href: "/admin/dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { label: "Applications", href: "/admin/applications", icon: ClipboardList, permission: "applications.view", match: ["/admin/admissions"] },
  { label: "Students", href: "/admin/students", icon: GraduationCap, permission: "students.view" },
  { label: "Centers", href: "/admin/centers", icon: Building2, permission: "centers.view" },
  { label: "More", href: "#menu", icon: Menu, action: "menu" },
];
