"use client";

import { SinapseHubLogo } from "@/components/ui/sinapse-hub-logo";
import { cn } from "@/lib/cn";

type LoginTransitionOverlayProps = {
  active: boolean;
};

export function LoginTransitionOverlay({
  active,
}: LoginTransitionOverlayProps) {
  if (!active) {
    return null;
  }

  return (
    <div
      aria-hidden={false}
      className={cn(
        "pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-[var(--radius-shell)] bg-[linear-gradient(160deg,rgba(22,22,30,0.88),rgba(32,32,72,0.92))] px-6 text-[var(--color-paper)] opacity-0 transition duration-500",
        active && "pointer-events-auto opacity-100",
      )}
    >
      <div className="flex flex-col items-center gap-6 text-center animate-[sinapse-rise_540ms_ease-out_forwards]">
        <SinapseHubLogo compact className="text-[var(--color-paper)]" />
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.26em] text-[color:rgba(241,239,232,0.6)]">
            carregando cockpit
          </div>
          <p className="mt-3 max-w-xs text-sm leading-7 text-[color:rgba(241,239,232,0.78)]">
            Preparando o resumo de orcamentos e a visao executiva inicial.
          </p>
        </div>
      </div>
    </div>
  );
}
