import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNegociosBoard, type NegocioCard, type NegPasso, type ProntoVirar } from "@/hooks/useNegociosBoard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Briefcase, Users, User, ArrowRight } from "lucide-react";

/**
 * NegociosWorkspace — PREVIEW read-only (rota /negocios-preview, admin).
 * Estrutura definitiva: MESMO visual do pipeline, fluxo único Leads|Negócios.
 * Colunas = os PASSOS reais do fluxo comercial da Uhome:
 *   Pós-Visita → Proposta → Documentação → Aprovação → Contrato → Leitura → Assinatura.
 * Sub-status = a própria coluna (fonte: flag_status do lead). Clicar abre o modal real.
 */

type ColKey = "pos_visita" | NegPasso;
const COLS: { key: ColKey; nm: string; dot: string }[] = [
  { key: "pos_visita",   nm: "Pós-Visita",   dot: "bg-cyan-500" },
  { key: "documentacao", nm: "Documentação", dot: "bg-sky-500" },
  { key: "proposta",     nm: "Proposta",     dot: "bg-violet-500" },
  { key: "contrato",     nm: "Contrato",     dot: "bg-indigo-500" },
  { key: "ganho",        nm: "Ganho",        dot: "bg-emerald-500" },
];

function money(reais: number | null): string | null {
  if (reais == null || reais === 0) return null;
  if (reais >= 1_000_000) return "R$ " + (reais / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " mi";
  if (reais >= 1000) return "R$ " + Math.round(reais / 1000) + " mil";
  return "R$ " + reais;
}
function toneStripe(tone: string, ganho: boolean): string {
  if (ganho) return "before:bg-emerald-500";
  if (tone === "bad") return "before:bg-red-500";
  if (tone === "warn") return "before:bg-amber-500";
  return "before:bg-emerald-500";
}

type Lens = "meus" | "equipe";

export default function NegociosWorkspace() {
  const { data, isLoading } = useNegociosBoard();
  const navigate = useNavigate();
  const [lens, setLens] = useState<Lens>("equipe");

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

  // KPIs
  const assinado = byPasso("ganho");
  const emJogo = negocios.filter((n) => n.fase !== "ganho");
  const forecast = Math.round(negocios.reduce((s, n) => {
    const w = n.passo === "ganho" ? 1 : n.passo === "contrato" ? 0.8 : n.passo === "proposta" ? 0.5 : 0.3;
    return s + (n.vgv || 0) * w;
  }, 0));
  const parados = negocios.filter((n) => n.tone === "bad").length;

  const abrirNeg = (n: NegocioCard) => { if (n.pipelineLeadId) navigate(`/pipeline-leads?lead=${n.pipelineLeadId}`); };
  const abrirLead = (p: ProntoVirar) => navigate(`/pipeline-leads?lead=${p.id}`);

  const Seg = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick}
      className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors",
        on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{children}</button>
  );

  const colInfo = (k: ColKey) => k === "pos_visita" ? { count: prontos.length, vgv: 0 } : { count: byPasso(k).length, vgv: sum(byPasso(k)) };

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-5 pb-12">
      {/* divisão de momento */}
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
        <span className="text-[12.5px] text-muted-foreground">· o fluxo comercial em colunas · {lens === "equipe" ? "gerente gere aqui (PDN)" : "seus negócios"}</span>
      </div>

      {/* KPIs slim (gestão) */}
      <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-4">
        <Kpi label="Fechado no mês" value={money(sum(assinado)) || "R$ 0"} foot={`${assinado.length} assinados`} accent="text-emerald-600" />
        <Kpi label="Forecast ponderado" value={money(forecast) || "—"} foot="peso × VGV por passo" border />
        <Kpi label="Em jogo" value={money(sum(emJogo)) || "—"} foot={`${emJogo.length} negócios abertos`} border />
        <Kpi label="Parados" value={String(parados)} foot="precisam agir" accent="text-rose-600" border />
      </div>

      {/* KANBAN — 7 passos, visual do pipeline */}
      {isLoading ? (
        <div className="flex gap-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-80 w-64 shrink-0 rounded-2xl" />)}</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {COLS.map((c) => {
            const info = colInfo(c.key);
            const isPos = c.key === "pos_visita";
            const items = isPos ? [] : [...byPasso(c.key as NegPasso)].sort((a, b) => (b.vgv || 0) - (a.vgv || 0));
            return (
              <div key={c.key} className="flex w-[260px] shrink-0 flex-col rounded-2xl bg-muted/40">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full", c.dot)} />
                  <span className="text-[12.5px] font-bold">{c.nm}</span>
                  <span className="rounded-full bg-background px-1.5 text-[10px] font-bold text-muted-foreground">{info.count}</span>
                  {!isPos && <span className={cn("ml-auto text-[11px] font-bold", c.key === "ganho" && "text-emerald-600")}>{money(info.vgv) || "—"}</span>}
                </div>
                <div className="flex flex-col gap-2 px-2 pb-2">
                  {isPos ? (
                    prontos.length === 0 ? <Empty /> : prontos.slice(0, 12).map((p) => <PosVisitaCard key={p.id} p={p} onClick={() => abrirLead(p)} />)
                  ) : items.length === 0 ? <Empty /> : items.map((n) => <NegCard key={n.id} n={n} lens={lens} onClick={() => abrirNeg(n)} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-center text-[11.5px] text-muted-foreground">Clique num card → o <b>modal real do lead</b> (timeline em 2 capítulos, lembrete, negócio). ↩️ Regredir · 🗑️ Descartar · 📦 Inativar no ⋮.</p>
    </div>
  );
}

function Kpi({ label, value, foot, accent, border }: { label: string; value: string; foot: string; accent?: string; border?: boolean }) {
  return (
    <div className={cn("px-4 py-3", border && "border-l border-border/60")}>
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-[22px] font-extrabold tracking-tight tabular-nums", accent)}>{value}</div>
      <div className="mt-0.5 text-[11.5px] text-muted-foreground">{foot}</div>
    </div>
  );
}

function Empty() { return <div className="rounded-xl border border-dashed border-border/70 py-6 text-center text-[11px] text-muted-foreground">—</div>; }

function PosVisitaCard({ p, onClick }: { p: ProntoVirar; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative overflow-hidden rounded-xl border border-border bg-card p-2.5 pl-3.5 text-left transition-all hover:shadow-md before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-cyan-500">
      <div className="truncate text-[13px] font-bold">{p.nome}</div>
      <div className="truncate text-[11px] text-muted-foreground">{p.empreendimento}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-full px-1.5 py-0.5 text-[9.5px] font-bold", p.sinal === "quente" ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10")}>{p.sinal === "quente" ? "🔥 quente" : "interesse"}</span>
        {p.semVisita && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9.5px] font-bold text-muted-foreground" title="Este lead está na Pós-Visita sem visita realizada registrada na agenda">
            sem visita registrada
          </span>
        )}
        {p.dias >= 14 && (
          <span className={cn("rounded-full px-1.5 py-0.5 text-[9.5px] font-bold", p.dias >= 30 ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10")}>
            parado há {p.dias}d
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-bold text-primary">virar negócio <ArrowRight className="h-2.5 w-2.5" /></span>
      </div>
    </button>
  );
}

function NegCard({ n, lens, onClick }: { n: NegocioCard; lens: Lens; onClick: () => void }) {
  const ganho = n.fase === "ganho";
  return (
    <button onClick={onClick} className={cn("relative overflow-hidden rounded-xl border border-border bg-card p-2.5 pl-3.5 text-left transition-all hover:shadow-md before:absolute before:inset-y-0 before:left-0 before:w-1", toneStripe(n.tone, ganho))}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-bold">{n.cliente}</span>
        {n.vgv == null ? <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-700 dark:bg-amber-500/10">falta VGV</span> : <span className="shrink-0 text-[12.5px] font-extrabold">{money(n.vgv)}</span>}
      </div>
      <div className="truncate text-[11px] text-muted-foreground">{n.empreendimento}</div>
      {n.detalhe && !ganho && (
        <div className="mt-1 truncate text-[10.5px] font-semibold text-foreground/70">· {n.detalhe}</div>
      )}
      <div className="mt-1.5 flex items-center gap-1.5">
        {ganho && n.dataAssinatura && <span className="text-[9.5px] font-bold text-emerald-600">✓ assinado</span>}
        {n.ceo && <span className="rounded-md bg-amber-50 px-1.5 text-[9px] font-bold text-amber-700 dark:bg-amber-500/10">CEO</span>}
        {lens === "equipe" && <span className="truncate text-[10.5px] font-semibold text-foreground/60">{n.corretor.split(" ")[0]}</span>}
        {!ganho && <span className={cn("ml-auto text-[10px]", n.tone === "bad" ? "font-bold text-rose-600" : n.tone === "warn" ? "text-amber-600" : "text-muted-foreground")}>{n.dias}d</span>}
      </div>
    </button>
  );
}
