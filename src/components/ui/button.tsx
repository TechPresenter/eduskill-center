import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "navy" | "white" | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-orange text-white shadow-sm hover:bg-orange-hover active:translate-y-px",
  secondary: "bg-lavender text-navy hover:bg-navy-soft",
  navy: "bg-navy text-white hover:bg-navy-dark",
  outline: "border border-line bg-white text-ink hover:border-navy/40 hover:bg-surface",
  ghost: "text-ink hover:bg-surface",
  danger: "bg-danger text-white hover:bg-red-700",
  white: "bg-white text-navy shadow-sm hover:bg-lavender",
  link: "text-orange underline-offset-4 hover:underline px-0",
};

/** Mobile-first heights: every size is at least 44px on phones (< sm), desktop keeps its compact height. */
const SIZES: Record<ButtonSize, string> = {
  xs: "h-9 sm:h-8 px-3 text-xs gap-1.5 rounded-lg",
  sm: "h-11 sm:h-9 px-4 sm:px-3.5 text-sm gap-2 rounded-lg",
  md: "h-12 sm:h-11 px-5 text-[15px] sm:text-sm gap-2 rounded-xl",
  lg: "h-13 sm:h-12 px-6 text-base gap-2.5 rounded-xl",
  xl: "h-14 px-8 text-base gap-3 rounded-2xl",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; className?: string }) {
  return cn(
    "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all duration-200 touch-manipulation select-none tap-highlight-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    className
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, leftIcon, rightIcon, fullWidth, className, children, disabled, type = "button", ...props },
  ref
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={buttonClasses({ variant, size, fullWidth, className })} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

export interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export function ButtonLink({ variant = "primary", size = "md", leftIcon, rightIcon, fullWidth, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, fullWidth, className })} {...props}>
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}

/* ───────────── Icon-only buttons ───────────── */

export type IconButtonSize = "sm" | "md";

/**
 * Square hit areas. `sm` is 36px on desktop, `md` 40px; both grow to 44px on phones (< sm) and on
 * any coarse pointer so icon controls (close, dismiss, back, overflow) meet the touch-target rule
 * without changing desktop density.
 */
const ICON_SIZES: Record<IconButtonSize, string> = {
  sm: "h-9 w-9 rounded-lg max-sm:h-11 max-sm:w-11 pointer-coarse:h-11 pointer-coarse:w-11",
  md: "h-10 w-10 rounded-xl max-sm:h-11 max-sm:w-11 pointer-coarse:h-11 pointer-coarse:w-11",
};

/** Ghost variant is the icon-button default (muted glyph, surface hover) instead of the orange primary. */
const ICON_VARIANTS: Partial<Record<ButtonVariant, string>> = {
  ghost: "text-muted hover:bg-surface hover:text-ink",
  outline: "border border-line bg-white text-ink hover:border-navy/40 hover:bg-surface",
};

export function iconButtonClasses({ variant = "ghost", size = "md", className }: { variant?: ButtonVariant; size?: IconButtonSize; className?: string }) {
  return cn(
    "inline-flex shrink-0 items-center justify-center transition-colors duration-200 touch-manipulation select-none tap-highlight-none active:scale-95 disabled:pointer-events-none disabled:opacity-50",
    ICON_VARIANTS[variant] ?? VARIANTS[variant],
    ICON_SIZES[size],
    className
  );
}

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Required: icon-only controls must announce their purpose. */
  "aria-label": string;
  /** The glyph (e.g. `<X className="h-5 w-5" />`). */
  icon: React.ReactNode;
  /** `sm` 36px / `md` 40px on desktop; both 44px on phones and coarse pointers. */
  size?: IconButtonSize;
  /** Defaults to `ghost`. */
  variant?: ButtonVariant;
  /** Swap the icon for a spinner and disable the button. */
  loading?: boolean;
}

/** Icon-only button with a guaranteed 44px touch target on phones. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, size = "md", variant = "ghost", loading, className, disabled, type = "button", ...props },
  ref
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={iconButtonClasses({ variant, size, className })} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
    </button>
  );
});

export interface IconButtonLinkProps extends Omit<React.ComponentProps<typeof Link>, "children"> {
  "aria-label": string;
  icon: React.ReactNode;
  size?: IconButtonSize;
  variant?: ButtonVariant;
}

/** `IconButton` rendered as a Next `Link` (back arrows, "open in new" chevrons). */
export function IconButtonLink({ icon, size = "md", variant = "ghost", className, ...props }: IconButtonLinkProps) {
  return (
    <Link className={iconButtonClasses({ variant, size, className })} {...props}>
      {icon}
    </Link>
  );
}
