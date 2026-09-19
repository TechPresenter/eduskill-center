import type { ReactNode } from "react";
import { PageTransition } from "@/components/portal/page-transition";

/** Re-mounts per navigation so every student page plays the app-style page transition. */
export default function StudentTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
