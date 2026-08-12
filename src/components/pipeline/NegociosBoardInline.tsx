import { useEffect, useMemo, useRef, useState } from "react";
import { useNegociosBoard, type NegocioCard, type NegPasso, type ProntoVirar } from "@/hooks/useNegociosBoard";
import type { LeadSaude } from "@/lib/leadSaude";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Users, User, ArrowRight, History, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import DiscardLeadDialog from "./DiscardLeadDialog";
import type { PipelineStage, PipelineLead } from "@/hooks/usePipeline";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import PipelineStageTransitionPopup, { type TransitionResult } from "./PipelineStageTransitionPopup";

// Assinatura real do moveLead (aceita observação + dados da venda p/ o Ganho).
type MoveLeadFn = (leadId: string, newStageId: string, observacao?: string, dealDetails?: { vgvFinal?: number | null; dataAssinatura?: string | null; unidade?: string | null }) => void | Promise<unknown>;

function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Avatar do corretor: foto (avatar_url/gamificado) com fallback pras iniciais — igual ao card de leads.
function CorretorAvatar({ nome, url }: { nome: string; url?: string | null }) {
  if (url) return <img src={url} alt={nome} loading="lazy" className="w-[18px] h-[18px] rounded-full object-cover shrink-0" />;
  return <div className="w-[18px] h-[18px] rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7e22ce] text-white flex items-center justify-center font-semibold text-[8px] shrink-0">{getInitials(nome)}</div>;
}
import { useIsMobile } from "@/hooks/use-mobile";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateTaskQueries } from "@/lib/taskQueryUtils";
import RegistrarAtividadeModal from "./RegistrarAtividadeModal";
import CriarLembreteModal from "./CriarLembreteModal";

/**
 * NegociosBoardInline — o board de Negócios DENTRO do pipeline (aba "Negócios").
 * Mesmo visual do kanban de leads, mas as colunas são os PASSOS comerciais reais:
 *   Pós-Visita → Documentação → Proposta → Contrato → Ganho.
 * Clicar num card abre o MODAL REAL do lead (via onOpenLead).
 * No mobile vira lista vertical com abas de coluna (igual ao pipeline de leads).
 * ⚡ Registrar em cada card = paridade com o card de leads (mesmo modal).
 */

type ColKey = "pos_visita" | NegPasso;
const COLS: { key: ColKey; nm: string; dot: string; emoji: string }[] = [
  { key: "pos_visita", nm: "Pós-Visita", dot: "bg-cyan-500", emoji: "🏠" },
  { key: "documentacao", nm: "Documentação", dot: "bg-sky-500", emoji: "📄" },
  { key: "proposta", nm: "Proposta", dot: "bg-violet-500", emoji: "📝" },
  { key: "contrato", nm: "Contrato", dot: "bg-indigo-500", emoji: "📑" },
  { key: "ganho", nm: "Ganho", dot: "bg-emerald-500", emoji: "✅" },
];

function money(reais: number | null): string | null {
  if (reais == null || reais === 0) return null;
  if (reais >= 1_000_000) return "R$ " + (reais / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " mi";
  if (reais >= 1000) return "R$ " + Math.round(reais / 1000) + " mil";
  return "R$ " + reais;
}
// Faixa de SAÚDE — MESMO padrão do card de leads (CardMinimal / SIDEBAR_BY_SAUDE).
const SAUDE_STRIPE: Record<LeadSaude, string> = {
  verde: "before:bg-emerald-500",
  ambar: "before:bg-amber-500",
  vermelho: "before:bg-red-500",
  estagnado: "before:bg-violet-500",
  terminal: "before:bg-emerald-500", // ganho = venda (verde sucesso)
};
function stripe(saude: LeadSaude): string {
  return SAUDE_STRIPE[saude] ?? "before:bg-amber-500";
}

type Lens = "meus" | "equipe";

interface NegociosBoardProps {
  onOpenLead: (leadId: string) => void;
  canSeeEquipe?: boolean;
  stages?: PipelineStage[];
  onMoveLead?: MoveLeadFn;
  searchTerm?: string;
  corretorFilter?: string; // user_id do corretor, "all" ou "sem_corretor"
  saudeFilter?: LeadSaude | null; // filtro de saúde (atenção=ambar / desatualizado=vermelho / estagnado)
  gestorTeamUserIds?: string[] | null; // user_ids do time do gestor (null = sem filtro de gestor)
}

export default function NegociosBoardInline({ onOpenLead, canSeeEquipe = true, stages = [], onMoveLead, searchTerm = "", corretorFilter = "all", saudeFilter = null, gestorTeamUserIds = null }: NegociosBoardProps) {
  const { data, isLoading } = useNegociosBoard();
  const [lens, setLens] = useState<Lens>(canSeeEquipe ? "equipe" : "meus");
  const isMobile = useIsMobile();
  const [mobileCol, setMobileCol] = useState<ColKey>("proposta");

  const q = searchTerm.trim().toLowerCase();
  const corr = corretorFilter && corretorFilter !== "all" ? corretorFilter : null;
  const gestorSet = gestorTeamUserIds ? new Set(gestorTeamUserIds) : null;
  const gestorKey = gestorTeamUserIds ? gestorTeamUserIds.join(",") : "";
  const matchCorretor = (userId: string | null) => !corr || (corr === "sem_corretor" ? !userId : userId === corr);
  const matchGestor = (userId: string | null) => !gestorSet || (!!userId && gestorSet.has(userId));
  const negocios = useMemo(() => {
    let all = data?.negocios ?? [];
    if (lens === "meus") all = all.filter((n) => n.meu);
    if (gestorSet) all = all.filter((n) => matchGestor(n.corretorUserId));
    if (corr) all = all.filter((n) => matchCorretor(n.corretorUserId));
    if (saudeFilter) all = all.filter((n) => n.saude === saudeFilter);
    if (q) all = all.filter((n) => n.cliente.toLowerCase().includes(q) || (n.empreendimento || "").toLowerCase().includes(q));
    return all;
  }, [data, lens, q, corr, saudeFilter, gestorKey]);
  const prontos = useMemo(() => {
    let all = data?.prontos ?? [];
    if (lens === "meus") all = all.filter((p) => p.meu);
    if (gestorSet) all = all.filter((p) => matchGestor(p.corretorUserId));
    if (corr) all = all.filter((p) => matchCorretor(p.corretorUserId));
    if (saudeFilter) all = all.filter((p) => p.saude === saudeFilter);
    if (q) all = all.filter((p) => p.nome.toLowerCase().includes(q) || (p.empreendimento || "").toLowerCase().includes(q));
    return all;
  }, [data, lens, q, corr, saudeFilter, gestorKey]);

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

  // ---------- ARRASTAR (desktop) — FONTE ÚNICA: tudo passa pelo mesmo moveLead ----------
  // Processo (Pós-Visita→Doc→Proposta→Contrato) = move na hora (fricção-zero, igual leads).
  // Ganho = abre o MESMO form de venda do pipeline (VGV/data/unidade). Voltar pra Pós-Visita
  // vindo de etapa comercial = Regredir (arquiva o negócio) via o MESMO RegredirDialog.
  const queryClient = useQueryClient();
  const dragRef = useRef<{ leadId: string; fromTipo: string } | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColKey | null>(null);
  const [ganhoDrop, setGanhoDrop] = useState<{ leadId: string; nome: string; vgv: number | null } | null>(null);
  const [regredirDrop, setRegredirDrop] = useState<{ leadId: string; nome: string } | null>(null);
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
    // Processo → move na hora.
    Promise.resolve(onMoveLead(drag.leadId, targetStage.id)).then(invalidateBoard);
  };

  // ---------- Lente Meus/Equipe (compartilhado) ----------
  const lensToggle = canSeeEquipe && (
    <div className="mb-2 flex items-center gap-2">
      <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
        <button onClick={() => setLens("meus")} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-semibold", lens === "meus" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}><User className="h-3.5 w-3.5" /> Meus</button>
        <button onClick={() => setLens("equipe")} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-semibold", lens === "equipe" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}><Users className="h-3.5 w-3.5" /> Equipe</button>
      </div>
      {!isMobile && <span className="text-[11.5px] text-muted-foreground">o fluxo comercial em colunas · clique abre o negócio no modal do lead</span>}
    </div>
  );

  // ---------- MOBILE: abas de coluna + lista vertical ----------
  if (isMobile) {
    const activeItems = itemsOf(mobileCol);
    const activeIsPos = mobileCol === "pos_visita";
    return (
      <div className="flex h-full min-h-0 flex-col px-3 pt-2">
        {lensToggle}
        {/* Abas horizontais das colunas (igual ao pipeline de leads no mobile) */}
        <div className="scrollbar-none -mx-3 flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3">
          {COLS.map((c) => {
            const info = colInfo(c.key);
            const active = c.key === mobileCol;
            return (
              <button
                key={c.key}
                onClick={() => setMobileCol(c.key)}
                className={cn(
                  "flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-2.5 py-2 text-[12px] font-semibold transition-colors",
                  active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground/80"
                )}
              >
                <span className="text-[13px]">{c.emoji}</span>
                {c.nm}
                <span className={cn("rounded-full px-1.5 py-px text-[10px] font-bold", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{info.count}</span>
              </button>
            );
          })}
        </div>
        {/* VGV da coluna ativa */}
        {!activeIsPos && (
          <div className="flex shrink-0 items-center justify-between px-1 pt-2 text-[11px] text-muted-foreground">
            <span>VGV da etapa</span>
            <span className={cn("font-bold", mobileCol === "ganho" ? "text-emerald-600" : "text-foreground")}>{money(colInfo(mobileCol).vgv) || "—"}</span>
          </div>
        )}
        {/* Lista vertical */}
        {isLoading ? (
          <div className="mt-2 flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
        ) : (
          <div className="mt-2 flex flex-1 flex-col gap-2 overflow-y-auto pb-24">
            {activeIsPos ? (
              prontos.length === 0 ? <Empty /> : prontos.map((p) => <PosCard key={p.id} p={p} stages={stages} onMoveLead={onMoveLead} onOpenLead={onOpenLead} />)
            ) : activeItems.length === 0 ? <Empty /> : activeItems.map((n) => <NegCard key={n.id} n={n} lens={lens} stages={stages} onMoveLead={onMoveLead} onClick={() => n.pipelineLeadId && onOpenLead(n.pipelineLeadId)} />)}
          </div>
        )}
      </div>
    );
  }

  // ---------- DESKTOP: kanban horizontal ----------
  return (
    <div className="flex h-full min-h-0 flex-col px-4 pt-2">
      {lensToggle}
      {isLoading ? (
        <div className="flex gap-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-72 w-64 shrink-0 rounded-2xl" />)}</div>
      ) : (
        <div className="flex flex-1 gap-3 overflow-x-auto pb-3">
          {COLS.map((c) => {
            const info = colInfo(c.key);
            const isPos = c.key === "pos_visita";
            const items = itemsOf(c.key);
            const over = dragOverCol === c.key;
            return (
              <div
                key={c.key}
                className={cn("flex w-[264px] shrink-0 flex-col rounded-2xl bg-muted/40 transition-colors", over && "bg-primary/5 ring-2 ring-primary/40")}
                onDragOver={(e) => { if (dragRef.current) { e.preventDefault(); if (dragOverCol !== c.key) setDragOverCol(c.key); } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol((v) => (v === c.key ? null : v)); }}
                onDrop={(e) => { e.preventDefault(); dropOnCol(c.key); }}
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full", c.dot)} />
                  <span className="text-[12.5px] font-bold">{c.nm}</span>
                  <span className="rounded-full bg-background px-1.5 text-[10px] font-bold text-muted-foreground">{info.count}</span>
                  {!isPos && <span className={cn("ml-auto text-[11px] font-bold", c.key === "ganho" && "text-emerald-600")}>{money(info.vgv) || "—"}</span>}
                </div>
                <div className="flex flex-col gap-2 overflow-y-auto px-2 pb-2 min-h-[60px]">
                  {isPos ? (
                    prontos.length === 0 ? <Empty /> : prontos.map((p) => <PosCard key={p.id} p={p} stages={stages} onMoveLead={onMoveLead} onOpenLead={onOpenLead} onDragStartCard={onMoveLead ? beginDrag : undefined} />)
                  ) : items.length === 0 ? <Empty /> : items.map((n) => <NegCard key={n.id} n={n} lens={lens} stages={stages} onMoveLead={onMoveLead} onClick={() => n.pipelineLeadId && onOpenLead(n.pipelineLeadId)} onDragStartCard={onMoveLead ? beginDrag : undefined} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ganho por arrastar → MESMO form de venda do pipeline (VGV/data/unidade reais). */}
      {ganhoDrop && vendaStage && (
        <PipelineStageTransitionPopup
          open={!!ganhoDrop}
          onOpenChange={(v) => { if (!v) setGanhoDrop(null); }}
          lead={{ id: ganhoDrop.leadId, nome: ganhoDrop.nome, valor_estimado: ganhoDrop.vgv } as unknown as PipelineLead}
          targetStage={vendaStage}
          onConfirm={(r: TransitionResult) => {
            const ex = r.extraData || {};
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

function Empty() { return <div className="rounded-xl border border-dashed border-border/60 py-5 text-center text-[11px] text-muted-foreground">—</div>; }

// Menu "⋯" curado do card de negócio — mesmo padrão do CardOverflowMenu do lead.
const FLOW_TIPOS = ["pos_visita", "documentacao", "proposta", "contrato_gerado", "venda"];
const PASSO_TIPO: Record<string, string> = { pos_visita: "pos_visita", documentacao: "documentacao", proposta: "proposta", contrato: "contrato_gerado", ganho: "venda" };
// Etapas comerciais (têm negócio). Sair delas pra Pós-Visita = Regredir (arquiva).
const COMMERCIAL_TIPOS = ["documentacao", "proposta", "contrato_gerado"];

// Destinos do Regredir — o cliente volta a ser lead, mas a etapa varia com o motivo.
const REGREDIR_DESTINOS = [
  { tipo: "qualificacao", label: "Qualificação", hint: "quer mais opções" },
  { tipo: "aquecimento", label: "Aquecimento", hint: "quer mais tempo pra ver outras coisas" },
  { tipo: "pos_visita", label: "Pós-Visita", hint: "ainda está definindo" },
];

/**
 * RegredirDialog — FONTE ÚNICA do "Regredir" (usado pelo menu ⋯ E pelo arrastar).
 * Regra do Lucas: arquiva o negócio e o cliente volta a ser lead. A ETAPA de volta
 * varia com o motivo (Qualificação / Aquecimento / Pós-Visita). O motivo vai pro
 * histórico via moveLead; o sync trigger arquiva o negócio.
 */
function RegredirDialog({ open, onOpenChange, onConfirm, stages }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: (motivo: string, destinoStageId: string) => Promise<void> | void; stages?: PipelineStage[] }) {
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
            <button
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
            </button>
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

function NegOverflowMenu({ leadId, nome, passo, stages, onMoveLead, onOpen }: { leadId: string | null; nome: string; passo?: ColKey; stages?: PipelineStage[]; onMoveLead?: MoveLeadFn; onOpen: () => void }) {
  const [registrar, setRegistrar] = useState(false);
  const [lembrete, setLembrete] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [discardTipo, setDiscardTipo] = useState<"reengajavel" | "definitivo">("reengajavel");
  const [regredirOpen, setRegredirOpen] = useState(false);
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
    await onMoveLead(leadId, stageId);
    queryClient.invalidateQueries({ queryKey: ["negocios-board"] });
  };
  const refetch = () => queryClient.invalidateQueries({ queryKey: ["negocios-board"] });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            aria-label="Ações do negócio"
            className="shrink-0 -mr-1 -mt-0.5 p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-muted/60 data-[state=open]:text-foreground data-[state=open]:bg-muted/60 transition-colors"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => setRegistrar(true)} className="text-sm font-semibold text-primary focus:text-primary">
            <span className="mr-2">⚡</span>Registrar atividade
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setLembrete(true)} className="text-sm">
            <span className="mr-2">📌</span>Criar lembrete
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
                        <span className="h-2 w-2 rounded-full inline-block shrink-0" style={{ background: s.cor || "#999" }} />
                        {s.nome}{s.tipo === "venda" ? " 🏆" : ""}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              {canRegredir && (
                <DropdownMenuItem onClick={() => setRegredirOpen(true)} className="text-sm text-amber-700 dark:text-amber-500 focus:text-amber-700 dark:focus:text-amber-500">
                  <span className="mr-2">↩</span>Regredir (arquiva, vira lead)
                </DropdownMenuItem>
              )}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpen} className="text-sm"><span className="mr-2">↗</span>Abrir negócio</DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setDiscardTipo("reengajavel"); setDiscard(true); }} className="text-sm text-amber-700 dark:text-amber-500 focus:text-amber-700 dark:focus:text-amber-500">
            <span className="mr-2">🗑️</span>Descartar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setDiscardTipo("definitivo"); setDiscard(true); }} className="text-sm text-destructive focus:text-destructive">
            <span className="mr-2">📦</span>Inativar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div data-no-card-click onClick={(e) => e.stopPropagation()}>
        <CriarLembreteModal open={lembrete} lead={{ id: leadId, nome }} onClose={() => setLembrete(false)} />
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

// Card raiz clicável (div, não button — permite botões de ação aninhados).
// Arrastável quando recebe onDragStart (desktop). O drag não atrapalha o clique:
// clicar sem mover abre o modal; arrastar dispara o dragstart.
function CardRoot({ onClick, className, children, onDragStart }: { onClick: () => void; className?: string; children: React.ReactNode; onDragStart?: (e: React.DragEvent) => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={cn(
        "group relative shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border bg-card p-2.5 pl-3.5 text-left transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 before:absolute before:inset-y-0 before:left-0 before:w-1",
        onDragStart && "active:cursor-grabbing",
        className
      )}
    >
      {children}
    </div>
  );
}

function PosCard({ p, stages, onMoveLead, onOpenLead, onDragStartCard }: { p: ProntoVirar; stages?: PipelineStage[]; onMoveLead?: MoveLeadFn; onOpenLead: (leadId: string) => void; onDragStartCard?: (leadId: string, fromTipo: string) => void }) {
  const queryClient = useQueryClient();
  const docStage = (stages || []).find((s) => s.tipo === "documentacao");
  const virar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMoveLead && docStage) {
      await onMoveLead(p.id, docStage.id);
      queryClient.invalidateQueries({ queryKey: ["negocios-board"] });
    } else {
      onOpenLead(p.id); // fallback: sem etapa/handler, abre o modal
    }
  };
  return (
    <CardRoot
      onClick={() => onOpenLead(p.id)}
      className={stripe(p.saude)}
      onDragStart={onDragStartCard ? () => onDragStartCard(p.id, "pos_visita") : undefined}
    >
      <div className="absolute right-1.5 top-1.5 z-10">
        <NegOverflowMenu leadId={p.id} nome={p.nome} passo="pos_visita" stages={stages} onMoveLead={onMoveLead} onOpen={() => onOpenLead(p.id)} />
      </div>
      <div className="mb-1 flex items-center gap-1.5 pr-6">
        <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-tight", p.sinal === "quente" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700")}>{p.sinal === "quente" ? "🔥 Quente" : "😐 Interesse"}</span>
      </div>
      <div className="truncate text-[13px] font-bold">{p.nome}</div>
      <div className="truncate text-[11px] text-muted-foreground">{p.empreendimento}</div>
      <div className="mt-1.5 flex items-center gap-1.5">
        {p.corretor && p.corretor !== "—" && (
          <>
            <CorretorAvatar nome={p.corretor} url={p.corretorAvatar} />
            <span className="truncate text-[11px] text-muted-foreground">{p.corretor.split(" ")[0]}</span>
          </>
        )}
        <button type="button" onClick={virar} title="Mover para Documentação (iniciar negócio)" className="ml-auto inline-flex items-center gap-0.5 rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shrink-0 hover:bg-primary/90 transition-colors">virar negócio <ArrowRight className="h-2.5 w-2.5" /></button>
      </div>
    </CardRoot>
  );
}

// Pill de sub-status no MESMO padrão do CardMinimal (bg-X-100 text-X-700).
const PILL_BASE = "shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold leading-tight whitespace-nowrap";
const PASSO_PILL: Record<NegPasso, { emoji: string; cls: string; nome: string }> = {
  documentacao: { emoji: "📄", cls: "bg-sky-100 text-sky-700", nome: "Documentação" },
  proposta: { emoji: "📝", cls: "bg-violet-100 text-violet-700", nome: "Proposta" },
  contrato: { emoji: "📑", cls: "bg-indigo-100 text-indigo-700", nome: "Contrato" },
  ganho: { emoji: "✅", cls: "bg-emerald-100 text-emerald-700", nome: "Assinado" },
};
function subBadge(n: NegocioCard): { emoji: string; cls: string; label: string } {
  const meta = PASSO_PILL[n.passo];
  return { emoji: meta.emoji, cls: meta.cls, label: n.detalhe ? n.detalhe.charAt(0).toUpperCase() + n.detalhe.slice(1) : meta.nome };
}

function NegCard({ n, lens, stages, onMoveLead, onClick, onDragStartCard }: { n: NegocioCard; lens: Lens; stages?: PipelineStage[]; onMoveLead?: MoveLeadFn; onClick: () => void; onDragStartCard?: (leadId: string, fromTipo: string) => void }) {
  const ganho = n.fase === "ganho";
  const sb = subBadge(n);
  // Cards de Ganho (venda fechada) NÃO arrastam — não se "desvende" por engano.
  const canDrag = !!onDragStartCard && !ganho && !!n.pipelineLeadId;
  return (
    <CardRoot
      onClick={onClick}
      className={stripe(n.saude)}
      onDragStart={canDrag ? () => onDragStartCard!(n.pipelineLeadId!, PASSO_TIPO[n.passo]) : undefined}
    >
      {/* Menu ⋯ fixo no canto superior direito — igual ao card de leads */}
      <div className="absolute right-1.5 top-1.5 z-10">
        <NegOverflowMenu leadId={n.pipelineLeadId} nome={n.cliente} passo={n.passo} stages={stages} onMoveLead={onMoveLead} onOpen={onClick} />
      </div>
      {/* Linha de sub-status (pill) */}
      <div className="mb-1 flex flex-wrap items-center gap-1.5 pr-6">
        {ganho && n.dataAssinatura
          ? <span className={cn(PILL_BASE, "bg-emerald-100 text-emerald-700")}>✅ Assinado {n.dataAssinatura.slice(0, 5)}</span>
          : <span className={cn(PILL_BASE, sb.cls)}>{sb.emoji} {sb.label}</span>}
        {n.ceo && <span className={cn(PILL_BASE, "bg-amber-100 text-amber-700")}>CEO</span>}
      </div>
      {/* Nome + VGV */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-bold">{n.cliente}</span>
        {n.vgv == null
          ? <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-700">falta VGV</span>
          : <span className="shrink-0 text-[12.5px] font-extrabold tabular-nums">{money(n.vgv)}</span>}
      </div>
      <div className="truncate text-[11px] text-muted-foreground">{n.empreendimento}</div>

      {/* Divisor sutil + última atividade (sóbrio, igual ao card de leads) */}
      <div className="mt-2 border-t border-border/40" />
      <div className="mt-2 flex items-center gap-1.5 min-w-0">
        <History className="h-3 w-3 shrink-0 text-muted-foreground/70" />
        <span className={cn("flex-1 min-w-0 truncate text-[11px]", n.tone === "bad" ? "text-rose-600 font-medium" : n.tone === "warn" ? "text-amber-600 font-medium" : "text-muted-foreground")}>
          {ganho && n.dataAssinatura ? `assinado · ${n.dataAssinatura.slice(0, 5)}` : `última atividade · há ${n.dias}d`}
        </span>
      </div>

      {/* Rodapé: de quem é o negócio (corretor) — sempre visível, como no card de leads */}
      {n.corretor && n.corretor !== "—" && (
        <div className="mt-1.5 pt-1.5 border-t border-border/40 flex items-center gap-1.5 min-w-0">
          <CorretorAvatar nome={n.corretor} url={n.corretorAvatar} />
          <span className="truncate text-[11px] text-muted-foreground">{n.corretor}</span>
        </div>
      )}
    </CardRoot>
  );
}
