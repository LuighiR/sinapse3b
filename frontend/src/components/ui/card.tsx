import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-[color:var(--color-line)] bg-white/72 shadow-[var(--shadow-card)] backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}
