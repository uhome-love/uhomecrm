// ─────────────────────────────────────────────────────────────────
// AlertasGerente — bloco do Cockpit do Gerente. Duas prioridades:
//  · Negócios em risco (empurrar) — as propostas que somem, por VGV.
//  · Corretor sem próxima ação (cobrar) — o sinal de "sem organização".
// Fonte única: RPC get_gerente_alertas (escopo do gerente).
// ─────────────────────────────────────────────────────────────────
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTabContext } from "@/contexts/TabContext";
import { fmtMoney } from "@/lib/fmtMoney";
import { Handshake, UserX, ArrowRight, AlertTriangle } from "lucide-react";

type Negocio = {
  negocio_id: string; cliente: string | null; empreendimento: string | null;
  corretor: string | null; vgv: number | null; situacao: string | null;
  dias_parado: number; lead_id: string | null;
};
type Corretor = { corretor: string | null; sem_proxima: number; sem_contato: number };
type Alertas = { negocios_risco: Negocio[]; corretores_sem_acao: Corretor[] };

const cardCls = "group rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4";
const NEGOCIOS_TAB = "/pipeline-leads?tab=negocios";

export default function AlertasGerente() {
  const { openTab } = useTabContext();
  const { data, isLoading } = useQuery({
    queryKey: ["gerente-alertas"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_gerente_alertas");
      if (error) throw error;
      return data as unknown as Alertas;
    },
  });

  if (isLoading) return <div className="grid gap-3 lg:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-gray-800" />)}</div>;

  const negocios = data?.negocios_risco || [];
  const corretores = data?.corretores_sem_acao || [];

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {/* Negócios em risco */}
      <div className={cardCls}>
        <div className="flex items-center gap-2">
          <Handshake className="h-4 w-4 text-amber-600" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Negócios em risco · empurrar</span>
          {negocios.length > 0 && <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">{negocios.length}</span>}
        </div>
        {negocios.length === 0 ? (
          <p className="mt-3 text-[13px] text-slate-500 dark:text-slate-400">Nenhum negócio em negociação agora.</p>
        ) : (
          <div className="mt-2.5 space-y-1.5">
            {negocios.map((n) => (
              <button
                key={n.negocio_id}
                onClick={() => openTab(n.lead_id ? `/pipeline-leads?tab=kanban&lead=${n.lead_id}` : NEGOCIOS_TAB)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{n.cliente || "Sem nome"}</span>
                    <span className="shrink-0 text-[12px] font-extrabold text-emerald-600 dark:text-emerald-400">{fmtMoney(n.vgv || 0, "short")}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span className="max-w-[8rem] truncate">{n.empreendimento || "—"}</span>
                    <span className="truncate">· {n.corretor || "—"}</span>
                    {n.dias_parado >= 3 && (
                      <span className="inline-flex items-center gap-0.5 font-semibold text-red-600 dark:text-red-400"><AlertTriangle className="h-3 w-3" /> {n.dias_parado}d parado</span>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-slate-500" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Corretor sem próxima ação */}
      <div className={cardCls}>
        <div className="flex items-center gap-2">
          <UserX className="h-4 w-4 text-red-500" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Corretor sem próxima ação · cobrar</span>
        </div>
        {corretores.length === 0 ? (
          <p className="mt-3 text-[13px] text-slate-500 dark:text-slate-400">Time em dia, todo lead com próximo passo. 🎯</p>
        ) : (
          <div className="mt-2.5 space-y-1.5">
            {corretores.map((c) => (
              <div key={c.corretor || Math.random()} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{c.corretor || "—"}</span>
                <span className="shrink-0 text-[12px] font-bold text-red-600 dark:text-red-400">{c.sem_proxima}<span className="ml-1 text-[10px] font-medium text-slate-400">sem próximo passo</span></span>
                {c.sem_contato > 0 && <span className="shrink-0 text-[11px] font-semibold text-amber-600 dark:text-amber-400">{c.sem_contato}<span className="ml-0.5 text-[10px] font-medium text-slate-400">s/ contato</span></span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
