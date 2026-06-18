/**
 * GestorCard — Nível 2 da aba Equipes: card comparativo de um gestor.
 *
 * Mostra: avatar + nome + N corretores, barra de meta mensal (assinado/meta),
 * VGV pipeline ativo como número secundário, e KPIs (leads/atrasados/negócios).
 * Click no header expande/colapsa o drilldown de corretores (children).
 */
import { ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fmtMoney } from "@/lib/fmtMoney";
import { getGestorTheme } from "./gestorTheme";
import type { EquipesGestor } from "@/hooks/useEquipesView";

interface Props {
  gestor: EquipesGestor;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function iniciais(nome: string | null): string {
  if (!nome) return "?";
  return nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export default function GestorCard({ gestor, expanded, onToggle, children }: Props) {
  const theme = getGestorTheme(gestor.auth_id);
  const metaPct = gestor.meta_pct;
  const showMeta = gestor.meta_vgv != null && gestor.meta_vgv > 0;
  const pipelinePct =
    gestor.meta_vgv && gestor.meta_vgv > 0
      ? Math.round((gestor.vgv_pipeline_ativo / gestor.meta_vgv) * 100)
      : null;

  return (
    <div className={`rounded-xl border ${theme.ring} bg-white dark:bg-gray-800 overflow-hidden`}>
      {/* Header clicável */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-gray-700/40 transition"
      >
        <Avatar className="h-10 w-10">
          {gestor.avatar_url && <AvatarImage src={gestor.avatar_url} alt={gestor.nome ?? ""} />}
          <AvatarFallback className={theme.avatarBg}>{iniciais(gestor.nome)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${theme.dot}`} />
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
              {gestor.nome ?? "—"}
            </span>
            {gestor.equipe_inativa && (
              <span className="shrink-0 rounded-full bg-slate-200 dark:bg-gray-700 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Inativa
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {gestor.qtd_corretores} corretores
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Meta mensal */}
      <div className="px-4 pb-3">
        {showMeta ? (
          <>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Meta do mês
              </span>
              <span className={`font-bold ${theme.accentText}`}>{metaPct ?? 0}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full ${theme.bar} transition-all`}
                style={{ width: `${Math.min(100, Math.max(0, metaPct ?? 0))}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {fmtMoney(gestor.vgv_assinado_mes, "short")} / {fmtMoney(gestor.meta_vgv, "short")}
            </div>
          </>
        ) : (
          <div className="text-[11px] text-slate-400 italic">Meta do mês não configurada</div>
        )}
      </div>

      {/* Pipeline ativo + KPIs */}
      <div className="px-4 pb-4 space-y-1.5">
        <div className="text-[12px] text-slate-600 dark:text-slate-300">
          Pipeline ativo:{" "}
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {fmtMoney(gestor.vgv_pipeline_ativo, "short")}
          </span>
          {pipelinePct != null && (
            <span className={`ml-1 font-medium ${theme.accentText}`}>({pipelinePct}%)</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{gestor.total_leads}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Leads</div>
          </div>
          <div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{gestor.atrasados}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Atrasados</div>
          </div>
          <div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{gestor.negocios}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Negócios</div>
          </div>
        </div>
      </div>

      {/* Drilldown nível 3 */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/30 p-3 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}
