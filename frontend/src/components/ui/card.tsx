import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-[color:var(--color-line)] bg-white shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}
