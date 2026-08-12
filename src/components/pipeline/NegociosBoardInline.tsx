import { useMemo, useState } from "react";
import { useNegociosBoard, type NegocioCard, type NegPasso, type ProntoVirar } from "@/hooks/useNegociosBoard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Users, User, ArrowRight } from "lucide-react";

/**
 * NegociosBoardInline — o board de Negócios DENTRO do pipeline (aba "Negócios").
 * Mesmo visual do kanban de leads, mas as colunas são os PASSOS comerciais reais:
 *   Pós-Visita → Documentação → Proposta → Contrato → Ganho.
 * Clicar num card abre o MODAL REAL do lead (via onOpenLead). Read-only (fase 2).
 */

type ColKey = "pos_visita" | NegPasso;
const COLS: { key: ColKey; nm: string; dot: string }[] = [
  { key: "pos_visita", nm: "Pós-Visita", dot: "bg-cyan-500" },
  { key: "documentacao", nm: "Documentação", dot: "bg-sky-500" },
  { key: "proposta", nm: "Proposta", dot: "bg-violet-500" },
  { key: "contrato", nm: "Contrato", dot: "bg-indigo-500" },
  { key: "ganho", nm: "Ganho", dot: "bg-emerald-500" },
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

  return (
    <div className="flex h-full min-h-0 flex-col px-4 pt-2">
      {/* lente Meus/Equipe */}
      {canSeeEquipe && (
        <div className="mb-2 flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            <button onClick={() => setLens("meus")} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-semibold", lens === "meus" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}><User className="h-3.5 w-3.5" /> Meus</button>
            <button onClick={() => setLens("equipe")} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-semibold", lens === "equipe" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}><Users className="h-3.5 w-3.5" /> Equipe</button>
          </div>
          <span className="text-[11.5px] text-muted-foreground">o fluxo comercial em colunas · clique abre o negócio no modal do lead</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex gap-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-72 w-64 shrink-0 rounded-2xl" />)}</div>
      ) : (
        <div className="flex flex-1 gap-3 overflow-x-auto pb-3">
          {COLS.map((c) => {
            const info = colInfo(c.key);
            const isPos = c.key === "pos_visita";
            const items = isPos ? [] : [...byPasso(c.key as NegPasso)].sort((a, b) => (b.vgv || 0) - (a.vgv || 0));
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

function PosCard({ p, onClick }: { p: ProntoVirar; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative shrink-0 overflow-hidden rounded-xl border border-border bg-card p-2.5 pl-3.5 text-left transition-all hover:shadow-md before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-cyan-500">
      <div className="mb-1 flex items-center gap-1.5">
        <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-tight", p.sinal === "quente" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700")}>{p.sinal === "quente" ? "🔥 Quente" : "😐 Interesse"}</span>
      </div>
      <div className="truncate text-[13px] font-bold">{p.nome}</div>
      <div className="truncate text-[11px] text-muted-foreground">{p.empreendimento}</div>
      <div className="mt-1.5 flex items-center">
        <span className="ml-auto inline-flex items-center gap-0.5 rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">virar negócio <ArrowRight className="h-2.5 w-2.5" /></span>
      </div>
    </button>
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
    <button onClick={onClick} className={cn("relative shrink-0 overflow-hidden rounded-xl border border-border bg-card p-2.5 pl-3.5 text-left transition-all hover:shadow-md before:absolute before:inset-y-0 before:left-0 before:w-1", stripe(n.tone, ganho))}>
      {/* Linha de sub-status (pill) — igual ao card de leads */}
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
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
      {/* Base: corretor + dias parado */}
      <div className="mt-1 flex items-center gap-1.5">
        {lens === "equipe" && <span className="truncate text-[10.5px] font-semibold text-foreground/60">{n.corretor.split(" ")[0]}</span>}
        {!ganho && <span className={cn("ml-auto text-[10px] tabular-nums", n.tone === "bad" ? "font-bold text-rose-600" : n.tone === "warn" ? "text-amber-600" : "text-muted-foreground")}>há {n.dias}d na etapa</span>}
      </div>
    </button>
  );
}
