import { useMemo, useRef, useState } from "react";
import { useNegociosBoard, type NegocioCard, type NegPasso } from "@/hooks/useNegociosBoard";
import { leadSaude, type LeadSaude } from "@/lib/leadSaude";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PipelineStage, PipelineLead } from "@/hooks/usePipeline";
import PipelineStageTransitionPopup, { type TransitionResult } from "./PipelineStageTransitionPopup";
import { JornadaNegocioDialog } from "./negocio/JornadaNegocioDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQueryClient } from "@tanstack/react-query";
import { RegredirDialog } from "./negocio/NegociosBoardActions";
import { PosCard, NegCard } from "./negocio/NegociosBoardCards";
import { NegociosColumn, NegociosEmpty, NegociosMobileTabs } from "./negocio/NegociosBoardColumns";
import { NEGOCIOS_COLUNAS, PASSO_TIPO, COMMERCIAL_TIPOS, type MoveLeadFn, type NegociosColKey as ColKey, type NegociosLens as Lens } from "./negocio/boardPresentation";
import { NegociosBoardSummary } from "./negocio/NegociosBoardSummary";
import { recortarNegocios, recortarPosVisita, resumoNegocios, filtrarNegociosAtalho, type NegociosAtalho } from "@/lib/negociosBoardPresentation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { diasCalendarioBRT } from "@/lib/diasCalendarioBRT";

interface NegociosBoardProps {
  onOpenLead: (leadId: string) => void;
  canSeeEquipe?: boolean;
  lens?: Lens;
  stages?: PipelineStage[];
  onMoveLead?: MoveLeadFn;
  searchTerm?: string;
  corretorFilter?: string; // user_id do corretor, "all" ou "sem_corretor"
  saudeFilter?: LeadSaude | null; // filtro de saúde (atenção=ambar / desatualizado=vermelho / estagnado)
  gestorTeamUserIds?: string[] | null; // user_ids do time do gestor (null = sem filtro de gestor)
  pipelineLeads?: PipelineLead[];
}

export default function NegociosBoardInline({ onOpenLead, canSeeEquipe = true, lens: selectedLens = "equipe", stages = [], onMoveLead, searchTerm = "", corretorFilter = "all", saudeFilter = null, gestorTeamUserIds = null, pipelineLeads = [] }: NegociosBoardProps) {
  const { data, isLoading, error, refetch } = useNegociosBoard();
  const lens: Lens = canSeeEquipe ? selectedLens : "meus";
  const isMobile = useIsMobile();
  const [mobileCol, setMobileCol] = useState<ColKey>("proposta");
  const [atalho, setAtalho] = useState<NegociosAtalho>("todos");

  const leadById = useMemo(() => new Map(pipelineLeads.map(l => [l.id, l])), [pipelineLeads]);
  const atividadeDias = (id: string | null): number | null => {
    const toque = id ? leadById.get(id)?.ultimo_toque_at : null;
    return toque && !Number.isNaN(Date.parse(toque)) ? Math.max(0, diasCalendarioBRT(toque)) : null;
  };
  const recorte = useMemo(() => ({ lens, search: searchTerm, corretor: corretorFilter, gestorIds: gestorTeamUserIds, saude: saudeFilter }), [lens, searchTerm, corretorFilter, gestorTeamUserIds, saudeFilter]);
  const negociosBase = useMemo(() => recortarNegocios((data?.negocios ?? []).map(n => {
    const lead = n.pipelineLeadId ? leadById.get(n.pipelineLeadId) : undefined;
    return lead && n.passo !== "ganho" ? { ...n, saude: leadSaude({ ...lead, stage_tipo: PASSO_TIPO[n.passo] }) } : n;
  }), recorte), [data, leadById, recorte]);
  const resumo = useMemo(() => resumoNegocios(negociosBase), [negociosBase]);
  const negocios = useMemo(() => filtrarNegociosAtalho(negociosBase, atalho), [negociosBase, atalho]);
  const prontos = useMemo(() => atalho === "todos" ? recortarPosVisita((data?.prontos ?? []).map(p => {
    const lead = leadById.get(p.id);
    return lead ? { ...p, saude: leadSaude({ ...lead, stage_tipo: "pos_visita" }) } : p;
  }), recorte) : [], [data, recorte, atalho, leadById]);

  // Agrupa uma vez por passo (ordenado por VGV) + soma de VGV — memoizado.
  const porPasso = useMemo(() => {
    const m: Record<NegPasso, NegocioCard[]> = { documentacao: [], proposta: [], contrato: [], ganho: [] };
    for (const n of negocios) { (m[n.passo] ||= []).push(n); } // defensivo: passo inesperado não crasha
    (Object.keys(m) as NegPasso[]).forEach((k) => m[k].sort((a, b) => (b.vgv || 0) - (a.vgv || 0)));
    return m;
  }, [negocios]);
  const vgvPorPasso = useMemo(() => {
    const m = {} as Record<NegPasso, number>;
    (Object.keys(porPasso) as NegPasso[]).forEach((k) => { m[k] = porPasso[k].reduce((s, n) => s + (n.vgv || 0), 0); });
    return m;
  }, [porPasso]);
  const colInfo = (k: ColKey) => k === "pos_visita" ? { count: prontos.length, vgv: 0 } : { count: porPasso[k].length, vgv: vgvPorPasso[k] };
  const itemsOf = (k: ColKey): NegocioCard[] => k === "pos_visita" ? [] : porPasso[k];

  // Etapas comerciais usam a jornada compartilhada; Ganho usa confirmação completa.
  const queryClient = useQueryClient();
  const dragRef = useRef<{ leadId: string; fromTipo: string } | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColKey | null>(null);
  const [ganhoDrop, setGanhoDrop] = useState<{ leadId: string; nome: string; vgv: number | null } | null>(null);
  const [regredirDrop, setRegredirDrop] = useState<{ leadId: string; nome: string } | null>(null);
  const [jornadaDrop, setJornadaDrop] = useState<{ leadId: string; etapa: PipelineStage } | null>(null);
  const invalidateBoard = () => queryClient.invalidateQueries({ queryKey: ["negocios-board"] });
  const vendaStage = useMemo(() => (stages || []).find((s) => s.tipo === "venda") || null, [stages]);

  const beginDrag = (leadId: string, fromTipo: string) => { dragRef.current = { leadId, fromTipo }; };
  const dropOnCol = (colKey: ColKey) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragOverCol(null);
    if (!drag || !onMoveLead) return;
    const targetTipo = PASSO_TIPO[colKey];
    if (targetTipo === drag.fromTipo) return; // mesma coluna → nada
    const targetStage = (stages || []).find((s) => s.tipo === targetTipo);
    if (!targetStage) return;
    // Ganho → precisa dos dados reais da venda (mesmo form do pipeline).
    if (targetTipo === "venda") {
      const card = negocios.find((n) => n.pipelineLeadId === drag.leadId);
      setGanhoDrop({ leadId: drag.leadId, nome: card?.cliente || "", vgv: card?.vgv ?? null });
      return;
    }
    // Voltar pra Pós-Visita vindo de etapa comercial → Regredir (arquiva o negócio).
    if (colKey === "pos_visita" && COMMERCIAL_TIPOS.includes(drag.fromTipo)) {
      const card = negocios.find((n) => n.pipelineLeadId === drag.leadId);
      setRegredirDrop({ leadId: drag.leadId, nome: card?.cliente || "" });
      return;
    }
    if (COMMERCIAL_TIPOS.includes(targetTipo)) {
      setJornadaDrop({ leadId: drag.leadId, etapa: targetStage });
      return;
    }
    Promise.resolve(onMoveLead(drag.leadId, targetStage.id)).then(invalidateBoard);
  };

  const summary = isLoading ? <Skeleton className="my-3 h-16 w-full shrink-0" /> : <NegociosBoardSummary resumo={resumo} atalho={atalho} onChange={setAtalho} />;
  if (error) return <div role="alert" className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground"><p>Não foi possível carregar Negócios.</p><Button variant="outline" onClick={() => void refetch()}><RefreshCw />Tentar novamente</Button></div>;

  // ---------- MOBILE: abas de coluna + lista vertical ----------
  if (isMobile) {
    const activeItems = itemsOf(mobileCol);
    const activeIsPos = mobileCol === "pos_visita";
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col px-1 pt-2">
        {summary}
        <NegociosMobileTabs stages={stages} active={mobileCol} onChange={setMobileCol} info={colInfo} />
        {(() => {
          const col = NEGOCIOS_COLUNAS.find(c => c.key === mobileCol);
          const stage = stages.find(s => s.tipo === col?.tipo);
          return stage ? <NegociosColumn stage={stage} count={colInfo(mobileCol).count} valor={activeIsPos ? undefined : colInfo(mobileCol).vgv} /> : null;
        })()}
        {/* Lista vertical */}
        {isLoading ? (
          <div className="mt-2 flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
        ) : (
          <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))]">
            {activeIsPos ? (
              prontos.length === 0 ? <NegociosEmpty coluna={mobileCol} /> : prontos.map((p) => <PosCard key={p.id} p={p} atividadeDias={atividadeDias(p.id)} stages={stages} onMoveLead={onMoveLead} onOpenLead={onOpenLead} />)
            ) : activeItems.length === 0 ? <NegociosEmpty coluna={mobileCol} /> : activeItems.map((n) => <NegCard key={n.id} n={n} atividadeDias={atividadeDias(n.pipelineLeadId)} stages={stages} onMoveLead={onMoveLead} onClick={() => n.pipelineLeadId && onOpenLead(n.pipelineLeadId)} />)}
          </div>
        )}
      </div>
    );
  }

  // ---------- DESKTOP: kanban horizontal ----------
  return (
    <div className="flex h-full min-h-0 flex-col pt-3">
      {summary}
      {isLoading ? (
        <div className="flex gap-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-72 w-64 shrink-0 rounded-2xl" />)}</div>
      ) : (
        <div className="flex flex-1 gap-3 overflow-x-auto pb-3">
          {NEGOCIOS_COLUNAS.map((c) => {
            const info = colInfo(c.key);
            const isPos = c.key === "pos_visita";
            const items = itemsOf(c.key);
            const over = dragOverCol === c.key;
            return (
              <div
                key={c.key}
                className={cn("flex w-[280px] shrink-0 flex-col rounded-xl bg-muted/40 transition-colors duration-short", over && "ring-2 ring-primary/40")}
                onDragOver={(e) => { if (dragRef.current) { e.preventDefault(); if (dragOverCol !== c.key) setDragOverCol(c.key); } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol((v) => (v === c.key ? null : v)); }}
                onDrop={(e) => { e.preventDefault(); dropOnCol(c.key); }}
              >
                {(() => {
                  const stage = stages.find(s => s.tipo === c.tipo);
                  return stage ? <NegociosColumn stage={stage} count={info.count} valor={isPos ? undefined : info.vgv} highlight={over} /> : null;
                })()}
                <div className="flex flex-col gap-2 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                  {isPos ? (
                    prontos.length === 0 ? <NegociosEmpty coluna={c.key} /> : prontos.map((p) => <PosCard key={p.id} p={p} atividadeDias={atividadeDias(p.id)} stages={stages} onMoveLead={onMoveLead} onOpenLead={onOpenLead} onDragStartCard={onMoveLead ? beginDrag : undefined} />)
                  ) : items.length === 0 ? <NegociosEmpty coluna={c.key} /> : items.map((n) => <NegCard key={n.id} n={n} atividadeDias={atividadeDias(n.pipelineLeadId)} stages={stages} onMoveLead={onMoveLead} onClick={() => n.pipelineLeadId && onOpenLead(n.pipelineLeadId)} onDragStartCard={onMoveLead ? beginDrag : undefined} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {jornadaDrop && <JornadaNegocioDialog leadId={jornadaDrop.leadId} etapa={jornadaDrop.etapa}
        onClose={() => setJornadaDrop(null)} onSaved={() => { void invalidateBoard(); }} />}

      {/* Ganho por arrastar → MESMO form de venda do pipeline (VGV/data/unidade reais). */}
      {ganhoDrop && vendaStage && (
        <PipelineStageTransitionPopup
          open={!!ganhoDrop}
          onOpenChange={(v) => { if (!v) setGanhoDrop(null); }}
          lead={{ id: ganhoDrop.leadId, nome: ganhoDrop.nome, valor_estimado: ganhoDrop.vgv } as unknown as PipelineLead}
          targetStage={vendaStage}
          onConfirm={(r: TransitionResult) => {
            const ex = r.extraData || {};
            if (ex.vendaConfirmada === true) {
              invalidateBoard();
              setGanhoDrop(null);
              return;
            }
            Promise.resolve(
              onMoveLead?.(ganhoDrop.leadId, vendaStage.id, (ex.observacao as string) || r.observacao, {
                vgvFinal: ex.vgvFinal as number,
                dataAssinatura: ex.dataAssinatura as string,
                unidade: ex.unidade as string,
              })
            ).then(invalidateBoard);
            setGanhoDrop(null);
          }}
          onCancel={() => setGanhoDrop(null)}
        />
      )}

      {/* Regredir por arrastar (soltar em Pós-Visita vindo de etapa comercial) → MESMO RegredirDialog. */}
      <RegredirDialog
        open={!!regredirDrop}
        onOpenChange={(o) => { if (!o) setRegredirDrop(null); }}
        stages={stages}
        onConfirm={async (motivo, destinoStageId) => {
          if (!onMoveLead || !destinoStageId || !regredirDrop) return;
          await onMoveLead(regredirDrop.leadId, destinoStageId, motivo || undefined);
          invalidateBoard();
          setRegredirDrop(null);
        }}
      />
    </div>
  );
}
