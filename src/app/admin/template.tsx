import type { ReactNode } from "react";
import { PageTransition } from "@/components/portal/page-transition";

/** Re-mounts per navigation so every admin page plays the app-style page transition. */
export default function AdminTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
