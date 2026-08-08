import { fmtMoney } from "@/lib/fmtMoney";
import { AlertTriangle, FileSignature, TrendingUp, Wallet } from "lucide-react";
import type { ReactNode } from "react";

export type KpiFilter = null | "ganho" | "contrato" | "risco" | "negociacao";

type ResumoLike = {
  vgvTotal: number;
  forecast: number;
  emRisco: number;
  byGrupo: {
    ganho: { count: number; vgv: number };
    contrato: { count: number; vgv: number };
  };
};

export function PdnKpiCards({
  resumo, kpiFilter, onToggle,
}: {
  resumo: ResumoLike;
  kpiFilter: KpiFilter;
  onToggle: (k: KpiFilter) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <SummaryCard label="VGV Negociação+" value={fmtMoney(resumo.vgvTotal, "short")} sub="sem Pós-Visita" accent="text-foreground" icon={<Wallet className="h-4 w-4" />} active={kpiFilter === null} onClick={() => onToggle(null)} />
      <SummaryCard label="Ganhos" value={fmtMoney(resumo.byGrupo.ganho.vgv, "short")} sub={`${resumo.byGrupo.ganho.count} negócios`} accent="text-emerald-500" icon={<FileSignature className="h-4 w-4" />} active={kpiFilter === "ganho"} onClick={() => onToggle("ganho")} />
      <SummaryCard label="Contrato" value={fmtMoney(resumo.byGrupo.contrato.vgv, "short")} sub={`${resumo.byGrupo.contrato.count} contratos`} accent="text-cyan-500" active={kpiFilter === "contrato"} onClick={() => onToggle("contrato")} />
      <SummaryCard label="Forecast ponderado" value={fmtMoney(resumo.forecast, "short")} accent="text-primary" icon={<TrendingUp className="h-4 w-4" />} active={kpiFilter === "negociacao"} onClick={() => onToggle("negociacao")} />
      <SummaryCard label="Em risco" value={String(resumo.emRisco)} sub="parados +7d" accent="text-amber-500" icon={<AlertTriangle className="h-4 w-4" />} active={kpiFilter === "risco"} onClick={() => onToggle("risco")} />
    </div>
  );
}

function SummaryCard({ label, value, sub, accent, icon, active, onClick }: {
  label: string; value: string; sub?: string; accent: string; icon?: ReactNode; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border bg-card p-3 text-left transition hover:shadow-sm ${active ? "border-primary ring-1 ring-primary" : "border-border"}`}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>{icon && <span className={accent}>{icon}</span>}
      </div>
      <div className={`mt-1 text-lg font-bold ${accent}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </button>
  );
}
