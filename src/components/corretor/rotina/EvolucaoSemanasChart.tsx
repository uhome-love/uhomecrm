import { useMinhaEvolucao } from "@/hooks/useMinhaEvolucao";
import { cn } from "@/lib/utils";

export default function EvolucaoSemanasChart() {
  const { data } = useMinhaEvolucao();
  if (!data) return null;
  const max = Math.max(data.meta, ...data.semanas.map((s) => s.visitas), 1);
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold text-foreground">Minha evolução (últimas 4 semanas)</h2>
      <div className="mt-3 flex h-28 items-end gap-3">
        {data.semanas.map((s) => (
          <div key={s.inicio} className="flex flex-1 flex-col items-center justify-end gap-1 h-full">
            <span className="text-xs font-bold text-foreground">{s.visitas}</span>
            <div
              className={cn("w-full rounded-md", s.atual ? "bg-primary/50" : s.visitas >= data.meta ? "bg-primary" : "bg-primary/25")}
              style={{ height: `${Math.max(4, (s.visitas / max) * 80)}%` }}
            />
            <span className="text-[11px] text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Visitas realizadas por semana (meta: {data.meta}) · fechamento toda segunda às 00h05
      </p>
    </section>
  );
}
