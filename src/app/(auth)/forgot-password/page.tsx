import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-form";

/**
 * This page was a client component, which meant it could not export metadata and shipped with no
 * title of its own. The form keeps its behaviour exactly; only the boundary moved.
 */
export const metadata: Metadata = { title: "Forgot Password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
