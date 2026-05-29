/**
 * EscritorioKpiHeader — Nível 1 da aba Equipes: 4 KPIs globais do escritório.
 */
import { Users, AlertTriangle, Handshake, TrendingUp } from "lucide-react";
import { fmtMoney } from "@/lib/fmtMoney";
import type { EquipesEscritorio } from "@/hooks/useEquipesView";

interface Props {
  escritorio: EquipesEscritorio;
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone}`}>{icon}</div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 dark:text-slate-400">{sub}</div>}
    </div>
  );
}

export default function EscritorioKpiHeader({ escritorio }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        icon={<Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
        tone="bg-indigo-50 dark:bg-indigo-950"
        label="Leads Ativos"
        value={escritorio.total_leads_ativos.toLocaleString("pt-BR")}
      />
      <KpiCard
        icon={<AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
        tone="bg-amber-50 dark:bg-amber-950"
        label="Atrasados"
        value={escritorio.atrasados.toLocaleString("pt-BR")}
      />
      <KpiCard
        icon={<Handshake className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
        tone="bg-emerald-50 dark:bg-emerald-950"
        label="Em Fechamento"
        value={escritorio.negocios.toLocaleString("pt-BR")}
      />
      <KpiCard
        icon={<TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
        tone="bg-violet-50 dark:bg-violet-950"
        label="VGV"
        value={fmtMoney(escritorio.vgv_assinado_mes, "short")}
        sub={`Pipeline ativo: ${fmtMoney(escritorio.vgv_pipeline_ativo, "short")}`}
      />
    </div>
  );
}
