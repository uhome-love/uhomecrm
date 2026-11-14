import { useState } from "react";
import type { ReactNode, DragEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, History } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadSaude } from "@/lib/leadSaude";
import type { PipelineStage } from "@/hooks/usePipeline";
import type { NegocioCard, NegPasso, ProntoVirar } from "@/hooks/useNegociosBoard";
import { ParceriaSelo } from "../ParceriaSelo";
import { JornadaNegocioDialog } from "./JornadaNegocioDialog";
import { NegOverflowMenu } from "./NegociosBoardActions";
import { money, SAUDE_STRIPE, PASSO_TIPO, type MoveLeadFn, type NegociosLens as Lens } from "./boardPresentation";
const stripe = (saude: LeadSaude) => SAUDE_STRIPE[saude];
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
      tabIndex={0}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
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

export function PosCard({ p, stages, onMoveLead, onOpenLead, onDragStartCard }: { p: ProntoVirar; stages?: PipelineStage[]; onMoveLead?: MoveLeadFn; onOpenLead: (leadId: string) => void; onDragStartCard?: (leadId: string, fromTipo: string) => void }) {
  const queryClient = useQueryClient();
  const [jornadaOpen, setJornadaOpen] = useState(false);
  const docStage = (stages || []).find((s) => s.tipo === "documentacao");
  const virar = async (e: React.MouseEvent) => {
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
      className={stripe(p.saude)}
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

export function NegCard({ n, lens, stages, onMoveLead, onClick, onDragStartCard }: { n: NegocioCard; lens: Lens; stages?: PipelineStage[]; onMoveLead?: MoveLeadFn; onClick: () => void; onDragStartCard?: (leadId: string, fromTipo: string) => void }) {
  const ganho = n.fase === "ganho";
  const sb = subBadge(n);
  // Cards de Ganho (venda fechada) NÃO arrastam — não se "desvende" por engano.
  const canDrag = !!onDragStartCard && !ganho && !!n.pipelineLeadId;
  return (
    <CardRoot
      onClick={onClick}
      className={stripe(n.saude)}
      onDragStart={canDrag ? () => { if (onDragStartCard && n.pipelineLeadId) onDragStartCard(n.pipelineLeadId, PASSO_TIPO[n.passo]); } : undefined}
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
        <ParceriaSelo leadId={n.pipelineLeadId} />
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
