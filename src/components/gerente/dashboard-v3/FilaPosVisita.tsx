// ─────────────────────────────────────────────────────────────────
// FilaPosVisita — bloco do Cockpit do Gerente. A fila dos leads que
// voltaram da visita, ordenada por prioridade (quer proposta → temperatura
// → mais parado), com objeção e próximo passo. Fonte única: RPC
// get_gerente_fila_pos_visita (escopo do gerente).
// ─────────────────────────────────────────────────────────────────
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTabContext } from "@/contexts/TabContext";
import { ClipboardCheck, ArrowRight, AlertTriangle } from "lucide-react";

type FilaItem = {
  lead_id: string;
  cliente: string | null;
  corretor: string | null;
  empreendimento: string | null;
  resultado: string | null;
  objecao: string | null;
  temperatura: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  sem_proximo_passo: boolean;
  dias: number;
};

const RES: Record<string, { label: string; cls: string }> = {
  gostou_quer_proposta: { label: "Quer proposta", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  gostou_vai_pensar: { label: "Vai pensar", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  quer_ver_outro: { label: "Ver outras", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  continuar_visitando: { label: "Continuar", cls: "bg-slate-100 text-slate-600 dark:bg-gray-700 dark:text-slate-300" },
  nao_gostou: { label: "Não gostou", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};
const TEMP: Record<string, string> = { muito_quente: "🔥", quente: "⚡", morno: "🌡️", frio: "🧊" };

function fmtData(d: string | null): string {
  if (!d) return "";
  const p = d.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}` : d;
}

export default function FilaPosVisita() {
  const { openTab } = useTabContext();
  const { data, isLoading } = useQuery({
    queryKey: ["gerente-fila-pos-visita"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_gerente_fila_pos_visita");
      if (error) throw error;
      return (data as unknown as FilaItem[]) || [];
    },
  });

  const objSummary = useMemo(() => {
    const m = new Map<string, number>();
    (data || []).forEach((i) => { if (i.objecao) m.set(i.objecao, (m.get(i.objecao) || 0) + 1); });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const cardCls = "group rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4";

  if (isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-gray-800" />;
  const itens = data || [];

  return (
    <div className={cardCls}>
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-indigo-600" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pós-visita · atacar agora</span>
        {itens.length > 0 && <span className="ml-auto rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">{itens.length}</span>}
      </div>

      {itens.length === 0 ? (
        <p className="mt-3 text-[13px] text-slate-500 dark:text-slate-400">Nenhum lead aguardando no pós-visita. 🎉</p>
      ) : (
        <>
          {objSummary.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {objSummary.map(([o, n]) => (
                <span key={o} className="rounded-full bg-slate-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">{n} {o.toLowerCase()}</span>
              ))}
            </div>
          )}
          <div className="mt-2.5 space-y-1.5">
            {itens.map((i) => {
              const res = i.resultado ? RES[i.resultado] : null;
              return (
                <button
                  key={i.lead_id}
                  onClick={() => openTab(`/pipeline-leads?tab=kanban&lead=${i.lead_id}`)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="text-base leading-none">{i.temperatura && TEMP[i.temperatura] ? TEMP[i.temperatura] : "•"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{i.cliente || "Sem nome"}</span>
                      {res && <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${res.cls}`}>{res.label}</span>}
                      {i.objecao && <span className="shrink-0 rounded-full bg-slate-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-300">{i.objecao}</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="max-w-[7rem] truncate">{i.corretor || "—"}</span>
                      {i.sem_proximo_passo ? (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-red-600 dark:text-red-400"><AlertTriangle className="h-3 w-3" /> sem próximo passo</span>
                      ) : (
                        <span className="truncate">· {i.proxima_acao || "próximo passo"}{i.data_proxima_acao ? ` · ${fmtData(i.data_proxima_acao)}` : ""}</span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-slate-500" />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
