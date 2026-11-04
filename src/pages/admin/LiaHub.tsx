import type { ComponentType } from "react";
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
import { useLiaRealtime } from "@/components/lia-hub/useLiaHub";
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
};

export default function LiaHub() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  useLiaRealtime();
  const { area, secao } = resolverArea(params.get("area"), params.get("aba"));
  const Conteudo = secao ? SECOES[secao] : null;
  const ir = (a: string, s?: string) => setParams(s ? { area: a, aba: s } : { area: a }, { replace: true });

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-3 sm:p-4 lg:flex-row">
      <aside className="shrink-0 lg:w-56">
        <div className="rounded-xl border border-border bg-card p-3 lg:sticky lg:top-4">
          <div className="flex items-center gap-2.5 px-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-base font-bold leading-tight text-foreground">Lia</p>
              <p className="text-[11px] text-muted-foreground">Atendente no WhatsApp</p>
            </div>
          </div>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Atende só descartes
          </span>
          <nav className="mt-3 flex gap-1 overflow-x-auto lg:flex-col [scrollbar-width:none]">
            {LIA_AREAS.map((a) => {
              const Icone = ICONES[a.valor];
              const ativa = a.valor === area.valor;
              return (
                <button key={a.valor} type="button" onClick={() => ir(a.valor)}
                  aria-current={ativa ? "page" : undefined}
                  className={cn("flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-fast",
                    ativa ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  <Icone className="h-4 w-4" /> {a.rotulo}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      <main className="min-w-0 flex-1 space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">{area.rotulo}</h1>
            <p className="text-sm text-muted-foreground">{area.descricao}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["lia-hub"] })}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Atualizar
          </Button>
        </header>

        {area.secoes.length > 1 && (
          <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {area.secoes.map((s) => (
              <button key={s.valor} type="button" onClick={() => ir(area.valor, s.valor)}
                className={cn("rounded-md px-3 py-1.5 text-sm transition-colors duration-fast",
                  s.valor === secao ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {s.rotulo}
              </button>
            ))}
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
