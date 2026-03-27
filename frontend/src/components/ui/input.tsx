import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4 text-sm text-[var(--color-ink)] outline-none transition placeholder:text-[color:var(--color-muted)] focus:border-[color:rgba(83,104,217,0.42)] focus:bg-white focus:ring-4 focus:ring-[color:rgba(83,104,217,0.1)]",
        className,
      )}
      {...props}
    />
  );
}
