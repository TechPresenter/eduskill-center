import type { ReactNode } from "react";
import { PageTransition } from "@/components/portal/page-transition";

/** Re-mounts per navigation so every trainer page plays the app-style page transition. */
export default function TrainerTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
