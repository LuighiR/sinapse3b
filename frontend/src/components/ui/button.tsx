import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[linear-gradient(135deg,var(--color-navy),#39398A)] text-[var(--color-paper)] shadow-[var(--shadow-soft)] hover:translate-y-[-1px] hover:shadow-[0_24px_56px_rgba(22,22,30,0.22)]",
  secondary:
    "border border-[color:var(--color-line)] bg-white/70 text-[var(--color-ink)] hover:bg-white",
  ghost:
    "bg-transparent text-[var(--color-ink)] hover:bg-[color:var(--color-accent-soft)]",
};

export function Button({
  className,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold tracking-[0.02em] transition duration-200 disabled:pointer-events-none disabled:opacity-60",
        variantClasses[variant],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
