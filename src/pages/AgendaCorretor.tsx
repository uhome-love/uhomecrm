import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Layers, Target } from "lucide-react";
import { useFilaDoDia, type MotivoFila } from "@/hooks/useFilaDoDia";
import RegistrarAtividadeModal from "@/components/pipeline/RegistrarAtividadeModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AgendaAjuda from "@/components/agenda/AgendaAjuda";
import AgendaFiltros from "@/components/agenda/AgendaFiltros";
import AgendaPrioridadeCard from "@/components/agenda/AgendaPrioridadeCard";
import AgendaFeitoCard from "@/components/agenda/AgendaFeitoCard";
import AgendaCadencia from "@/components/agenda/AgendaCadencia";
import type { FocoAgenda } from "@/components/agenda/agendaMeta";
import { supabase } from "@/integrations/supabase/client";
import { dispensarLead, restaurarLead } from "@/lib/filaDispensados";
import { toast } from "sonner";

type RegistrarState = { id: string; nome: string; origem?: "fila" } | null;

export default function AgendaCorretor() {
  const { data, isLoading, isError } = useFilaDoDia();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [registrar, setRegistrar] = useState<RegistrarState>(null);
  const [foco, setFoco] = useState<FocoAgenda>("pendentes");
  const [feitoId, setFeitoId] = useState<string | null>(null);
  const [destaqueId, setDestaqueId] = useState<string | null>(null);
  const hojeLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "short", timeZone: "America/Sao_Paulo",
  });
  const prioridades = data?.prioridades ?? [];
  const cadencia = data?.cadencia ?? { total: 0, leads: [] };
  const feitosHoje = data?.feitosHoje ?? [];
  const stages = data?.stages ?? [];
  const totalFila = prioridades.length + cadencia.total;
  const contagemMotivo = useMemo(() => {
    const counts: Partial<Record<MotivoFila, number>> = {};
    for (const lead of prioridades) counts[lead.motivo] = (counts[lead.motivo] ?? 0) + 1;
    return counts;
  }, [prioridades]);
  const prioridadesFiltradas = foco === "pendentes" || foco === "feitos"
    ? prioridades : prioridades.filter((lead) => lead.motivo === foco);

  useEffect(() => {
    if (!destaqueId) return;
    const el = document.querySelector<HTMLElement>(`[data-lead-id="${destaqueId}"]`);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    const timer = setTimeout(() => setDestaqueId(null), 1500);
    return () => clearTimeout(timer);
  }, [destaqueId, prioridades]);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["fila-do-dia"] });
  const abrirLead = (id: string) => navigate(`/pipeline-leads?lead=${id}`);
  const concluirDaFila = (leadId: string) => {
    const i = prioridadesFiltradas.findIndex((lead) => lead.id === leadId);
    const proximo = i >= 0 ? (prioridadesFiltradas[i + 1] ?? prioridadesFiltradas[i - 1]) : null;
    dispensarLead(leadId);
    setFeitoId(leadId);
    setTimeout(() => {
      setFeitoId((atual) => atual === leadId ? null : atual);
      invalidar();
      if (proximo) setDestaqueId(proximo.id);
    }, 1200);
  };
  const voltarPraFila = (leadId: string) => {
    restaurarLead(leadId);
    invalidar();
    toast.success("Lead de volta na fila de hoje");
  };
  const moverEtapa = async (leadId: string, stageId: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from("pipeline_leads")
      .update({ stage_id: stageId, stage_changed_at: now, updated_at: now } as never).eq("id", leadId);
    if (error) { toast.error("Não foi possível mover o lead."); return; }
    toast.success("Lead movido ✅");
    invalidar();
  };

  return (
    <div className="mx-auto max-w-2xl px-1 py-5 pb-28 md:px-4 md:pb-24">
      <header className="mb-6 flex items-center justify-between gap-3 md:mb-4 md:items-start">
        <div className="min-w-0">
          <p className="mb-1 text-xs capitalize text-muted-foreground md:hidden">{hojeLabel}</p>
          <h1 className="text-[32px] font-bold leading-tight text-foreground md:text-xl"><span className="md:hidden">Minha agenda</span><span className="hidden md:inline">Agenda</span></h1>
          <p className="hidden text-[13px] capitalize text-muted-foreground md:block">{hojeLabel}</p>
        </div>
        <AgendaAjuda />
      </header>
      <div className="mb-3 hidden items-center gap-2 md:flex"><Target className="h-4 w-4 text-primary" /><span className="text-[13.5px] font-semibold text-foreground">Sua fila de hoje</span><span className="text-[11.5px] text-muted-foreground">· quem o CRM sugere atacar agora</span></div>
      <AgendaFiltros foco={foco} onChange={setFoco} contagem={contagemMotivo} pendentes={prioridades.length} feitos={feitosHoje.length} loading={isLoading} />
      <h2 className="mb-3 text-lg font-bold text-foreground md:hidden">{foco === "feitos" ? "Feitos hoje" : "Sua fila de hoje"}</h2>
      {isLoading ? (
        <div className="space-y-3 md:space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-52 w-full rounded-xl md:h-24" />)}</div>
      ) : isError ? (
        <div className="py-8 text-center text-sm text-muted-foreground"><p>Não foi possível carregar sua fila.</p><Button variant="outline" className="mt-3" onClick={invalidar}>Tentar novamente</Button></div>
      ) : foco === "feitos" ? (
        feitosHoje.length === 0 ? <div className="border-y border-border py-8 text-center text-sm text-muted-foreground">Nenhuma atividade registrada hoje.</div> :
        <div className="space-y-3 md:space-y-2">{feitosHoje.map((lead) => <AgendaFeitoCard key={lead.id} lead={lead} onOpen={() => abrirLead(lead.id)} onVoltar={() => voltarPraFila(lead.id)} />)}</div>
      ) : totalFila === 0 ? (
        <div className="flex items-start gap-3 border-y border-border py-5 md:gap-2 md:rounded-xl md:border md:border-dashed md:border-primary/30 md:bg-primary/5 md:p-4">
          <Layers className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="text-[13px] text-foreground"><b className="font-semibold">Fila zerada — mandou bem!</b><p className="mt-1 text-muted-foreground">{feitosHoje.length > 0 ? `Você registrou ${feitosHoje.length} ${feitosHoje.length === 1 ? "lead" : "leads"} hoje. Nada pendente agora.` : "Sem leads pedindo ação agora."}</p>{feitosHoje.length > 0 && <Button variant="link" onClick={() => setFoco("feitos")} className="mt-1 h-11 p-0 text-xs md:h-auto">Ver o que você fez hoje →</Button>}</div>
        </div>
      ) : (
        <div className="space-y-3 md:space-y-2">
          {prioridadesFiltradas.map((lead) => <AgendaPrioridadeCard key={lead.id} lead={lead} stages={stages} destacado={destaqueId === lead.id} feito={feitoId === lead.id}
            onRegistrar={() => setRegistrar({ id: lead.id, nome: lead.nome, origem: "fila" })} onOpen={() => abrirLead(lead.id)} onMove={moverEtapa}
            onDispensar={() => { dispensarLead(lead.id); toast.success(`${lead.nome} dispensado por hoje`); invalidar(); }} />)}
          {foco !== "pendentes" && prioridadesFiltradas.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Nenhum cliente nesta prioridade.</div>}
          {foco === "pendentes" && <AgendaCadencia total={cadencia.total} leads={cadencia.leads} onRegistrar={(lead) => setRegistrar({ id: lead.id, nome: lead.nome })} onOpen={abrirLead} />}
        </div>
      )}
      {registrar && <RegistrarAtividadeModal lead={{ id: registrar.id, nome: registrar.nome }} onClose={() => setRegistrar(null)} onSaved={() => {
        if (registrar.origem === "fila" || prioridades.some((lead) => lead.id === registrar.id)) concluirDaFila(registrar.id);
        else invalidar();
      }} />}
    </div>
  );
}
