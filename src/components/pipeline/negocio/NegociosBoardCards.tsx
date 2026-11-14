import { useState } from "react";
import type { ReactNode, DragEvent, MouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadSaude } from "@/lib/leadSaude";
import type { PipelineStage } from "@/hooks/usePipeline";
import type { NegocioCard, NegPasso, ProntoVirar } from "@/hooks/useNegociosBoard";
import { ParceriaSelo } from "../ParceriaSelo";
import { JornadaNegocioDialog } from "./JornadaNegocioDialog";
import { NegOverflowMenu } from "./NegociosBoardActions";
import { money, PASSO_TIPO, type MoveLeadFn } from "./boardPresentation";
import { Button } from "@/components/ui/button";
import { formatBRT } from "@/lib/brtTime";
const SAUDE_DOT: Record<LeadSaude, string> = { verde: "bg-success-500", ambar: "bg-warning-500", vermelho: "bg-danger-500", estagnado: "bg-purple-500", terminal: "bg-success-500" };
const SAUDE_LABEL: Record<LeadSaude, string> = { verde: "Em dia", ambar: "Atenção", vermelho: "Desatualizado", estagnado: "Estagnado", terminal: "Venda assinada" };
function UltimaAtividade({ saude, dias }: { saude: LeadSaude; dias: number | null }) {
  return <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground"><span className={cn("size-2 shrink-0 rounded-full", SAUDE_DOT[saude])} role="img" aria-label={SAUDE_LABEL[saude]} title={SAUDE_LABEL[saude]} /><span>{dias === null ? "Sem atividade registrada" : `Última atividade · há ${dias}d`}</span></div>;
}
function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Avatar do corretor: foto (avatar_url/gamificado) com fallback pras iniciais — igual ao card de leads.
function CorretorAvatar({ nome, url }: { nome: string; url?: string | null }) {
  if (url) return <img src={url} alt={nome} loading="lazy" className="w-[18px] h-[18px] rounded-full object-cover shrink-0" />;
  return <div className="w-[18px] h-[18px] rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-[8px] shrink-0">{getInitials(nome)}</div>;
}
// Card raiz clicável (div, não button — permite botões de ação aninhados).
// Arrastável quando recebe onDragStart (desktop). O drag não atrapalha o clique:
// clicar sem mover abre o modal; arrastar dispara o dragstart.
function CardRoot({ onClick, className, children, onDragStart }: { onClick: () => void; className?: string; children: ReactNode; onDragStart?: (e: DragEvent) => void }) {
  return (
    <div
      role="button"
      data-negocio-card
      tabIndex={0}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={cn(
        "group relative min-w-0 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border bg-card p-3 text-left transition-shadow duration-short ease-move hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        onDragStart && "active:cursor-grabbing",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PosCard({ p, atividadeDias, stages, onMoveLead, onOpenLead, onDragStartCard }: { p: ProntoVirar; atividadeDias: number | null; stages?: PipelineStage[]; onMoveLead?: MoveLeadFn; onOpenLead: (leadId: string) => void; onDragStartCard?: (leadId: string, fromTipo: string) => void }) {
  const queryClient = useQueryClient();
  const [jornadaOpen, setJornadaOpen] = useState(false);
  const docStage = (stages || []).find((s) => s.tipo === "documentacao");
  const virar = (e: MouseEvent) => {
    e.stopPropagation();
    if (onMoveLead && docStage) {
      setJornadaOpen(true);
    } else {
      onOpenLead(p.id); // fallback: sem etapa/handler, abre o modal
    }
  };
  return (
    <CardRoot
      onClick={() => onOpenLead(p.id)}
      onDragStart={onDragStartCard ? () => onDragStartCard(p.id, "pos_visita") : undefined}
    >
      <div data-no-card-click onClick={e => e.stopPropagation()}>
        <JornadaNegocioDialog leadId={p.id} etapa={jornadaOpen && docStage ? docStage : null}
          onClose={() => setJornadaOpen(false)} onSaved={() => { void queryClient.invalidateQueries({ queryKey: ["negocios-board"] }); }} />
      </div>
      <div className="absolute right-1.5 top-1.5 z-10">
        <NegOverflowMenu leadId={p.id} nome={p.nome} passo="pos_visita" stages={stages} onMoveLead={onMoveLead} onOpen={() => onOpenLead(p.id)} />
      </div>
      <div className="mb-1 flex items-center gap-1.5 pr-6">
        <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-tight", p.sinal === "quente" ? "bg-danger-500/10 text-danger-500" : "bg-warning-500/10 text-warning-700 dark:text-warning-500")}>{p.sinal === "quente" ? "🔥 Quente" : "😐 Interesse"}</span>
      </div>
      <div className="line-clamp-2 break-words text-[13px] font-bold leading-5" title={p.nome}>{p.nome}</div>
      <div className="mt-0.5 line-clamp-2 break-words text-[11px] leading-4 text-muted-foreground" title={p.empreendimento}>{p.empreendimento}</div>
      <UltimaAtividade saude={p.saude} dias={atividadeDias} />
      <div className="mt-2 flex min-w-0 items-center gap-1.5">
        {p.corretor && p.corretor !== "—" && (
          <>
            <CorretorAvatar nome={p.corretor} url={p.corretorAvatar} />
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={p.corretor}>{p.corretor}</span>
          </>
        )}
        <Button variant="link" size="sm" onClick={virar} title="Mover para Documentação (iniciar negócio)" className="negocios-action ml-auto h-9 shrink-0 gap-1 px-0.5 text-[11px]">Virar negócio <ArrowRight /></Button>
      </div>
    </CardRoot>
  );
}

// Pill de sub-status no MESMO padrão do CardMinimal (bg-X-100 text-X-700).
const PILL_BASE = "shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold leading-tight whitespace-nowrap";
const PASSO_PILL: Record<NegPasso, { emoji: string; cls: string; nome: string }> = {
  documentacao: { emoji: "📄", cls: "negocios-primary-status", nome: "Documentação" },
  proposta: { emoji: "📝", cls: "bg-purple-500/10 text-purple-700 dark:text-purple-500", nome: "Proposta" },
  contrato: { emoji: "📑", cls: "negocios-primary-status", nome: "Contrato" },
  ganho: { emoji: "✅", cls: "bg-success-500/10 text-success-700 dark:text-success-500", nome: "Assinado" },
};
function subBadge(n: NegocioCard): { emoji: string; cls: string; label: string } {
  const meta = PASSO_PILL[n.passo];
  return { emoji: meta.emoji, cls: meta.cls, label: n.detalhe ? n.detalhe.charAt(0).toUpperCase() + n.detalhe.slice(1) : meta.nome };
}

export function NegCard({ n, atividadeDias, stages, onMoveLead, onClick, onDragStartCard }: { n: NegocioCard; atividadeDias: number | null; stages?: PipelineStage[]; onMoveLead?: MoveLeadFn; onClick: () => void; onDragStartCard?: (leadId: string, fromTipo: string) => void }) {
  const ganho = n.fase === "ganho";
  const sb = subBadge(n);
  // Cards de Ganho (venda fechada) NÃO arrastam — não se "desvende" por engano.
  const canDrag = !!onDragStartCard && !ganho && !!n.pipelineLeadId;
  return (
    <CardRoot
      onClick={onClick}
      onDragStart={canDrag ? () => { if (onDragStartCard && n.pipelineLeadId) onDragStartCard(n.pipelineLeadId, PASSO_TIPO[n.passo]); } : undefined}
    >
      {/* Menu ⋯ fixo no canto superior direito — igual ao card de leads */}
      <div className="absolute right-1.5 top-1.5 z-10">
        <NegOverflowMenu leadId={n.pipelineLeadId} nome={n.cliente} passo={n.passo} stages={stages} onMoveLead={onMoveLead} onOpen={onClick} />
      </div>
      {/* Linha de sub-status (pill) */}
      <div className="mb-1 flex flex-wrap items-center gap-1.5 pr-6">
        {ganho && n.dataAssinatura
          ? <span className={cn(PILL_BASE, PASSO_PILL.ganho.cls)}>✅ Assinado {formatBRT(n.dataAssinatura, "dd/MM")}</span>
          : <span className={cn(PILL_BASE, sb.cls)}>{sb.emoji} {sb.label}</span>}
        {n.ceo && <span className={cn(PILL_BASE, "bg-warning-500/10 text-warning-700 dark:text-warning-500")}>CEO</span>}
        <ParceriaSelo leadId={n.pipelineLeadId} />
      </div>
      {/* Nome + VGV */}
      <div className="line-clamp-2 break-words text-[13px] font-bold leading-5" title={n.cliente}>{n.cliente}</div>
      <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[11px] leading-4">
        <span className="min-w-0 break-words text-muted-foreground">{n.empreendimento}</span>
        {n.vgv == null
          ? <span className="text-warning-700 dark:text-warning-500">· Sem VGV</span>
          : <span className="whitespace-nowrap font-medium tabular-nums text-muted-foreground">· {money(n.vgv)}</span>}
      </div>

      {/* Divisor sutil + última atividade (sóbrio, igual ao card de leads) */}
      {ganho ? <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><CalendarCheck className="size-3.5 text-success-500" />{n.dataAssinatura ? `Assinado · ${formatBRT(n.dataAssinatura, "dd/MM/yyyy")}` : "Venda assinada"}</div> : <UltimaAtividade saude={n.saude} dias={atividadeDias} />}

      {/* Rodapé: de quem é o negócio (corretor) — sempre visível, como no card de leads */}
      {n.corretor && n.corretor !== "—" && (
        <div className="mt-2 flex items-center gap-1.5 min-w-0">
          <CorretorAvatar nome={n.corretor} url={n.corretorAvatar} />
          <span className="truncate text-[11px] text-muted-foreground">{n.corretor}</span>
        </div>
      )}
    </CardRoot>
  );
}
