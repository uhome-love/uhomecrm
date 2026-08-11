import { useMemo, useState } from "react";
import { useNegociosBoard, type NegocioCard, type NegFase, type NegSub } from "@/hooks/useNegociosBoard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Briefcase, Users, User, LayoutGrid, Rows3, X, Zap, ArrowRight } from "lucide-react";

/**
 * NegociosWorkspace — PREVIEW read-only do novo workspace de Negócios.
 * Só pra VER o desenho com dados reais. Não escreve nada. Rota /negocios-preview (admin).
 */

const FASE_META: Record<NegFase, { nm: string; dot: string; text: string; soft: string }> = {
  em_negociacao: { nm: "Em Negociação", dot: "bg-pink-500", text: "text-pink-600", soft: "bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400" },
  contrato: { nm: "Contrato", dot: "bg-cyan-500", text: "text-cyan-600", soft: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400" },
  ganho: { nm: "Ganho", dot: "bg-emerald-500", text: "text-emerald-600", soft: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
};
const SUB_META: Record<NegSub, { nm: string; dot: string; soft: string }> = {
  proposta: { nm: "Proposta", dot: "bg-violet-500", soft: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400" },
  documentacao: { nm: "Documentação", dot: "bg-sky-500", soft: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400" },
  aprovacao_credito: { nm: "Aprov. crédito", dot: "bg-pink-500", soft: "bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400" },
  reserva: { nm: "Reserva", dot: "bg-teal-500", soft: "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400" },
};
const SUB_ORDER: NegSub[] = ["proposta", "documentacao", "aprovacao_credito", "reserva"];

function money(reais: number | null): string | null {
  if (reais == null || reais === 0) return null;
  if (reais >= 1_000_000) return "R$ " + (reais / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " mi";
  if (reais >= 1000) return "R$ " + Math.round(reais / 1000) + " mil";
  return "R$ " + reais;
}

type Lens = "meus" | "equipe";
type View = "board" | "planilha";

export default function NegociosWorkspace() {
  const { data, isLoading } = useNegociosBoard();
  const [lens, setLens] = useState<Lens>("equipe");
  const [view, setView] = useState<View>("board");
  const [subF, setSubF] = useState<NegSub | "todos">("todos");
  const [sel, setSel] = useState<NegocioCard | null>(null);

  const negocios = useMemo(() => {
    const all = data?.negocios ?? [];
    return lens === "meus" ? all.filter((n) => n.meu) : all;
  }, [data, lens]);
  const prontos = useMemo(() => {
    const all = data?.prontos ?? [];
    return lens === "meus" ? all.filter((p) => p.meu) : all;
  }, [data, lens]);

  const byFase = (f: NegFase) => negocios.filter((n) => n.fase === f);
  const sum = (arr: NegocioCard[]) => arr.reduce((s, n) => s + (n.vgv || 0), 0);
  const ganho = byFase("ganho"), emNeg = byFase("em_negociacao"), contr = byFase("contrato");
  const forecast = Math.round(sum(emNeg) * 0.5 + sum(contr) * 0.8 + sum(ganho));
  const risco = negocios.filter((n) => n.tone === "bad").length;

  const SegBtn = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick}
      className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors",
        on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{children}</button>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 pb-24">
      {/* workspace nav */}
      <div className="mb-4 inline-flex gap-1 rounded-xl border border-border bg-card p-1">
        <span className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-bold text-muted-foreground">🌱 Pipeline de Leads</span>
        <span className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-[13px] font-bold text-background"><Briefcase className="h-4 w-4" /> Negócios</span>
      </div>

      {/* header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Negócios <span className="ml-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 align-middle dark:bg-amber-500/15 dark:text-amber-400">preview</span></h1>
          <p className="text-[12.5px] text-muted-foreground">{lens === "equipe" ? "Toda a equipe · a PDN vive aqui, na lente Equipe" : "Seus negócios"}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            <SegBtn on={lens === "meus"} onClick={() => setLens("meus")}><User className="h-3.5 w-3.5" /> Meus</SegBtn>
            <SegBtn on={lens === "equipe"} onClick={() => setLens("equipe")}><Users className="h-3.5 w-3.5" /> Equipe</SegBtn>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            <SegBtn on={view === "board"} onClick={() => setView("board")}><LayoutGrid className="h-3.5 w-3.5" /> Board</SegBtn>
            <SegBtn on={view === "planilha"} onClick={() => setView("planilha")}><Rows3 className="h-3.5 w-3.5" /> Planilha</SegBtn>
          </div>
        </div>
      </div>

      {/* money band */}
      <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-4">
        <Kpi label="Fechado no mês" value={money(sum(ganho)) || "R$ 0"} foot={`${ganho.length} assinados`} accent="text-emerald-600" />
        <Kpi label="Forecast ponderado" value={money(forecast) || "—"} foot="probabilidade × VGV" border />
        <Kpi label="Em jogo" value={money(sum(emNeg)) || "—"} foot={`${emNeg.length} em negociação`} border />
        <Kpi label="Parados / precisa agir" value={String(risco)} foot={lens === "equipe" ? "cobre o corretor" : "retome hoje"} accent="text-rose-600" border />
      </div>

      {/* bridge */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border bg-cyan-50/60 px-4 py-3 dark:bg-cyan-500/5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-card text-base">🌉</span>
          <div className="text-[13.5px] font-bold">Pós-Visita → Em Negociação <span className="font-medium text-muted-foreground">· o gargalo — visitaram e não avançaram</span></div>
          <span className="ml-auto text-[12px] font-bold text-cyan-600">{prontos.length} prontos · destrave</span>
        </div>
        {isLoading ? <div className="p-4"><Skeleton className="h-8 w-full" /></div> : prontos.length === 0 ? (
          <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">Nenhum lead em pós-visita agora.</div>
        ) : prontos.slice(0, 5).map((p) => (
          <div key={p.id} className="flex items-center gap-3 border-t border-border/60 px-4 py-2.5">
            <span className={cn("min-w-[88px] rounded-md px-2 py-1 text-center text-[10px] font-bold",
              p.sinal === "quente" ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10")}>
              {p.sinal === "quente" ? "🔥 quente" : "interesse"}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold">{p.nome}</div>
              <div className="truncate text-[11.5px] text-muted-foreground">{p.empreendimento} · há {p.dias}d sem toque</div>
            </div>
            <button className="rounded-lg bg-primary px-3 py-1.5 text-[11.5px] font-bold text-primary-foreground hover:bg-primary/90">Virar negócio</button>
          </div>
        ))}
      </div>

      {/* board / planilha */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}</div>
      ) : view === "board" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.35fr_1fr_1fr]">
          {(["em_negociacao", "contrato", "ganho"] as NegFase[]).map((f) => {
            const meta = FASE_META[f];
            let items = byFase(f);
            const vgvTot = sum(items);
            const isNeg = f === "em_negociacao";
            const shown = isNeg && subF !== "todos" ? items.filter((n) => n.sub === subF) : items;
            return (
              <div key={f} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
                  <span className="text-[13px] font-bold">{meta.nm}</span>
                  <span className="rounded-full bg-muted px-2 text-[10.5px] font-bold text-muted-foreground">{items.length}</span>
                  <span className={cn("ml-auto text-[12px] font-bold", f === "ganho" && "text-emerald-600")}>{money(vgvTot) || "—"}</span>
                </div>
                {isNeg && (
                  <div className="flex flex-wrap gap-1.5 border-b border-border/60 bg-muted/30 p-2">
                    {SUB_ORDER.map((s) => {
                      const it = items.filter((n) => n.sub === s);
                      const on = subF === s;
                      return (
                        <button key={s} onClick={() => setSubF(on ? "todos" : s)}
                          className={cn("min-w-0 flex-1 rounded-lg border bg-card px-2 py-1.5 text-left transition-colors",
                            on ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-muted-foreground/40")}>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold"><span className={cn("h-1.5 w-1.5 rounded-full", SUB_META[s].dot)} />{SUB_META[s].nm}</div>
                          <div className="mt-0.5 text-[9.5px] text-muted-foreground">{it.length} · {money(sum(it)) || "—"}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex min-h-[50px] flex-col gap-2 p-2.5">
                  {shown.length === 0 ? <div className="py-4 text-center text-[12px] text-muted-foreground">—</div> :
                    shown.map((n) => <BoardCard key={n.id} n={n} lens={lens} onClick={() => setSel(n)} />)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {(["em_negociacao", "contrato", "ganho"] as NegFase[]).map((f) => {
            const meta = FASE_META[f];
            const items = [...byFase(f)].sort((a, b) => (b.vgv || 0) - (a.vgv || 0));
            return (
              <div key={f} className="border-t border-border first:border-t-0">
                <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
                  <span className="text-[12.5px] font-bold">{meta.nm}</span>
                  <span className="text-[10.5px] text-muted-foreground">{items.length}</span>
                  <span className="ml-auto text-[12px] font-bold">{money(sum(items)) || "—"}</span>
                </div>
                {items.map((n) => (
                  <button key={n.id} onClick={() => setSel(n)} className="flex w-full items-center gap-3 border-t border-border/40 px-4 py-2.5 text-left hover:bg-muted/40">
                    <span className="flex-1 truncate text-[13px] font-semibold">{n.cliente}</span>
                    <span className="hidden w-28 shrink-0 text-[11.5px] text-muted-foreground sm:block">{n.sub ? SUB_META[n.sub].nm : n.dataAssinatura ? "assinado" : "—"}</span>
                    {lens === "equipe" && <span className="hidden w-28 shrink-0 truncate text-[12px] text-foreground/70 sm:block">{n.corretor.split(" ")[0]}</span>}
                    <span className={cn("w-24 shrink-0 text-right text-[12.5px] font-bold tabular-nums", n.vgv == null && "text-amber-600")}>{n.vgv == null ? "falta VGV" : money(n.vgv)}</span>
                    <span className={cn("w-14 shrink-0 text-right text-[11px]", n.tone === "bad" ? "font-bold text-rose-600" : "text-muted-foreground")}>{f === "ganho" ? "✓" : n.dias + "d"}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {sel && <NegocioDrawer n={sel} lens={lens} onClose={() => setSel(null)} />}
    </div>
  );
}

function Kpi({ label, value, foot, accent, border }: { label: string; value: string; foot: string; accent?: string; border?: boolean }) {
  return (
    <div className={cn("px-4 py-3.5", border && "border-l border-border/60")}>
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-[23px] font-extrabold tracking-tight tabular-nums", accent)}>{value}</div>
      <div className="mt-1 text-[11.5px] text-muted-foreground">{foot}</div>
    </div>
  );
}

function BoardCard({ n, lens, onClick }: { n: NegocioCard; lens: Lens; onClick: () => void }) {
  const meta = FASE_META[n.fase];
  return (
    <button onClick={onClick} className="rounded-xl border border-border bg-card p-2.5 text-left transition-all hover:border-muted-foreground/30 hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-bold">{n.cliente}</span>
        {n.vgv == null ? <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/10">falta VGV</span>
          : <span className="shrink-0 text-[12.5px] font-extrabold">{money(n.vgv)}</span>}
      </div>
      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{n.empreendimento}</div>
      <div className="mt-1.5 flex items-center gap-1.5">
        {n.fase === "em_negociacao" && n.sub && <span className={cn("rounded-full px-1.5 py-0.5 text-[9.5px] font-bold", SUB_META[n.sub].soft)}>{SUB_META[n.sub].nm}</span>}
        {n.fase === "ganho" && n.dataAssinatura && <span className="text-[9.5px] font-bold text-emerald-600">✓ assinado</span>}
        {n.ceo && <span className="rounded-md bg-amber-50 px-1.5 text-[9px] font-bold text-amber-700 dark:bg-amber-500/10">CEO</span>}
        {lens === "equipe" && <span className="text-[10.5px] font-semibold text-foreground/60">{n.corretor.split(" ")[0]}</span>}
        {n.fase !== "ganho" && <span className={cn("ml-auto text-[10px]", n.tone === "bad" ? "font-bold text-rose-600" : n.tone === "warn" ? "text-amber-600" : "text-muted-foreground")}>{n.dias}d</span>}
      </div>
    </button>
  );
}

function NegocioDrawer({ n, lens, onClose }: { n: NegocioCard; lens: Lens; onClose: () => void }) {
  const meta = FASE_META[n.fase];
  const steps = ["Proposta", "Documentação", "Aprovação de crédito", "Reserva", "Contrato & assinatura"];
  const nowIdx = n.fase === "ganho" ? 5 : n.fase === "contrato" ? 4 : SUB_ORDER.indexOf(n.sub ?? "proposta");
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/35" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-[min(440px,95vw)] flex-col bg-card shadow-2xl">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start gap-2">
            <div>
              <div className="text-[19px] font-extrabold tracking-tight">{n.cliente}</div>
              <div className="text-[12.5px] text-muted-foreground">{n.empreendimento} · {n.corretor}</div>
            </div>
            <button onClick={onClose} className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-2"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", meta.soft)}>{meta.nm}{n.sub ? " · " + SUB_META[n.sub].nm : ""}</span></div>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-border p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">VGV estimado</div>
              <div className={cn("mt-1 text-[19px] font-extrabold tabular-nums", n.vgv == null && "text-amber-600")}>{n.vgv == null ? "falta" : money(n.vgv)}</div>
            </div>
            {n.fase === "ganho" ? (
              <div className="rounded-xl border border-border bg-emerald-50/50 p-3 dark:bg-emerald-500/5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">VGV final</div>
                <div className="mt-1 text-[19px] font-extrabold tabular-nums text-emerald-600">{money(n.vgvFinal) || "—"}</div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">VGV final</div>
                <div className="mt-1 text-[19px] font-extrabold tabular-nums text-muted-foreground">—</div>
                <div className="mt-0.5 text-[10px] font-bold text-amber-600">🔒 exige assinatura</div>
              </div>
            )}
          </div>

          <div className="mt-5 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Caminho do negócio</div>
          <div className="mt-2.5 flex flex-col">
            {steps.map((s, i) => {
              const done = i < nowIdx, now = i === nowIdx;
              return (
                <div key={s} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn("grid h-[22px] w-[22px] place-items-center rounded-full border-2 text-[11px] font-bold",
                      done ? "border-emerald-500 bg-emerald-500 text-white" : now ? "border-primary text-primary ring-4 ring-primary/10" : "border-border text-muted-foreground")}>
                      {done ? "✓" : i + 1}</div>
                    {i < steps.length - 1 && <div className="min-h-[16px] w-0.5 flex-1 bg-border" />}
                  </div>
                  <div className="pb-3"><div className={cn("text-[13px] font-semibold", now && "text-primary", !done && !now && "text-muted-foreground")}>{s}</div></div>
                </div>
              );
            })}
          </div>

          {lens === "equipe" && (
            <div className="mt-5 rounded-xl border border-primary/20 bg-primary/[0.04] p-3.5">
              <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-primary"><Users className="h-3.5 w-3.5" /> Gestão (só a Equipe vê)</div>
              <div className="mt-2 text-[10.5px] font-bold uppercase text-muted-foreground">Status interno</div>
              <div className="mt-1 rounded-lg border border-border bg-card px-2.5 py-2 text-[12.5px] text-foreground/70">{n.tone === "bad" ? "Parado — cobrar corretor" : "Em andamento"}</div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {n.ceo && <button className="rounded-lg bg-primary px-3 py-1.5 text-[11.5px] font-bold text-primary-foreground">Aprovar (CEO)</button>}
                <button className="rounded-lg border border-border px-3 py-1.5 text-[11.5px] font-semibold">Salvar e avisar corretor</button>
                <button className="rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground">Reatribuir</button>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 border-t border-border px-5 py-3">
          <button className="flex-1 rounded-lg border border-border py-2 text-[12.5px] font-bold"><Zap className="mr-1 inline h-3.5 w-3.5" />Registrar</button>
          <button className="flex-1 rounded-lg bg-primary py-2 text-[12.5px] font-bold text-primary-foreground">Avançar etapa <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></button>
        </div>
      </aside>
    </>
  );
}
