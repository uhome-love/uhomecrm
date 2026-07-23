import { useEffect, useState } from "react";
import { formatBRT, secondsUntil } from "@/lib/brtTime";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Timer, X, Filter } from "lucide-react";
import { LeadCard } from "./LeadCard";
import { RankingPanel } from "./RankingPanel";
import { MetaPanel } from "./MetaPanel";
import { FeedPanel } from "./FeedPanel";
import { HistoricoPanel } from "./HistoricoPanel";
import { ScriptCollapsible } from "./ScriptCollapsible";
import { SemInteressePopup } from "./SemInteressePopup";
import { OnboardingModal } from "./OnboardingModal";
import VisitaForm from "@/components/visitas/VisitaForm";
import type { useMutiraoSession } from "@/hooks/useMutiraoSession";

export function CorretorScreen({ ms }: { ms: ReturnType<typeof useMutiraoSession> }) {
  const [semInteresseOpen, setSemInteresseOpen] = useState(false);
  const [visitaOpen, setVisitaOpen] = useState(false);
  const [editFiltersOpen, setEditFiltersOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(!ms.onboarded);

  useEffect(() => { if (!ms.onboarded) setShowOnboarding(true); }, [ms.onboarded]);

  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);
  const fimAt = ms.sessao?.fim_at;
  const secLeft = fimAt ? Math.max(0, Math.floor(secondsUntil(fimAt) ?? 0)) : 0;
  const hh = Math.floor(secLeft / 3600).toString().padStart(2, "0");
  const mm = Math.floor((secLeft % 3600) / 60).toString().padStart(2, "0");
  const ss = (secLeft % 60).toString().padStart(2, "0");

  const filterCount = ms.filters.empreendimento_ids.length + ms.filters.segmento_ids.length;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-3 md:p-4">
        <OnboardingModal
          open={showOnboarding}
          firstTime
          sessaoId={ms.sessaoId}
          filters={ms.filters}
          onSave={(f) => { ms.setFilters(f); ms.setOnboarded(true); ms.clearNoLeads(); ms.proximoLead(); }}
          onClose={() => { setShowOnboarding(false); ms.setOnboarded(true); }}
        />
        <OnboardingModal
          open={editFiltersOpen}
          sessaoId={ms.sessaoId}
          filters={ms.filters}
          onSave={(f) => { ms.setFilters(f); ms.setCurrent(null); ms.clearNoLeads(); ms.proximoLead(); setEditFiltersOpen(false); }}
          onClose={() => setEditFiltersOpen(false)}
        />

        {/* Header do evento */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-card">
          <div className="flex items-center gap-3 min-w-0">
            <span className="recording-dot" aria-hidden />
            <p className="text-xs font-bold tracking-widest text-foreground uppercase">
              Mutirão ao vivo
            </p>
            {ms.sessao && (
              <span className="hidden sm:inline text-xs text-muted-foreground font-mono">
                {formatBRT(ms.sessao.inicio_at, "HH:mm")} → {formatBRT(ms.sessao.fim_at, "HH:mm")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditFiltersOpen(true)}
              className="h-8 rounded-full gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              Filtros
              {filterCount > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px] tabular-nums">
                  {filterCount}
                </Badge>
              )}
            </Button>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 h-8 text-sm font-mono tabular-nums text-foreground">
              <Timer className="w-3.5 h-3.5 text-muted-foreground" />
              {hh}:{mm}:{ss}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-muted-foreground hover:text-foreground"
                  onClick={() => { ms.resetCorretor(); setShowOnboarding(true); }}
                >
                  <X /> <span className="hidden sm:inline">Finalizar e sair</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sair do mutirão e voltar à tela inicial</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Grid principal — Ranking + Feed + Meta + Histórico visíveis ao mesmo tempo */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-3">
          <div className="space-y-3 min-w-0">
            <LeadCard
              ms={ms}
              onSemInteresse={() => setSemInteresseOpen(true)}
              onAgendarVisita={() => setVisitaOpen(true)}
              onOpenFilters={() => setEditFiltersOpen(true)}
            />
            <ScriptCollapsible lead={ms.current?.lead ?? null} />
          </div>

          <div className="min-w-0 space-y-3">
            <Tabs defaultValue="ranking" className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="ranking">🏆 Ranking</TabsTrigger>
                <TabsTrigger value="meta">🎯 Meta</TabsTrigger>
                <TabsTrigger value="historico">🕘 Histórico</TabsTrigger>
              </TabsList>
              <TabsContent value="ranking" className="mt-2">
                <RankingPanel sessaoId={ms.sessaoId} />
              </TabsContent>
              <TabsContent value="meta" className="mt-2">
                <MetaPanel sessaoId={ms.sessaoId} />
              </TabsContent>
              <TabsContent value="historico" className="mt-2">
                <HistoricoPanel sessaoId={ms.sessaoId} />
              </TabsContent>
            </Tabs>
            <FeedPanel sessaoId={ms.sessaoId} />
          </div>
        </div>

        <SemInteressePopup
          open={semInteresseOpen}
          onClose={() => setSemInteresseOpen(false)}
          onConfirm={async (motivo, obs) => {
            await ms.registrar({ resultado: "sem_interesse", motivo_perda: motivo, observacao: obs });
            setSemInteresseOpen(false);
          }}
        />

        {visitaOpen && ms.current?.lead && (
          <VisitaForm
            open={visitaOpen}
            onClose={() => setVisitaOpen(false)}
            onSubmit={async (data) => {
              await ms.registrar({
                resultado: "visita_agendada",
                visita_payload: {
                  data_visita: data.data_visita,
                  hora_visita: data.hora_visita,
                  empreendimento: data.empreendimento,
                  nome_cliente: data.nome_cliente || ms.current?.lead.nome,
                  telefone: data.telefone || ms.current?.lead.telefone,
                  local_visita: data.local_visita,
                  observacoes: data.observacoes,
                },
                observacao: "Visita agendada via Mutirão",
              });
              setVisitaOpen(false);
            }}
            initialData={{
              nome_cliente: ms.current.lead.nome ?? "",
              telefone: ms.current.lead.telefone ?? "",
              empreendimento: ms.current.lead.empreendimento_canonico?.nome ?? ms.current.lead.empreendimento_raw ?? "",
              pipeline_lead_id: ms.current.lead.id,
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
