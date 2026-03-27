"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { LiveKpiCard } from "@/types/live-kpi-dashboard";

type KpiStatCardProps = {
  card: LiveKpiCard;
  onOpen: (card: LiveKpiCard) => void;
};

const toneClasses: Record<LiveKpiCard["tone"], string> = {
  navy: "text-[var(--color-navy)]",
  accent: "text-[#3B5BDB]",
  success: "text-[#13795B]",
  danger: "text-[#B42318]",
  neutral: "text-[var(--color-ink)]",
};

export function KpiStatCard({ card, onOpen }: KpiStatCardProps) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              KPI
            </div>
            <div className="mt-2 text-lg font-semibold text-[var(--color-ink)]">{card.label}</div>
          </div>
          <div
            className={cn(
              "rounded-xl bg-[var(--color-paper)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]",
              toneClasses[card.tone],
            )}
          >
            indicador
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-[var(--color-muted)]">
            {card.quantityLabel}
          </div>
        </div>

        <div className={cn("text-[2rem] font-semibold tracking-[-0.05em]", toneClasses[card.tone])}>
          {card.amount}
        </div>

        <Button
          aria-label={`Ver mais sobre ${card.label}`}
          className="w-full"
          onClick={() => onOpen(card)}
          variant="secondary"
        >
          Ver mais
        </Button>
      </div>
    </Card>
  );
}
