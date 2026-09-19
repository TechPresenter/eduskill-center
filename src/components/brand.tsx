import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Branding } from "@/lib/settings";

/**
 * Brand wordmark. Uses the uploaded logo from Admin → Settings → Branding when present,
 * otherwise a text wordmark. `variant` picks the right logo slot.
 */
export function BrandMark({
  branding,
  variant = "main",
  className,
  light,
}: {
  branding: Pick<Branding, "siteName" | "shortName" | "logoUrl" | "logoMobileUrl" | "logoFooterUrl" | "logoAdminUrl">;
  variant?: "main" | "mobile" | "footer" | "admin";
  className?: string;
  light?: boolean;
}) {
  const logo =
    variant === "footer"
      ? branding.logoFooterUrl || branding.logoUrl
      : variant === "mobile"
        ? branding.logoMobileUrl || branding.logoUrl
        : variant === "admin"
          ? branding.logoAdminUrl || branding.logoUrl
          : branding.logoUrl;

  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt={branding.siteName} className={cn("h-10 w-auto object-contain", className)} />;
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", light ? "bg-white/15 text-white" : "bg-navy text-white")}>
        <GraduationCap className="h-6 w-6" aria-hidden />
      </span>
      <span className="flex flex-col leading-none">
        <span className={cn("font-heading text-[17px] font-extrabold tracking-tight", light ? "text-white" : "text-navy")}>
          EDU<span className="text-orange">SKILL</span>
        </span>
        <span className={cn("mt-0.5 text-[9.5px] font-bold tracking-[0.2em] uppercase", light ? "text-white/70" : "text-muted")}>India Foundation</span>
      </span>
    </span>
  );
}
