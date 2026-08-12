import { useMemo, useState } from "react";
import { useNegociosBoard, type NegocioCard, type NegPasso, type ProntoVirar } from "@/hooks/useNegociosBoard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Users, User, ArrowRight, History, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
function stripe(tone: string, ganho: boolean): string {
  if (ganho) return "before:bg-emerald-500";
  if (tone === "bad") return "before:bg-red-500";
  if (tone === "warn") return "before:bg-amber-500";
  return "before:bg-emerald-500";
}

type Lens = "meus" | "equipe";

export default function NegociosBoardInline({ onOpenLead, canSeeEquipe = true }: { onOpenLead: (leadId: string) => void; canSeeEquipe?: boolean }) {
  const { data, isLoading } = useNegociosBoard();
  const [lens, setLens] = useState<Lens>(canSeeEquipe ? "equipe" : "meus");
  const isMobile = useIsMobile();
  const [mobileCol, setMobileCol] = useState<ColKey>("proposta");

  const negocios = useMemo(() => {
    const all = data?.negocios ?? [];
    return lens === "meus" ? all.filter((n) => n.meu) : all;
  }, [data, lens]);
  const prontos = useMemo(() => {
    const all = data?.prontos ?? [];
    return lens === "meus" ? all.filter((p) => p.meu) : all;
  }, [data, lens]);

  const byPasso = (p: NegPasso) => negocios.filter((n) => n.passo === p);
  const sum = (arr: { vgv?: number | null }[]) => arr.reduce((s, n) => s + (n.vgv || 0), 0);
  const colInfo = (k: ColKey) => k === "pos_visita" ? { count: prontos.length, vgv: 0 } : { count: byPasso(k).length, vgv: sum(byPasso(k)) };
  const itemsOf = (k: ColKey) =>
    k === "pos_visita" ? [] : [...byPasso(k as NegPasso)].sort((a, b) => (b.vgv || 0) - (a.vgv || 0));

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
              prontos.length === 0 ? <Empty /> : prontos.map((p) => <PosCard key={p.id} p={p} onClick={() => onOpenLead(p.id)} />)
            ) : activeItems.length === 0 ? <Empty /> : activeItems.map((n) => <NegCard key={n.id} n={n} lens={lens} onClick={() => n.pipelineLeadId && onOpenLead(n.pipelineLeadId)} />)}
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
            return (
              <div key={c.key} className="flex w-[264px] shrink-0 flex-col rounded-2xl bg-muted/40">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full", c.dot)} />
                  <span className="text-[12.5px] font-bold">{c.nm}</span>
                  <span className="rounded-full bg-background px-1.5 text-[10px] font-bold text-muted-foreground">{info.count}</span>
                  {!isPos && <span className={cn("ml-auto text-[11px] font-bold", c.key === "ganho" && "text-emerald-600")}>{money(info.vgv) || "—"}</span>}
                </div>
                <div className="flex flex-col gap-2 overflow-y-auto px-2 pb-2">
                  {isPos ? (
                    prontos.length === 0 ? <Empty /> : prontos.slice(0, 15).map((p) => <PosCard key={p.id} p={p} onClick={() => onOpenLead(p.id)} />)
                  ) : items.length === 0 ? <Empty /> : items.map((n) => <NegCard key={n.id} n={n} lens={lens} onClick={() => n.pipelineLeadId && onOpenLead(n.pipelineLeadId)} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Empty() { return <div className="rounded-xl border border-dashed border-border/60 py-5 text-center text-[11px] text-muted-foreground">—</div>; }

// Menu "⋯" curado do card de negócio — mesmo padrão do CardOverflowMenu do lead.
function NegOverflowMenu({ leadId, nome, onOpen }: { leadId: string | null; nome: string; onOpen: () => void }) {
  const [registrar, setRegistrar] = useState(false);
  const [lembrete, setLembrete] = useState(false);
  const queryClient = useQueryClient();
  if (!leadId) return null;
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
        <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => setRegistrar(true)} className="text-sm font-semibold text-primary focus:text-primary">
            <span className="mr-2">⚡</span>Registrar atividade
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setLembrete(true)} className="text-sm">
            <span className="mr-2">📌</span>Criar lembrete
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpen} className="text-sm">
            <span className="mr-2">↗</span>Abrir negócio
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div data-no-card-click onClick={(e) => e.stopPropagation()}>
        <CriarLembreteModal open={lembrete} lead={{ id: leadId, nome }} onClose={() => setLembrete(false)} />
        {registrar && (
          <RegistrarAtividadeModal
            lead={{ id: leadId, nome }}
            onClose={() => setRegistrar(false)}
            onSaved={() => invalidateTaskQueries(queryClient, leadId)}
          />
        )}
      </div>
    </>
  );
}

// Card raiz clicável (div, não button — permite botões de ação aninhados).
function CardRoot({ onClick, className, children }: { onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={cn(
        "group relative shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border bg-card p-2.5 pl-3.5 text-left transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 before:absolute before:inset-y-0 before:left-0 before:w-1",
        className
      )}
    >
      {children}
    </div>
  );
}

function PosCard({ p, onClick }: { p: ProntoVirar; onClick: () => void }) {
  return (
    <CardRoot onClick={onClick} className="before:bg-cyan-500">
      <div className="mb-1 flex items-start justify-between gap-1.5">
        <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-tight", p.sinal === "quente" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700")}>{p.sinal === "quente" ? "🔥 Quente" : "😐 Interesse"}</span>
        <NegOverflowMenu leadId={p.id} nome={p.nome} onOpen={onClick} />
      </div>
      <div className="truncate text-[13px] font-bold">{p.nome}</div>
      <div className="truncate text-[11px] text-muted-foreground">{p.empreendimento}</div>
      <div className="mt-1.5 flex items-center">
        <span className="ml-auto inline-flex items-center gap-0.5 rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">virar negócio <ArrowRight className="h-2.5 w-2.5" /></span>
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

function NegCard({ n, lens, onClick }: { n: NegocioCard; lens: Lens; onClick: () => void }) {
  const ganho = n.fase === "ganho";
  const sb = subBadge(n);
  return (
    <CardRoot onClick={onClick} className={stripe(n.tone, ganho)}>
      {/* Linha de sub-status (pill) + menu ⋯ — igual ao card de leads */}
      <div className="mb-1 flex items-start justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {ganho && n.dataAssinatura
            ? <span className={cn(PILL_BASE, "bg-emerald-100 text-emerald-700")}>✅ Assinado {n.dataAssinatura.slice(0, 5)}</span>
            : <span className={cn(PILL_BASE, sb.cls)}>{sb.emoji} {sb.label}</span>}
          {n.ceo && <span className={cn(PILL_BASE, "bg-amber-100 text-amber-700")}>CEO</span>}
        </div>
        <NegOverflowMenu leadId={n.pipelineLeadId} nome={n.cliente} onOpen={onClick} />
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

      {/* Rodapé: corretor (na lente Equipe) */}
      {lens === "equipe" && n.corretor && n.corretor !== "—" && (
        <div className="mt-1.5 pt-1.5 border-t border-border/40 flex items-center gap-1.5 min-w-0">
          <div className="w-[18px] h-[18px] rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7e22ce] text-white flex items-center justify-center font-semibold text-[8px] shrink-0">{getInitials(n.corretor)}</div>
          <span className="truncate text-[11px] text-muted-foreground">{n.corretor}</span>
        </div>
      )}
    </CardRoot>
  );
}
