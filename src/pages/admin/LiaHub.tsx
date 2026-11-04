import { useEffect, useRef, type ComponentType } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Bot, RefreshCw, LayoutDashboard, MessagesSquare, RotateCcw, BarChart3, Brain, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import LiaVisaoGeral from "@/components/lia-hub/LiaVisaoGeral";
import LiaLeadsTab from "@/components/lia-hub/LiaLeadsTab";
import LiaKanbanTab from "@/components/lia-hub/LiaKanbanTab";
import LiaFollowupsTab from "@/components/lia-hub/LiaFollowupsTab";
import LiaQualificadosTab from "@/components/lia-hub/LiaQualificadosTab";
import LiaReengajarTab from "@/components/lia-hub/LiaReengajarTab";
import LiaTransitoTab from "@/components/lia-hub/LiaTransitoTab";
import LiaRecuperaTab from "@/components/lia-hub/LiaRecuperaTab";
import LiaMensagensTab from "@/components/lia-hub/LiaMensagensTab";
import LiaConhecimentoTab from "@/components/lia-hub/LiaConhecimentoTab";
import LiaLaboratorioTab from "@/components/lia-hub/LiaLaboratorioTab";
import LiaConfiguracoesTab from "@/components/lia-hub/LiaConfiguracoesTab";
import { useLiaRealtime } from "@/components/lia-hub/useLiaHub";
import { useConversasContagem } from "@/components/lia-hub/useConversasContagem";
import { LIA_AREAS, resolverArea, type LiaArea } from "@/components/lia-hub/liaAreas";

const ICONES: Record<LiaArea, typeof Bot> = {
  visao: LayoutDashboard, conversas: MessagesSquare, recuperacao: RotateCcw,
  relatorios: BarChart3, cerebro: Brain, config: Settings,
};

const SECOES: Record<string, ComponentType> = {
  painel: LiaVisaoGeral, leads: LiaLeadsTab, kanban: LiaKanbanTab, followups: LiaFollowupsTab,
  transito: LiaTransitoTab, recupera: LiaRecuperaTab, reengajar: LiaReengajarTab,
  mensagens: LiaMensagensTab, qualificados: LiaQualificadosTab,
  conhecimento: LiaConhecimentoTab, laboratorio: LiaLaboratorioTab,
  configuracoes: LiaConfiguracoesTab,
};

export default function LiaHub() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  useLiaRealtime();
  const contagem = useConversasContagem();
  const { area, secao } = resolverArea(params.get("area"), params.get("aba"));
  const Conteudo = secao ? SECOES[secao] : null;
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const selected = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !selected) return;
    const left = selected.offsetLeft - nav.offsetLeft;
    if (left < nav.scrollLeft || left + selected.offsetWidth > nav.scrollLeft + nav.clientWidth) {
      nav.scrollLeft = Math.max(0, left - (nav.clientWidth - selected.offsetWidth) / 2);
    }
  }, [area.valor]);
  const ir = (a: string, s?: string) => setParams(s ? { area: a, aba: s } : { area: a }, { replace: true });
  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: ["lia-hub"] });
    void qc.invalidateQueries({ queryKey: ["lia-lab-execucoes"] });
    for (const key of ["lia-reeng-resumo", "lia-reeng-runs", "lia-reeng-fila-counts", "lia-reeng-flag"]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 p-3 sm:p-4 lg:p-6">
      <header className="min-w-0">
        <div className="flex items-center justify-between gap-3 pb-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight text-foreground">Lia</p>
              <p className="text-[11px] text-muted-foreground">Relacionamento Uhome</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground sm:text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Atende só descartes
          </span>
        </div>
          <nav ref={navRef} aria-label="Áreas da Lia" className="relative flex gap-2 overflow-x-auto border-b border-border sm:gap-4 [scrollbar-width:thin]">
            {LIA_AREAS.map((a) => {
              const Icone = ICONES[a.valor];
              const ativa = a.valor === area.valor;
              return (
                <Button key={a.valor} variant="ghost" onClick={() => ir(a.valor)}
                  aria-current={ativa ? "page" : undefined}
                  className={cn("h-12 shrink-0 gap-2 rounded-none border-b-2 px-2 text-xs transition-colors duration-fast sm:px-3 sm:text-sm",
                    ativa ? "border-primary font-semibold text-primary" : "border-transparent font-medium text-muted-foreground hover:text-foreground")}>
                  <Icone className="h-4 w-4" /> {a.rotulo}
                </Button>
              );
            })}
          </nav>
      </header>

      <main className="min-w-0 flex-1 space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">{area.rotulo}</h1>
            <p className="text-sm text-muted-foreground">{area.descricao}</p>
          </div>
          <Button variant="outline" size="sm" aria-label="Atualizar" title="Atualizar" className="shrink-0" onClick={atualizar}>
            <RefreshCw className="h-4 w-4" /> <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </header>

        {area.secoes.length > 1 && (
          <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 [scrollbar-width:none]">
            <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
              {area.secoes.map((s) => {
                const n = area.valor === "conversas" ? contagem[s.valor] : undefined;
                return (
                  <Button key={s.valor} variant="ghost" onClick={() => ir(area.valor, s.valor)}
                    aria-current={s.valor === secao ? "page" : undefined}
                    className={cn("h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm transition-colors duration-fast",
                      s.valor === secao ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {s.rotulo}
                    {n !== undefined && (
                      <span className="rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold tabular-nums text-primary">{n}</span>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {Conteudo ? <Conteudo /> : (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <Settings className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-semibold text-foreground">Configurações chegam na Fase 6</p>
            <p className="mt-1 text-sm text-muted-foreground">Número da Lia, campanhas ligadas, horários e limites ficarão aqui.</p>
          </div>
        )}
      </main>
    </div>
  );
}
