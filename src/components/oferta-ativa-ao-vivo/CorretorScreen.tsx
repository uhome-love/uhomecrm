import { useEffect, useState } from "react";
import { formatBRT, secondsUntil } from "@/lib/brtTime";
import { Button } from "@/components/ui/button";
import { Timer, X, Filter } from "lucide-react";
import { LeadCard } from "./LeadCard";
import { RankingPanel } from "./RankingPanel";
import { MetaPanel } from "./MetaPanel";
import { FeedPanel } from "./FeedPanel";
import { ReaproveitarPanel } from "./ReaproveitarPanel";
import { ScriptCollapsible } from "./ScriptCollapsible";
import { SemInteressePopup } from "./SemInteressePopup";
import { OnboardingModal } from "./OnboardingModal";
import VisitaForm from "@/components/visitas/VisitaForm";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { useMutiraoSession } from "@/hooks/useMutiraoSession";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export function CorretorScreen({ ms }: { ms: ReturnType<typeof useMutiraoSession> }) {
  const nav = useNavigate();
  const [semInteresseOpen, setSemInteresseOpen] = useState(false);
  const [visitaOpen, setVisitaOpen] = useState(false);
  const [editFiltersOpen, setEditFiltersOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(!ms.onboarded);

  // Reabre onboarding se onboarded voltar a false (Finalizar e sair)
  useEffect(() => { if (!ms.onboarded) setShowOnboarding(true); }, [ms.onboarded]);

  // Cronômetro fim da sessão
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);
  const fimAt = ms.sessao?.fim_at;
  const secLeft = fimAt ? Math.max(0, Math.floor(secondsUntil(fimAt) ?? 0)) : 0;
  const hh = Math.floor(secLeft / 3600).toString().padStart(2, "0");
  const mm = Math.floor((secLeft % 3600) / 60).toString().padStart(2, "0");
  const ss = (secLeft % 60).toString().padStart(2, "0");

  return (
    <div className="p-3 md:p-4">
      {/* Onboarding — só na 1ª vez */}
      <OnboardingModal
        open={showOnboarding}
        firstTime
        filters={ms.filters}
        onSave={(f) => { ms.setFilters(f); ms.setOnboarded(true); ms.clearNoLeads(); ms.proximoLead(undefined); }}
        onClose={() => { setShowOnboarding(false); ms.setOnboarded(true); }}
      />
      {/* Editar filtros posterior */}
      <OnboardingModal
        open={editFiltersOpen}
        filters={ms.filters}
        onSave={(f) => { ms.setFilters(f); ms.setCurrent(null); ms.clearNoLeads(); ms.proximoLead(undefined); setEditFiltersOpen(false); }}
        onClose={() => setEditFiltersOpen(false)}
      />

      {/* Cabeçalho evento */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 rounded-xl border border-border bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <p className="text-sm font-semibold">MUTIRÃO AO VIVO</p>
          <span className="text-xs text-muted-foreground">
            {ms.sessao ? `${formatBRT(ms.sessao.inicio_at, "HH:mm")} → ${formatBRT(ms.sessao.fim_at, "HH:mm")}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditFiltersOpen(true)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border hover:bg-muted"
          >
            <Filter className="w-3 h-3" />
            Filtros
            {(ms.filters.empreendimento_ids.length + ms.filters.segmento_ids.length) > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                {ms.filters.empreendimento_ids.length + ms.filters.segmento_ids.length}
              </Badge>
            )}
          </button>
          <div className="flex items-center gap-1 text-sm font-mono bg-muted px-2 py-1 rounded">
            <Timer className="w-3.5 h-3.5" />
            {hh}:{mm}:{ss}
          </div>
          <Button size="sm" variant="ghost" onClick={() => { ms.resetCorretor(); setShowOnboarding(true); }}>
            <X className="w-4 h-4 mr-1" /> Finalizar e sair
          </Button>
        </div>
      </div>

      {/* Grid principal: lead card + coluna direita */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-3">
        {/* ESQUERDA */}
        <div className="space-y-3">
          <LeadCard
            ms={ms}
            onSemInteresse={() => setSemInteresseOpen(true)}
            onAgendarVisita={() => setVisitaOpen(true)}
          />
          <ScriptCollapsible lead={ms.current?.lead ?? null} />
        </div>

        {/* DIREITA */}
        <div className="min-w-0">
          <Tabs defaultValue="ranking" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="ranking">🏆 Ranking</TabsTrigger>
              <TabsTrigger value="meta">🎯 Meta</TabsTrigger>
              <TabsTrigger value="feed">📣 Feed</TabsTrigger>
              <TabsTrigger value="reap">🔁 Reap.</TabsTrigger>
            </TabsList>
            <TabsContent value="ranking" className="mt-2">
              <RankingPanel sessaoId={ms.sessaoId} />
            </TabsContent>
            <TabsContent value="meta" className="mt-2">
              <MetaPanel sessaoId={ms.sessaoId} />
            </TabsContent>
            <TabsContent value="feed" className="mt-2">
              <FeedPanel sessaoId={ms.sessaoId} />
            </TabsContent>
            <TabsContent value="reap" className="mt-2">
              <ReaproveitarPanel sessaoId={ms.sessaoId} onReabrir={() => ms.proximoLead(undefined)} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Popups */}
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
  );
}
