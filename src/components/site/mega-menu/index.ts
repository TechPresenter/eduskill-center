/**
 * Header "Courses" mega menu. Client-safe exports only — load the data on the server with
 * `getCoursesMenu()` from "@/server/nav-menu" and pass it in as `data`.
 */
export { CoursesMegaMenu } from "./courses-mega-menu";
export { MobileCoursesMenu } from "./mobile-courses-menu";
export { MegaMenuRow, TONE_TILE } from "./menu-row";
export { MegaMenuFeatureCard } from "./feature-card";
export { MEGA_TONES, isMegaTone, type CoursesMenuData, type MegaMenuFeature, type MegaMenuLink, type MegaTone } from "./types";
