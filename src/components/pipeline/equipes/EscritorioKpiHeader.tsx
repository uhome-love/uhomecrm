/**
 * EscritorioKpiHeader — Nível 1 da aba Equipes (formato novo/nova gestão).
 * Hierarquia: SAÚDE DO PIPELINE (barra + % em dia) + NEGÓCIOS em destaque; leads/VGV
 * viram contexto. Números clicáveis: saúde → Leads filtrado; Negócios → aba Negócios.
 */
import { Handshake, TrendingUp, Users, ArrowRight } from "lucide-react";
import { fmtMoney } from "@/lib/fmtMoney";
import type { EquipesEscritorio } from "@/hooks/useEquipesView";

export type EquipesSaudeKey = "em_dia" | "atencao" | "desatualizado" | "estagnado";

export const SAUDE_META: Record<EquipesSaudeKey, { label: string; bar: string; dot: string; text: string }> = {
  em_dia: { label: "em dia", bar: "bg-emerald-500", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  atencao: { label: "atenção", bar: "bg-amber-500", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  desatualizado: { label: "desatualizado", bar: "bg-red-500", dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  estagnado: { label: "estagnado", bar: "bg-violet-500", dot: "bg-violet-500", text: "text-violet-600 dark:text-violet-400" },
};
const ORDER: EquipesSaudeKey[] = ["em_dia", "atencao", "desatualizado", "estagnado"];

export function HealthBar({ counts, h = "h-2" }: { counts: Record<EquipesSaudeKey, number>; h?: string }) {
  const total = ORDER.reduce((s, k) => s + (counts[k] || 0), 0) || 1;
  return (
    <div className={`flex ${h} w-full overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700`}>
      {ORDER.map((k) => {
        const pct = ((counts[k] || 0) / total) * 100;
        return pct > 0 ? <div key={k} className={SAUDE_META[k].bar} style={{ width: `${pct}%` }} title={`${counts[k]} ${SAUDE_META[k].label}`} /> : null;
      })}
    </div>
  );
}

export function SaudeStat({ k, n, big, onClick }: { k: EquipesSaudeKey; n: number; big?: boolean; onClick?: () => void }) {
  const s = SAUDE_META[k];
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Ver leads em ${s.label}`}
      className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-slate-50 dark:hover:bg-gray-800"
    >
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      <span className={`${big ? "text-[15px]" : "text-[13px]"} font-bold ${s.text}`}>{n.toLocaleString("pt-BR")}</span>
      <span className="text-[11px] text-slate-400 dark:text-slate-500">{s.label}</span>
    </button>
  );
}

interface Props {
  escritorio: EquipesEscritorio;
  onFilterSaude?: (k: EquipesSaudeKey) => void;
  onOpenNegocios?: () => void;
}

export default function EscritorioKpiHeader({ escritorio, onFilterSaude, onOpenNegocios }: Props) {
  const counts: Record<EquipesSaudeKey, number> = {
    em_dia: escritorio.em_dia, atencao: escritorio.atencao,
    desatualizado: escritorio.desatualizado, estagnado: escritorio.estagnado,
  };
  const total = ORDER.reduce((s, k) => s + (counts[k] || 0), 0);
  const emDiaPct = total > 0 ? Math.round((counts.em_dia / total) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Contexto (leads · pipeline · ganho no mês — o placar) */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
          <Users className="h-4 w-4 text-slate-400" /> {escritorio.total_leads_ativos.toLocaleString("pt-BR")} leads ativos
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <TrendingUp className="h-4 w-4 text-slate-400" /> Pipeline ativo {fmtMoney(escritorio.vgv_pipeline_ativo, "short")}
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
          <Handshake className="h-4 w-4" /> Ganho no mês {fmtMoney(escritorio.vgv_assinado_mes, "short")}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Saúde do pipeline — herói */}
        <div className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Saúde do pipeline</span>
            <span className="text-[12px] text-slate-400">{total.toLocaleString("pt-BR")} leads no funil</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{emDiaPct}%</span>
            <span className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">em dia</span>
          </div>
          <div className="mt-2"><HealthBar counts={counts} h="h-2.5" /></div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {ORDER.map((k) => (
              <SaudeStat key={k} k={k} n={counts[k]} big onClick={onFilterSaude ? () => onFilterSaude(k) : undefined} />
            ))}
          </div>
        </div>

        {/* Negócios — destaque, abre a aba */}
        <button
          type="button"
          onClick={onOpenNegocios}
          className="group text-left rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-gray-700"><Handshake className="h-4 w-4 text-slate-600 dark:text-slate-300" /></div>
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Negócios</span>
            <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{escritorio.negocios.toLocaleString("pt-BR")}</span>
            <span className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">{fmtMoney(escritorio.vgv_pipeline_ativo, "short")}</span>
          </div>
          <div className="text-[11px] text-slate-400">→ abre a aba Negócios</div>
        </button>
      </div>
    </div>
  );
}
