import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "navy" | "white" | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * One control family: every variant shares the geometry, the 150ms press and the focus treatment —
 * only colour changes. `ring-focus` is the product-wide focus ring; `white` sits on navy/photography
 * so it takes `ring-focus-inverse` instead.
 *
 * Buttons carry NO elevation. A button in the page flow is not raised, and the one genuinely floating
 * button (`Fab`) owns `shadow-e3` itself. This is why the old ad-hoc `shadow-sm` is gone.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-orange text-white hover:bg-orange-hover ring-focus",
  secondary: "bg-lavender text-navy hover:bg-navy-soft ring-focus",
  navy: "bg-navy text-white hover:bg-navy-dark ring-focus",
  outline: "border border-line bg-white text-ink hover:border-navy/40 hover:bg-surface ring-focus",
  ghost: "text-ink hover:bg-surface ring-focus",
  danger: "bg-danger text-white hover:bg-danger/90 ring-focus",
  white: "bg-white text-navy hover:bg-lavender ring-focus-inverse",
  link: "text-orange underline-offset-4 hover:underline ring-focus",
};

/**
 * Mobile-first heights: every size is at least 44px on phones (< sm), desktop keeps its compact height.
 * Radius is the token scale's `md` (12px) at every size — a button reads as one shape across the product.
 */
const SIZES: Record<ButtonSize, string> = {
  xs: "h-9 sm:h-8 px-3 text-xs gap-1.5 rounded-md",
  sm: "h-11 sm:h-9 px-4 sm:px-3.5 text-sm gap-2 rounded-md",
  md: "h-12 sm:h-11 px-5 text-base sm:text-sm gap-2 rounded-md",
  lg: "h-13 sm:h-12 px-6 text-base gap-2.5 rounded-md",
  xl: "h-14 px-8 text-base gap-3 rounded-md",
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
    // `relative` anchors the loading spinner over the (still measured) label — see Button below.
    // The base focus-visible ring is neutralised here so `ring-focus` is the single focus treatment.
    "relative inline-flex items-center justify-center font-semibold whitespace-nowrap select-none touch-manipulation tap-highlight-none",
    "transition duration-micro active:scale-[0.98] motion-reduce:transition-none",
    "focus-visible:ring-0 focus-visible:ring-offset-0",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    // A text link keeps the 44px tap height but never the horizontal padding.
    variant === "link" && "px-0",
    fullWidth && "w-full",
    className
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, leftIcon, rightIcon, fullWidth, className, children, disabled, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {/*
       * Loading keeps the label in the layout (`invisible`, not unmounted) so the button does not
       * change width mid-submit and drag the rest of the form with it.
       */}
      {loading && (
        <span className="absolute inset-0 inline-flex items-center justify-center" aria-hidden>
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      )}
      {leftIcon && (loading ? <span className="invisible inline-flex items-center">{leftIcon}</span> : leftIcon)}
      {loading ? <span className="invisible">{children}</span> : children}
      {rightIcon && (loading ? <span className="invisible inline-flex items-center">{rightIcon}</span> : rightIcon)}
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
 * without changing desktop density. Radius matches the button scale (`md`, 12px).
 */
const ICON_SIZES: Record<IconButtonSize, string> = {
  sm: "h-9 w-9 rounded-md max-sm:h-11 max-sm:w-11 pointer-coarse:h-11 pointer-coarse:w-11",
  md: "h-10 w-10 rounded-md max-sm:h-11 max-sm:w-11 pointer-coarse:h-11 pointer-coarse:w-11",
};

/** Ghost variant is the icon-button default (muted glyph, surface hover) instead of the orange primary. */
const ICON_VARIANTS: Partial<Record<ButtonVariant, string>> = {
  ghost: "text-muted hover:bg-surface hover:text-ink ring-focus",
  outline: "border border-line bg-white text-ink hover:border-navy/40 hover:bg-surface ring-focus",
};

export function iconButtonClasses({ variant = "ghost", size = "md", className }: { variant?: ButtonVariant; size?: IconButtonSize; className?: string }) {
  return cn(
    "relative inline-flex shrink-0 items-center justify-center select-none touch-manipulation tap-highlight-none",
    "transition duration-micro active:scale-95 motion-reduce:transition-none",
    "focus-visible:ring-0 focus-visible:ring-offset-0",
    "disabled:pointer-events-none disabled:opacity-50",
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
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={iconButtonClasses({ variant, size, className })}
      {...props}
    >
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
