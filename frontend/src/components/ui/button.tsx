import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[var(--color-navy)] text-[var(--color-paper)] shadow-[var(--shadow-card)] hover:bg-[#29295b]",
  secondary:
    "border border-[color:var(--color-line)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-paper)]",
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
        "inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold tracking-[0.01em] transition duration-200 disabled:pointer-events-none disabled:opacity-60",
        variantClasses[variant],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
