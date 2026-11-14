import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/hooks/usePipeline";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { ConfirmarVendaForm } from "@/components/vendas/ConfirmarVendaForm";
import { invalidateTaskQueries } from "@/lib/taskQueryUtils";
import DiscardLeadDialog from "../DiscardLeadDialog";
import RegistrarAtividadeModal from "../RegistrarAtividadeModal";
import CriarTarefaModal from "../CriarTarefaModal";
import { JornadaNegocioDialog } from "./JornadaNegocioDialog";
import { FLOW_TIPOS, PASSO_TIPO, COMMERCIAL_TIPOS, type MoveLeadFn, type NegociosColKey as ColKey } from "./boardPresentation";
const REGREDIR_DESTINOS = [
  { tipo: "qualificacao", label: "Atendimento", hint: "quer mais opções" },
  { tipo: "aquecimento", label: "Aquecimento", hint: "quer mais tempo pra ver outras coisas" },
  { tipo: "pos_visita", label: "Pós-Visita", hint: "ainda está definindo" },
];

/**
 * RegredirDialog — FONTE ÚNICA do "Regredir" (usado pelo menu ⋯ E pelo arrastar).
 * Regra do Lucas: arquiva o negócio e o cliente volta a ser lead. A ETAPA de volta
 * varia com o motivo (Qualificação / Aquecimento / Pós-Visita). O motivo vai pro
 * histórico via moveLead; o sync trigger arquiva o negócio.
 */
export function RegredirDialog({ open, onOpenChange, onConfirm, stages }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: (motivo: string, destinoStageId: string) => Promise<void> | void; stages?: PipelineStage[] }) {
  const destinos = REGREDIR_DESTINOS
    .map((d) => ({ ...d, stage: (stages || []).find((s) => s.tipo === d.tipo) }))
    .filter((d): d is typeof d & { stage: PipelineStage } => !!d.stage);
  const [motivo, setMotivo] = useState("");
  const [destino, setDestino] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (open) {
      setMotivo("");
      const pos = destinos.find((d) => d.tipo === "pos_visita");
      setDestino((pos ?? destinos[0])?.stage.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const confirmar = async () => {
    if (!destino) return;
    setSalvando(true);
    try { await onConfirm(motivo.trim(), destino); onOpenChange(false); }
    finally { setSalvando(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !salvando) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">↩ Regredir — arquivar negócio</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          O negócio será <b>fechado (arquivado)</b> e o cliente <b>volta a ser lead</b>. Escolhe pra onde ele volta (conforme o motivo) — pra reabrir depois é só "virar negócio" de novo:
        </p>
        <div className="grid gap-1.5">
          {destinos.map((d) => (
            <Button
              key={d.tipo}
              type="button"
              onClick={() => setDestino(d.stage.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                destino === d.stage.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
              )}
            >
              <span className={cn("h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors", destino === d.stage.id ? "border-primary bg-primary" : "border-muted-foreground/40")} />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold leading-tight">{d.label}</span>
                <span className="block text-[11px] text-muted-foreground leading-tight">{d.hint}</span>
              </span>
            </Button>
          ))}
        </div>
        <Textarea rows={2} placeholder="Motivo (fica no histórico) — ex.: cliente pediu pra repensar…" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="text-sm" />
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button size="sm" onClick={confirmar} disabled={salvando || !motivo.trim() || !destino}>{salvando ? "Regredindo…" : "Regredir"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NegOverflowMenu({ leadId, nome, passo, stages, onMoveLead, onOpen }: { leadId: string | null; nome: string; passo?: ColKey; stages?: PipelineStage[]; onMoveLead?: MoveLeadFn; onOpen: () => void }) {
  const [registrar, setRegistrar] = useState(false);
  const [lembrete, setLembrete] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [discardTipo, setDiscardTipo] = useState<"reengajavel" | "definitivo">("reengajavel");
  const [regredirOpen, setRegredirOpen] = useState(false);
  const [confirmarOpen, setConfirmarOpen] = useState(false);
  const [jornadaEtapa, setJornadaEtapa] = useState<PipelineStage | null>(null);
  const queryClient = useQueryClient();
  if (!leadId) return null;

  const flowStages = (stages || []).filter((s) => FLOW_TIPOS.includes(s.tipo)).sort((a, b) => a.ordem - b.ordem);
  const currentTipo = passo ? PASSO_TIPO[passo] : undefined;
  // "Mudar de etapa": só entre etapas comerciais + Ganho (voltar/avançar dentro de Negócios).
  // Pós-Visita não entra aqui — sair do fluxo comercial é o "Regredir".
  const changeStages = flowStages.filter((s) => s.tipo !== "pos_visita");
  // "Regredir" = arquivar o negócio e mandar o cliente de volta pro pipeline (vira lead de novo,
  // em Pós-Visita). Só faz sentido onde existe negócio: documentacao/proposta/contrato_gerado.
  const temNegocio = !!currentTipo && ["documentacao", "proposta", "contrato_gerado"].includes(currentTipo);
  const posVisitaStage = flowStages.find((s) => s.tipo === "pos_visita") || null;
  const canRegredir = temNegocio && !!posVisitaStage;
  const mover = async (stageId: string) => {
    if (!onMoveLead) return;
    const etapa = stages?.find(s => s.id === stageId);
    if (etapa?.tipo === "venda") {
      setConfirmarOpen(true);
      return;
    }
    if (etapa && COMMERCIAL_TIPOS.includes(etapa.tipo)) {
      setJornadaEtapa(etapa);
      return;
    }
    await onMoveLead(leadId, stageId);
    queryClient.invalidateQueries({ queryKey: ["negocios-board"] });
  };
  const refetch = () => queryClient.invalidateQueries({ queryKey: ["negocios-board"] });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            onClick={(e) => e.stopPropagation()}
            aria-label="Ações do negócio"
            variant="ghost" size="icon" className="h-8 w-8 shrink-0 -mr-1 -mt-0.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 data-[state=open]:text-foreground data-[state=open]:bg-muted/60 transition-colors"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => setRegistrar(true)} className="text-sm font-semibold text-primary focus:text-primary">
            <span className="mr-2">⚡</span>Registrar atividade
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setLembrete(true)} className="text-sm">
            <span className="mr-2">📌</span>Criar tarefa
          </DropdownMenuItem>

          {onMoveLead && flowStages.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-sm"><span className="mr-2">↔</span>Mudar de etapa</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-52">
                    {changeStages.map((s) => (
                      <DropdownMenuItem key={s.id} disabled={s.tipo === currentTipo} onClick={() => mover(s.id)} className="text-sm gap-2">
                        <span className="h-2 w-2 rounded-full inline-block shrink-0" style={{ background: s.cor || "hsl(var(--primary))" }} />
                        {s.nome}{s.tipo === "venda" ? " 🏆" : ""}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              {canRegredir && (
                <DropdownMenuItem onClick={() => setRegredirOpen(true)} className="text-sm text-warning-700 dark:text-warning-500 focus:text-warning-700 dark:focus:text-warning-500">
                  <span className="mr-2">↩</span>Regredir (arquiva, vira lead)
                </DropdownMenuItem>
              )}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpen} className="text-sm"><span className="mr-2">↗</span>Abrir negócio</DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setDiscardTipo("reengajavel"); setDiscard(true); }} className="text-sm text-warning-700 dark:text-warning-500 focus:text-warning-700 dark:focus:text-warning-500">
            <span className="mr-2">🗑️</span>Descartar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setDiscardTipo("definitivo"); setDiscard(true); }} className="text-sm text-destructive focus:text-destructive">
            <span className="mr-2">📦</span>Inativar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div data-no-card-click onClick={(e) => e.stopPropagation()}>
        <JornadaNegocioDialog leadId={leadId} etapa={jornadaEtapa} onClose={() => setJornadaEtapa(null)}
          onSaved={() => { void refetch(); }} />
        <Dialog open={confirmarOpen} onOpenChange={setConfirmarOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90dvh] overflow-y-auto">
            <ConfirmarVendaForm leadId={leadId} nome={nome} onCancel={() => setConfirmarOpen(false)}
              onConfirmed={() => { setConfirmarOpen(false); refetch(); }} />
          </DialogContent>
        </Dialog>
        <CriarTarefaModal open={lembrete} lead={{ id: leadId, nome }} onClose={() => setLembrete(false)} />
        {registrar && (
          <RegistrarAtividadeModal lead={{ id: leadId, nome }} onClose={() => setRegistrar(false)} onSaved={() => invalidateTaskQueries(queryClient, leadId)} />
        )}
        {discard && (
          <DiscardLeadDialog open={discard} onOpenChange={setDiscard} leadId={leadId} leadNome={nome} stages={stages || []} defaultTipo={discardTipo} onDone={refetch} />
        )}
        <RegredirDialog
          open={regredirOpen}
          onOpenChange={setRegredirOpen}
          stages={stages}
          onConfirm={async (motivo, destinoStageId) => {
            if (!onMoveLead || !destinoStageId) return;
            await onMoveLead(leadId, destinoStageId, motivo || undefined);
            queryClient.invalidateQueries({ queryKey: ["negocios-board"] });
          }}
        />
      </div>
    </>
  );
}

