import { cn } from "@/lib/cn";

type SinapseHubLogoProps = {
  className?: string;
  compact?: boolean;
};

export function SinapseHubLogo({
  className,
  compact = false,
}: SinapseHubLogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <span className="sr-only">Sinapse Hub</span>
      <svg
        aria-hidden="true"
        className={cn("shrink-0", compact ? "h-11 w-8" : "h-14 w-10")}
        viewBox="0 0 74 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="52" cy="18" r="14" fill="currentColor" />
        <circle cx="26" cy="55" r="20" fill="currentColor" />
        <circle cx="50" cy="92" r="18" fill="currentColor" />
        <path
          d="M39 29C35 39 28 39 24 39C13 39 4 48 4 59C4 70 13 79 24 79C28 79 35 79 39 89"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="11"
        />
      </svg>
      <div className="flex flex-col leading-none">
        <span className={cn("font-[var(--font-display)] tracking-[-0.08em]", compact ? "text-2xl" : "text-4xl")}>
          SINAPSE
        </span>
        <span className={cn("font-[var(--font-display)] tracking-[-0.08em]", compact ? "text-xl" : "text-3xl")}>
          HUB
        </span>
      </div>
    </div>
  );
}
