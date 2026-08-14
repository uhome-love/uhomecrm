// ─────────────────────────────────────────────────────────────────
// Produtividade · Gerente · Dia — "o corretor foi produtivo hoje?".
// Veredito na cor (Situação) + % do dever + colunas separadas (Dever / Resultado).
// DADOS REAIS via RPC get_produtividade_gerente_dia (fonte única, escopo do gerente).
// ─────────────────────────────────────────────────────────────────
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";
import { Activity, TrendingUp } from "lucide-react";

type Situacao = "produtivo" | "atencao" | "parado" | "sem_demanda";

interface CorretorRow {
  nome: string;
  presente: boolean;
  situacao: Situacao;
  dever_pct: number | null;
  toques: number;
  prio_at: number; prio_esp: number;
  vis_ag: number; avancos: number; vis_real: number;
}
interface ProdData {
  data: string;
  total: number;
  presentes: number;
  placar: { produtivo: number; atencao: number; parado: number; presente_parado: number; sem_demanda: number };
  corretores: CorretorRow[];
}

const SIT: Record<Situacao, { label: string; text: string; soft: string }> = {
  produtivo:   { label: "Produtivo",   text: "text-emerald-600 dark:text-emerald-400", soft: "bg-emerald-500/12" },
  atencao:     { label: "Atenção",     text: "text-amber-600 dark:text-amber-400",     soft: "bg-amber-500/12" },
  parado:      { label: "Parado",      text: "text-red-600 dark:text-red-400",         soft: "bg-red-500/12" },
  sem_demanda: { label: "Sem demanda", text: "text-muted-foreground",                   soft: "bg-muted" },
};

/** yyyy-mm-dd no fuso BRT, com offset de dias. */
function brtDate(offsetDias = 0): string {
  const base = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  base.setDate(base.getDate() + offsetDias);
  const y = base.getFullYear(), m = String(base.getMonth() + 1).padStart(2, "0"), d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function pctColor(p: number): string {
  if (p >= 70) return "#16a34a";
  if (p >= 40) return "#d97706";
  return "#dc2626";
}

/** Célula feito/esperado. Verde se cumpriu, âmbar se faltou, vermelho se zerou, — se não havia. */
function Ratio({ feito, esperado }: { feito: number; esperado: number }) {
  if (esperado === 0) return <span className="text-muted-foreground/40">—</span>;
  const cor = feito >= esperado ? "text-emerald-600 dark:text-emerald-400" : feito > 0 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  return (
    <span className="tabular-nums">
      <span className={cn("font-semibold", cor)}>{feito}</span>
      <span className="text-muted-foreground/60 text-[10px]">/{esperado}</span>
    </span>
  );
}

/** Número de resultado (avanço/visita). Zero apagado. */
function ResNum({ v }: { v: number }) {
  if (v === 0) return <span className="text-muted-foreground/40">0</span>;
  return <span className="font-semibold text-teal-700 dark:text-teal-300 tabular-nums">{v}</span>;
}

function PlacarCard({ n, label, tone }: { n: number; label: string; tone: "green" | "amber" | "red" }) {
  const c = tone === "green" ? "text-emerald-600 dark:text-emerald-400" : tone === "amber" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  const border = tone === "red" ? "border-red-300/60 dark:border-red-500/30" : "border-border/60";
  return (
    <div className={cn("rounded-xl border bg-background/70 px-4 py-3 text-center", border)}>
      <div className={cn("text-2xl font-extrabold leading-none", c)}>{n}</div>
      <div className={cn("mt-1 text-[11px]", tone === "red" ? c : "text-muted-foreground")}>{label}</div>
    </div>
  );
}

export default function Produtividade() {
  const { user } = useAuth();
  const [offset, setOffset] = useState(0); // 0 = hoje, -1 = ontem
  const dataRef = brtDate(offset);

  const { data, isLoading, error } = useQuery({
    queryKey: ["produtividade-gerente-dia", dataRef, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_produtividade_gerente_dia" as any, { p_data: dataRef });
      if (error) throw error;
      return data as unknown as ProdData;
    },
    staleTime: 30_000,
  });

  const corretores = data?.corretores ?? [];
  const placar = data?.placar;

  const subtitle = useMemo(() => {
    const d = new Date(dataRef + "T12:00:00");
    const txt = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    return offset === 0 ? `Hoje até agora · ${txt}` : txt;
  }, [dataRef, offset]);

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-slate-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl p-4 space-y-4">
        <PageHeader
          title="Produtividade do time"
          subtitle="Quem atendeu a agenda de prioridades do dia — e quem só esteve presente."
          icon={<Activity size={18} strokeWidth={1.5} />}
          actions={
            <div className="flex gap-1 rounded-full border border-border/60 bg-background p-1">
              {[{ o: 0, l: "Hoje" }, { o: -1, l: "Ontem" }].map((b) => (
                <button
                  key={b.o}
                  onClick={() => setOffset(b.o)}
                  className={cn("rounded-full px-3 h-7 text-xs font-semibold transition-colors",
                    offset === b.o ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >{b.l}</button>
              ))}
            </div>
          }
        />

        <p className="text-xs text-muted-foreground -mt-2 capitalize">{subtitle}</p>

        {/* Placar */}
        {placar && (
          <div className="grid grid-cols-3 gap-3">
            <PlacarCard n={placar.produtivo} label="Produtivos" tone="green" />
            <PlacarCard n={placar.atencao} label="Precisam melhorar" tone="amber" />
            <PlacarCard n={placar.presente_parado} label="Presente e parado" tone="red" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-300/60 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            Não foi possível carregar. {(error as any)?.message === "Acesso negado" ? "Esta visão é para gerentes/diretoria." : "Tente novamente."}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-gray-800" />)}</div>
        ) : corretores.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 py-14 text-center">
            <TrendingUp className="mx-auto h-6 w-6 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Nenhum corretor no time (ou nada registrado no dia).</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-background overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[760px] text-[12px] border-collapse">
                <thead>
                  <tr className="text-[9.5px] uppercase tracking-wider text-center">
                    <th className="bg-muted/40" colSpan={6}></th>
                    <th className="bg-teal-500/[0.07] text-teal-700 dark:text-teal-300 font-bold py-2 border-l-2 border-background" colSpan={2}>Resultado</th>
                  </tr>
                  <tr className="bg-muted/40 text-[10px] text-muted-foreground text-center">
                    <th className="text-left font-medium px-3 py-2.5">Corretor</th>
                    <th className="font-semibold text-foreground/70 px-2">Situação</th>
                    <th className="font-medium px-2 w-[112px] leading-tight">% do dever<br/><span className="font-normal text-[8px]">(prioridades)</span></th>
                    <th className="font-medium px-2 leading-tight" title="Leads com atividade registrada hoje (esforço total, mesmo fora da prioridade)">Atividades<br/>hoje</th>
                    <th className="font-medium px-2 py-2 bg-primary/[0.04] border-l-2 border-background leading-tight" title="Prioridades da agenda que ele atendeu hoje / total que tinha de manhã">Prioridades<br/>atendidas</th>
                    <th className="font-medium px-2 leading-tight">Visita<br/>agendada</th>
                    <th className="font-medium px-2 bg-teal-500/[0.04] border-l-2 border-background leading-tight">Avanços<br/>de etapa</th>
                    <th className="font-medium px-2 bg-teal-500/[0.04] leading-tight">Visitas<br/>realiz.</th>
                  </tr>
                </thead>
                <tbody>
                  {corretores.map((c, i) => {
                    const sit = SIT[c.situacao];
                    const alerta = c.situacao === "parado" && c.presente;
                    const semDem = c.situacao === "sem_demanda";
                    return (
                      <tr key={i} className={cn("border-t border-border/50", alerta && "bg-red-50/60 dark:bg-red-950/10")}>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle", c.presente ? "bg-emerald-500" : "bg-muted-foreground/30")} title={c.presente ? "Presente" : "Ausente"} />
                          <span className={cn("font-medium align-middle", semDem && "text-muted-foreground")}>{c.nome}</span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className={cn("inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap", sit.text, sit.soft)}>{sit.label}</span>
                        </td>
                        <td className="px-2 py-3">
                          {c.dever_pct == null ? <span className="text-muted-foreground/40 text-center block">—</span> : (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-[5px] rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${c.dever_pct}%`, background: pctColor(c.dever_pct) }} />
                              </div>
                              <span className="text-[11px] font-semibold tabular-nums min-w-[26px] text-right" style={{ color: pctColor(c.dever_pct) }}>{c.dever_pct}%</span>
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-3 text-center">{c.toques === 0 ? <span className="text-muted-foreground/40">0</span> : <span className="tabular-nums text-foreground/70">{c.toques}</span>}</td>
                        <td className="px-2 py-3 text-center bg-primary/[0.02] border-l-2 border-background"><Ratio feito={c.prio_at} esperado={c.prio_esp} /></td>
                        <td className="px-2 py-3 text-center">
                          {semDem ? <span className="text-muted-foreground/40">—</span> : c.vis_ag >= 1
                            ? <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓ {c.vis_ag}</span>
                            : <span className="text-amber-600 dark:text-amber-400">0</span>}
                        </td>
                        <td className="px-2 py-3 text-center bg-teal-500/[0.03] border-l-2 border-background"><ResNum v={c.avancos} /></td>
                        <td className="px-2 py-3 text-center bg-teal-500/[0.03]"><ResNum v={c.vis_real} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-muted-foreground">
          <span><b className="text-emerald-600 dark:text-emerald-400">● Produtivo</b> cumpriu o dever</span>
          <span><b className="text-amber-600 dark:text-amber-400">● Atenção</b> mexeu pouco</span>
          <span><b className="text-red-600 dark:text-red-400">● Parado</b> presente sem trabalhar</span>
          <span><b>% do dever</b> = da <b>agenda de prioridades</b> do dia (a mesma fila do corretor), quantas ele atendeu · 🟢 presente</span>
        </div>
      </div>
    </div>
  );
}
