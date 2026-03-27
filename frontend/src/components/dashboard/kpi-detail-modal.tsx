"use client";

import { Card } from "@/components/ui/card";
import type { LiveKpiCard } from "@/types/live-kpi-dashboard";
import { KpiModalChart } from "@/components/dashboard/kpi-modal-chart";
import { KpiModalDailyList } from "@/components/dashboard/kpi-modal-daily-list";

type KpiDetailModalProps = {
  card: LiveKpiCard;
  onClose: () => void;
};

export function KpiDetailModal({ card, onClose }: KpiDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color:rgba(22,22,30,0.58)] px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        aria-modal="true"
        className="w-full max-w-5xl rounded-[32px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,239,232,0.98))] p-6 shadow-[var(--shadow-panel)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-muted)]">
              detalhe do KPI
            </div>
            <h2 className="mt-3 text-4xl leading-[0.94] text-[var(--color-ink)]">
              {card.modal.title}
            </h2>
          </div>
          <button
            aria-label="Fechar modal"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--color-line)] bg-white text-xl text-[var(--color-ink)]"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Periodo ativo
            </div>
            <div className="mt-3 text-lg font-semibold text-[var(--color-ink)]">
              {card.modal.periodLabel}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Seller
            </div>
            <div className="mt-3 text-lg font-semibold text-[var(--color-ink)]">
              {card.modal.sellerLabel}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Quantidade
            </div>
            <div className="mt-3 text-lg font-semibold text-[var(--color-ink)]">
              {card.modal.countLabel}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Valor
            </div>
            <div className="mt-3 text-lg font-semibold text-[var(--color-navy)]">
              {card.modal.valueLabel}
            </div>
          </Card>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <KpiModalChart points={card.modal.dailySeries} />
          <KpiModalDailyList points={card.modal.dailySeries} />
        </div>

        {card.modal.channelBreakdown && card.modal.channelBreakdown.length > 0 ? (
          <div className="mt-6">
            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Canais
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {card.modal.channelBreakdown.map((item) => (
                <Card key={item.label} className="p-4">
                  <div className="text-sm font-semibold text-[var(--color-ink)]">{item.label}</div>
                  <div className="mt-2 text-xs text-[var(--color-muted)]">
                    {item.count > 0 ? `Quantidade: ${item.count.toLocaleString("pt-BR")}` : "Resumo"}
                  </div>
                  <div className="mt-3 text-lg font-semibold text-[var(--color-navy)]">
                    {item.value}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
