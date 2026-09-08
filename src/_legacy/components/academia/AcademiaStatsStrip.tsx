import { cn } from "@/lib/utils";

interface Props {
  aulasConcluidas: number;
  aulasTotal: number;
  xp: number;
  trilhasConcluidas: number;
  certificados: number;
}

function Stat({ value, label, className }: { value: string | number; label: string; className?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className={cn("text-xl font-black text-foreground", className)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

export function AcademiaStatsStrip({ aulasConcluidas, aulasTotal, xp, trilhasConcluidas, certificados }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Stat value={`${aulasConcluidas}/${aulasTotal}`} label="Aulas concluídas" />
      <Stat value={xp} label="XP acumulado" className="text-amber-500" />
      <Stat value={trilhasConcluidas} label="Módulos concluídos" className="text-emerald-500" />
      <Stat value={certificados} label="Certificados" className="text-purple-500" />
    </div>
  );
}
