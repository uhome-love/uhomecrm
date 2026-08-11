import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNegociosBoard, type NegocioCard, type NegFase, type NegSub, type ProntoVirar } from "@/hooks/useNegociosBoard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Briefcase, Users, User, ArrowRight } from "lucide-react";

/**
 * NegociosWorkspace — PREVIEW read-only (rota /negocios-preview, admin).
 * Ideia final: MESMO visual do pipeline de leads, voltado ao negócio. Fluxo único
 * com uma divisão de momento (Leads | Negócios). Colunas = Pós-Visita → Em
 * Negociação → Contrato → Ganho (a pós-visita é a entrada, in-flow). Sub-status
 * visível no card + filtro no topo. Clicar abre o MODAL REAL do lead.
 */

type ColKey = "pos_visita" | "em_negociacao" | "contrato" | "ganho";
const COLS: { key: ColKey; nm: string; dot: string }[] = [
  { key: "pos_visita", nm: "Pós-Visita", dot: "bg-cyan-500" },
  { key: "em_negociacao", nm: "Em Negociação", dot: "bg-pink-500" },
  { key: "contrato", nm: "Contrato", dot: "bg-indigo-500" },
  { key: "ganho", nm: "Ganho", dot: "bg-emerald-500" },
];
const SUB_META: Record<NegSub, { nm: string; dot: string; soft: string }> = {
  proposta: { nm: "Proposta", dot: "bg-violet-500", soft: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400" },
  documentacao: { nm: "Documentação", dot: "bg-sky-500", soft: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400" },
  aprovacao_credito: { nm: "Crédito", dot: "bg-pink-500", soft: "bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400" },
  reserva: { nm: "Reserva", dot: "bg-teal-500", soft: "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400" },
};
const SUB_ORDER: NegSub[] = ["proposta", "documentacao", "aprovacao_credito", "reserva"];

function money(reais: number | null): string | null {
  if (reais == null || reais === 0) return null;
  if (reais >= 1_000_000) return "R$ " + (reais / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " mi";
  if (reais >= 1000) return "R$ " + Math.round(reais / 1000) + " mil";
  return "R$ " + reais;
}
function stripe(fase: NegFase | "pos_visita", tone: string): string {
  if (fase === "ganho") return "before:bg-emerald-500";
  if (tone === "bad") return "before:bg-red-500";
  if (tone === "warn") return "before:bg-amber-500";
  return "before:bg-emerald-500";
}

type Lens = "meus" | "equipe";

export default function NegociosWorkspace() {
  const { data, isLoading } = useNegociosBoard();
  const navigate = useNavigate();
  const [lens, setLens] = useState<Lens>("equipe");
  const [subF, setSubF] = useState<NegSub | "todos">("todos");

  const negocios = useMemo(() => {
    const all = data?.negocios ?? [];
    return lens === "meus" ? all.filter((n) => n.meu) : all;
  }, [data, lens]);
  const prontos = useMemo(() => {
    const all = data?.prontos ?? [];
    return lens === "meus" ? all.filter((p) => p.meu) : all;
  }, [data, lens]);

  const byFase = (f: NegFase) => negocios.filter((n) => n.fase === f);
  const sum = (arr: { vgv?: number | null }[]) => arr.reduce((s, n) => s + (n.vgv || 0), 0);
  const emNeg = byFase("em_negociacao");
  const emNegShown = subF === "todos" ? emNeg : emNeg.filter((n) => n.sub === subF);

  const abrirNeg = (n: NegocioCard) => { if (n.pipelineLeadId) navigate(`/pipeline-leads?lead=${n.pipelineLeadId}`); };
  const abrirLead = (p: ProntoVirar) => navigate(`/pipeline-leads?lead=${p.id}`);

  const Seg = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick}
      className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors",
        on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{children}</button>
  );

  const colData = (k: ColKey): { count: number; vgv: number } => {
    if (k === "pos_visita") return { count: prontos.length, vgv: 0 };
    const items = byFase(k as NegFase);
    return { count: items.length, vgv: sum(items) };
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-5 pb-16">
      {/* divisão de momento: Leads | Negócios (mesmo pipeline) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-xl border border-border bg-card p-1">
          <button onClick={() => navigate("/pipeline-leads")} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-bold text-muted-foreground hover:bg-muted">🌱 Leads</button>
          <span className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-[13px] font-bold text-background"><Briefcase className="h-4 w-4" /> Negócios</span>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          <Seg on={lens === "meus"} onClick={() => setLens("meus")}><User className="h-3.5 w-3.5" /> Meus</Seg>
          <Seg on={lens === "equipe"} onClick={() => setLens("equipe")}><Users className="h-3.5 w-3.5" /> Equipe</Seg>
        </div>
      </div>

      <div className="mb-3 flex items-baseline gap-2">
        <h1 className="text-lg font-bold tracking-tight">Negócios <span className="ml-1 rounded-md bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">preview</span></h1>
        <span className="text-[12.5px] text-muted-foreground">· o mesmo pipeline, voltado ao negócio · {lens === "equipe" ? "gerente gere aqui" : "seus negócios"}</span>
      </div>

      {/* filtro de sub-status no topo (sobre Em Negociação) */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Sub-status:</span>
        <button onClick={() => setSubF("todos")} className={cn("rounded-full border px-3 py-1 text-[12px] font-semibold", subF === "todos" ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-muted")}>Todos <span className="opacity-60">{emNeg.length}</span></button>
        {SUB_ORDER.map((s) => {
          const n = emNeg.filter((x) => x.sub === s).length;
          return <button key={s} onClick={() => setSubF(subF === s ? "todos" : s)}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold", subF === s ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-muted")}>
            <span className={cn("h-2 w-2 rounded-full", SUB_META[s].dot)} />{SUB_META[s].nm} <span className="opacity-60">{n}</span></button>;
        })}
      </div>

      {/* KANBAN — mesmo visual do pipeline */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-80 w-full rounded-xl" />)}</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {COLS.map((c) => {
            const cd = colData(c.key);
            return (
              <div key={c.key} className="flex w-[290px] shrink-0 flex-col rounded-2xl bg-muted/40">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full", c.dot)} />
                  <span className="text-[13px] font-bold">{c.nm}</span>
                  <span className="rounded-full bg-background px-2 text-[10.5px] font-bold text-muted-foreground">{cd.count}</span>
                  {c.key !== "pos_visita" && <span className={cn("ml-auto text-[11.5px] font-bold", c.key === "ganho" && "text-emerald-600")}>{money(cd.vgv) || "—"}</span>}
                </div>
                <div className="flex flex-col gap-2 px-2 pb-2">
                  {c.key === "pos_visita" ? (
                    prontos.length === 0 ? <Empty /> : prontos.slice(0, 10).map((p) => <PosVisitaCard key={p.id} p={p} onClick={() => abrirLead(p)} />)
                  ) : c.key === "em_negociacao" ? (
                    emNegShown.length === 0 ? <Empty /> : [...emNegShown].sort((a, b) => (b.vgv || 0) - (a.vgv || 0)).map((n) => <NegCard key={n.id} n={n} lens={lens} onClick={() => abrirNeg(n)} />)
                  ) : (
                    (() => { const items = byFase(c.key as NegFase); return items.length === 0 ? <Empty /> : [...items].sort((a, b) => (b.vgv || 0) - (a.vgv || 0)).map((n) => <NegCard key={n.id} n={n} lens={lens} onClick={() => abrirNeg(n)} />); })()
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-center text-[11.5px] text-muted-foreground">Clique num card → abre o <b>modal do lead</b> (timeline, lembrete, negócio) — o mesmo do pipeline. Fluxo único.</p>
    </div>
  );
}

function Empty() { return <div className="rounded-xl border border-dashed border-border/70 py-6 text-center text-[11.5px] text-muted-foreground">—</div>; }

function PosVisitaCard({ p, onClick }: { p: ProntoVirar; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative overflow-hidden rounded-xl border border-border bg-card p-2.5 pl-3.5 text-left transition-all hover:shadow-md before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-cyan-500">
      <div className="truncate text-[13px] font-bold">{p.nome}</div>
      <div className="truncate text-[11px] text-muted-foreground">{p.empreendimento}</div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className={cn("rounded-full px-1.5 py-0.5 text-[9.5px] font-bold", p.sinal === "quente" ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10")}>{p.sinal === "quente" ? "🔥 quente" : "interesse"}</span>
        <span className="ml-auto inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-bold text-primary">virar negócio <ArrowRight className="h-2.5 w-2.5" /></span>
      </div>
    </button>
  );
}

function NegCard({ n, lens, onClick }: { n: NegocioCard; lens: Lens; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("relative overflow-hidden rounded-xl border border-border bg-card p-2.5 pl-3.5 text-left transition-all hover:shadow-md before:absolute before:inset-y-0 before:left-0 before:w-1", stripe(n.fase, n.tone))}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-bold">{n.cliente}</span>
        {n.vgv == null ? <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-700 dark:bg-amber-500/10">falta VGV</span> : <span className="shrink-0 text-[12.5px] font-extrabold">{money(n.vgv)}</span>}
      </div>
      <div className="truncate text-[11px] text-muted-foreground">{n.empreendimento}</div>
      <div className="mt-1.5 flex items-center gap-1.5">
        {n.fase === "em_negociacao" && n.sub && <span className={cn("rounded-full px-1.5 py-0.5 text-[9.5px] font-bold", SUB_META[n.sub].soft)}>{SUB_META[n.sub].nm}</span>}
        {n.fase === "ganho" && n.dataAssinatura && <span className="text-[9.5px] font-bold text-emerald-600">✓ assinado</span>}
        {n.ceo && <span className="rounded-md bg-amber-50 px-1.5 text-[9px] font-bold text-amber-700 dark:bg-amber-500/10">CEO</span>}
        {lens === "equipe" && <span className="truncate text-[10.5px] font-semibold text-foreground/60">{n.corretor.split(" ")[0]}</span>}
        {n.fase !== "ganho" && <span className={cn("ml-auto text-[10px]", n.tone === "bad" ? "font-bold text-rose-600" : n.tone === "warn" ? "text-amber-600" : "text-muted-foreground")}>{n.dias}d</span>}
      </div>
    </button>
  );
}
