// ─────────────────────────────────────────────────────────────────
// MobileTopoV2 — topo do Pipeline no celular, SEM faixas de arrastar.
//   • "Seu dia": 3 quadrinhos fixos (Atrasadas · Para hoje · Sem ação), tocar filtra.
//   • Etapa RECOLHIDA numa barra só: ‹  🔥 Aquecimento 10 ▾  ›
//       – tocar no nome abre a grade 3×2 com todas as etapas; escolher fecha a grade;
//       – as setas vão para a etapa anterior / seguinte;
//       – o filete colorido no topo da barra é a cor da etapa (pipeline_stages.cor).
//   • Pontinhos mostram em qual etapa você está (sem barra de rolagem).
//   • `ordenacao` (opcional): o controle de ordenar, à direita dos pontinhos.
// Arrastar a lista para o lado também troca de etapa: ver useSwipeEtapa.
// Substitui a faixa de abas de etapa do PipelineMobileView na cópia V2.
//
// ONDE COLOCAR: como os PRIMEIROS filhos do container que rola a lista (o mesmo
// que tem o onScroll / carregamento de 20 em 20). Ele devolve 2 blocos irmãos:
//   1. "Seu dia" — sobe junto com a rolagem e libera espaço para os cards;
//   2. barra da etapa — `sticky top-0`, fica presa no topo enquanto rola.
// O container precisa ter 12px de padding lateral (px-3), como o atual.
// ─────────────────────────────────────────────────────────────────
import { useId, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { FiltroAcao } from "@/lib/pipelineV2/proximaAcao";
import { EMOJI_POR_TIPO } from "@/lib/pipelineV2/textos";

export interface EtapaMobileV2 {
  id: string;
  nome: string;
  tipo: string;
  qtd: number;
  /** pipeline_stages.cor */
  cor?: string | null;
}

export interface MobileTopoV2Props {
  contadores: { atrasada: number; hoje: number; sem: number };
  acaoFilter: FiltroAcao;
  onAcaoFilter: (v: FiltroAcao) => void;
  etapas: EtapaMobileV2[];
  etapaAtivaId: string;
  onEtapa: (id: string) => void;
  /** Grade aberta. Se não vier, o componente controla sozinho (começa fechada). */
  aberto?: boolean;
  onAbertoChange?: (v: boolean) => void;
  /** Controle de ordenar (ex.: o seletor de ordenação atual), à direita dos pontinhos. */
  ordenacao?: ReactNode;
}

const fmt = (n: number) => n.toLocaleString("pt-BR");
const COR_PADRAO = "hsl(var(--primary))";

export default function MobileTopoV2({
  contadores,
  acaoFilter,
  onAcaoFilter,
  etapas,
  etapaAtivaId,
  onEtapa,
  aberto: abertoProp,
  onAbertoChange,
  ordenacao,
}: MobileTopoV2Props) {
  const [abertoLocal, setAbertoLocal] = useState(false);
  const aberto = abertoProp ?? abertoLocal;
  const setAberto = (v: boolean) => {
    if (abertoProp === undefined) setAbertoLocal(v);
    onAbertoChange?.(v);
  };
  const gradeId = useId();

  const dia: Array<{ key: Exclude<FiltroAcao, "todos">; n: number; emoji: string; rotulo: string; cor: string }> = [
    { key: "atrasada", n: contadores.atrasada, emoji: "⏰", rotulo: "Atrasadas", cor: "text-red-700 dark:text-red-300" },
    { key: "hoje", n: contadores.hoje, emoji: "📌", rotulo: "Para hoje", cor: "text-primary" },
    { key: "sem", n: contadores.sem, emoji: "⚠️", rotulo: "Sem ação", cor: "text-amber-700 dark:text-amber-300" },
  ];

  const idx = Math.max(0, etapas.findIndex((e) => e.id === etapaAtivaId));
  const ativa = etapas[idx];
  const anterior = idx > 0 ? etapas[idx - 1] : null;
  const proxima = idx < etapas.length - 1 ? etapas[idx + 1] : null;
  const ir = (id: string) => {
    onEtapa(id);
    setAberto(false);
  };

  return (
    <>
      <div role="group" aria-label="Seu dia" className="grid grid-cols-3 gap-2 pb-1 pt-2">
        {dia.map((d) => {
          const on = acaoFilter === d.key;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={on}
              onClick={() => onAcaoFilter(on ? "todos" : d.key)}
              className={`flex min-h-16 flex-col items-start gap-0.5 rounded-[14px] border px-3 py-2.5 text-left shadow-sm transition-colors ${
                on ? "border-primary/40 bg-primary/10" : "border-border/70 bg-card"
              }`}
            >
              <span className={`text-[22px] font-bold leading-7 tracking-tight tabular-nums ${d.cor}`} style={{ fontFamily: "Montserrat, Inter, sans-serif" }}>
                {fmt(d.n)}
              </span>
              <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground">
                {d.emoji} {d.rotulo}
              </span>
            </button>
          );
        })}
      </div>

      {ativa && (
        <div className="sticky top-0 z-20 -mx-3 flex flex-col gap-2 bg-background/95 px-3 pb-0.5 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          {/* Barra da etapa (recolhida) */}
          <div
            className="flex min-h-14 items-center gap-0.5 rounded-2xl border border-border/70 bg-card p-1.5"
            style={{ boxShadow: `inset 0 3px 0 ${ativa.cor || COR_PADRAO}, 0 1px 2px rgba(15,23,42,0.05)` }}
          >
            <button
              type="button"
              aria-label={anterior ? `Etapa anterior: ${anterior.nome}` : "Etapa anterior"}
              disabled={!anterior}
              onClick={() => anterior && ir(anterior.id)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-foreground/80 transition-colors active:bg-muted disabled:text-muted-foreground/40"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
            </button>
            <button
              type="button"
              aria-expanded={aberto}
              aria-controls={gradeId}
              aria-label={`${ativa.nome}, ${fmt(ativa.qtd)} ${ativa.qtd === 1 ? "lead" : "leads"}. Trocar de etapa`}
              onClick={() => setAberto(!aberto)}
              className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-muted/50 px-2.5 text-foreground transition-colors active:bg-muted"
            >
              <span aria-hidden className="text-base leading-5">
                {EMOJI_POR_TIPO[ativa.tipo] ?? "📍"}
              </span>
              <span className="truncate text-[15px] font-bold leading-5">{ativa.nome}</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-bold tabular-nums text-foreground/80">{fmt(ativa.qtd)}</span>
              <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              aria-label={proxima ? `Próxima etapa: ${proxima.nome}` : "Próxima etapa"}
              disabled={!proxima}
              onClick={() => proxima && ir(proxima.id)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-foreground/80 transition-colors active:bg-muted disabled:text-muted-foreground/40"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.2} />
            </button>
          </div>

          {/* Grade com todas as etapas (só quando aberta) */}
          {aberto && (
            <div id={gradeId} role="group" aria-label="Etapas" className="grid grid-cols-3 gap-1.5 rounded-2xl bg-muted p-1.5">
              {etapas.map((e) => {
                const on = e.id === ativa.id;
                return (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => ir(e.id)}
                    className={`flex min-h-[52px] flex-col items-start gap-px rounded-[11px] px-2.5 py-2 text-left transition-colors ${
                      on ? "bg-foreground text-background shadow-md" : "text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-base font-bold leading-5 tabular-nums">
                      <span aria-hidden className="text-sm">
                        {EMOJI_POR_TIPO[e.tipo] ?? "📍"}
                      </span>
                      {fmt(e.qtd)}
                    </span>
                    <span className={`max-w-full truncate text-xs font-semibold ${on ? "text-background/80" : "text-muted-foreground"}`}>{e.nome}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pontinhos (posição) + ordenar */}
          <div className="flex min-h-9 items-center justify-between gap-2 pl-1.5 pr-0.5">
            <div aria-hidden className="flex items-center gap-[5px]">
              {etapas.map((e) => {
                const on = e.id === ativa.id;
                return (
                  <span
                    key={e.id}
                    className="block h-1.5 rounded-full transition-all duration-200"
                    style={{ width: on ? 18 : 6, background: on ? e.cor || COR_PADRAO : "hsl(var(--muted-foreground) / 0.3)" }}
                  />
                );
              })}
            </div>
            {ordenacao}
          </div>
        </div>
      )}
    </>
  );
}
