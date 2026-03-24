import { Card } from "@/components/ui/card";

export function KpiHighlightCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <Card className="overflow-hidden bg-[linear-gradient(135deg,#171720_0%,#202048_100%)] p-6 text-[var(--color-paper)]">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:rgba(241,239,232,0.6)]">
        {title}
      </div>
      <div className="mt-5 text-4xl leading-tight">{value}</div>
      <p className="mt-4 max-w-lg text-sm leading-7 text-[color:rgba(241,239,232,0.74)]">
        {note}
      </p>
    </Card>
  );
}
