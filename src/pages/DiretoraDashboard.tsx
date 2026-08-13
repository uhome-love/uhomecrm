// ─────────────────────────────────────────────────────────────────
// DiretoraDashboard — dashboard da DIRETORA (foco em NEGÓCIOS). Rota /diretora.
// Visual = Cockpit aprovado (mockup /diretora-mockup, modelo A), com DADOS REAIS
// compostos dos hooks existentes (fonte única): useEquipesView + useNegociosBoard.
// ─────────────────────────────────────────────────────────────────
import { useMemo } from "react";
import { useTabContext } from "@/contexts/TabContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEquipesView, type EquipesGestor } from "@/hooks/useEquipesView";
import { useNegociosBoard } from "@/hooks/useNegociosBoard";
import { fmtMoney } from "@/lib/fmtMoney";
import { Handshake, AlertTriangle, ArrowRight, Target, Trophy } from "lucide-react";

type SaudeKey = "em_dia" | "atencao" | "desatualizado";
const SAUDE = {
  em_dia: { label: "em dia", bar: "bg-emerald-500", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  atencao: { label: "atenção", bar: "bg-amber-500", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  desatualizado: { label: "desatualizado", bar: "bg-red-500", dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
} as const;
const ORDER: SaudeKey[] = ["em_dia", "atencao", "desatualizado"];

function HealthBar({ counts, h = "h-2" }: { counts: Record<SaudeKey, number>; h?: string }) {
  const total = ORDER.reduce((s, k) => s + counts[k], 0) || 1;
  return (
    <div className={`flex ${h} w-full overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700`}>
      {ORDER.map((k) => { const pct = (counts[k] / total) * 100; return pct > 0 ? <div key={k} className={SAUDE[k].bar} style={{ width: `${pct}%` }} /> : null; })}
    </div>
  );
}
function Card({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick!(); } } : undefined}
      className={`group rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 ${clickable ? "cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-gray-600" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
function money(v: number): string { return fmtMoney(v, "short"); }
function iniciais(nome: string): string { return nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?"; }
function saudacaoHora(): string { const h = Number(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false })); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; }

const NEGOCIOS = "/pipeline-leads?tab=negocios";
const EQUIPES_TAB = "/pipeline-leads?tab=equipes";
const VENDAS = "/vendas-realizadas";

export default function DiretoraDashboard() {
  const { user } = useAuth();
  const { openTab } = useTabContext();
  const { data: perfil } = useQuery({
    queryKey: ["diretora-perfil", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("nome, avatar_url").eq("user_id", user!.id).maybeSingle();
      return data as { nome: string | null; avatar_url: string | null } | null;
    },
  });
  const { data: eq, isLoading: eqLoading } = useEquipesView();
  const { data: board, isLoading: boardLoading } = useNegociosBoard({ enabled: true });

  const d = useMemo(() => {
    const now = new Date();
    const mesAtual = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7); // YYYY-MM
    const diaDoMes = Number(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", day: "numeric" }));
    const diasNoMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const gestores: EquipesGestor[] = eq?.gestores ?? [];
    const assinado = eq?.escritorio.vgv_assinado_mes ?? 0;
    const meta = gestores.reduce((s, g) => s + (g.meta_vgv ?? 0), 0);
    const metaPct = meta > 0 ? Math.round((assinado / meta) * 100) : null;
    const faltam = Math.max(0, meta - assinado);
    const projecao = diaDoMes > 0 ? Math.round(assinado / (diaDoMes / diasNoMes)) : assinado;
    const projPct = meta > 0 ? Math.round((projecao / meta) * 100) : null;

    // Negócios (fonte: board) — saúde em andamento + funil + vendas do mês
    const negocios = board?.negocios ?? [];
    const prontos = board?.prontos ?? [];
    const saude: Record<SaudeKey, number> = { em_dia: 0, atencao: 0, desatualizado: 0 };
    let vgvEmJogo = 0;
    const bump = (s: string) => { if (s === "verde") saude.em_dia++; else if (s === "ambar") saude.atencao++; else if (s === "vermelho") saude.desatualizado++; };
    prontos.forEach((p) => bump(p.saude));
    negocios.forEach((n) => { if (n.passo !== "ganho") { bump(n.saude); vgvEmJogo += n.vgv || 0; } });
    const totalNeg = saude.em_dia + saude.atencao + saude.desatualizado;
    const emDiaPct = totalNeg > 0 ? Math.round((saude.em_dia / totalNeg) * 100) : 0;

    const somaPasso = (passo: string) => {
      const arr = negocios.filter((n) => n.passo === passo);
      return { n: arr.length, vgv: arr.reduce((s, n) => s + (n.vgv || 0), 0) };
    };
    const ganhosMes = negocios.filter((n) => n.passo === "ganho" && (n.dataAssinatura || "").slice(0, 7) === mesAtual);
    const vendasVgv = ganhosMes.reduce((s, n) => s + (n.vgv || 0), 0);
    const ticket = ganhosMes.length > 0 ? Math.round(vendasVgv / ganhosMes.length) : 0;
    const funil = [
      { nome: "Pós-Visita", n: prontos.length, vgv: 0, dot: "bg-cyan-500" },
      { nome: "Documentação", ...somaPasso("documentacao"), dot: "bg-sky-500" },
      { nome: "Proposta", ...somaPasso("proposta"), dot: "bg-violet-500" },
      { nome: "Contrato", ...somaPasso("contrato"), dot: "bg-indigo-500" },
      { nome: "Ganho (mês)", n: ganhosMes.length, vgv: vendasVgv, dot: "bg-emerald-500" },
    ];
    const vendasLista = [...ganhosMes].sort((a, b) => (b.vgv || 0) - (a.vgv || 0)).slice(0, 4)
      .map((n) => ({ cliente: n.cliente, sub: `${n.empreendimento || "—"} · ${(n.corretor || "").split(" ")[0]}`, vgv: n.vgv || 0 }));

    // Métricas de negócio reais (no lugar da conversão de funil por cohort, que exige mais dado)
    const taxaFechamento = totalNeg + ganhosMes.length > 0 ? Math.round((ganhosMes.length / (totalNeg + ganhosMes.length)) * 100) : 0;
    const vgvMedio = totalNeg > 0 ? Math.round(vgvEmJogo / totalNeg) : 0;

    // Performance por equipe (ordenado por meta desc, sem-meta por último)
    const equipes = [...gestores].sort((a, b) => (b.meta_pct ?? -1) - (a.meta_pct ?? -1)).map((g) => ({
      nome: g.nome || "—", metaPct: g.meta_pct, assinado: g.vgv_assinado_mes, meta: g.meta_vgv, neg: g.negocios,
      saude: { em_dia: g.em_dia, atencao: g.atencao, desatualizado: g.desatualizado } as Record<SaudeKey, number>,
    }));

    // Alertas comerciais
    const vgvRisco = negocios.filter((n) => n.passo !== "ganho" && n.saude === "vermelho").reduce((s, n) => s + (n.vgv || 0), 0);
    const propostasParadas = negocios.filter((n) => n.passo === "proposta" && (n.dias ?? 0) > 9).length;
    const semMeta = gestores.filter((g) => !g.meta_vgv || g.meta_vgv === 0);
    const alertas: { t: string; d: string; cls: string; ico: string; to: string }[] = [];
    if (saude.desatualizado > 0) alertas.push({ t: `${saude.desatualizado} negócios desatualizados`, d: `parados há +14 dias — ${money(vgvRisco)} em risco`, cls: "text-red-600 dark:text-red-400", ico: "bg-red-50 dark:bg-red-950", to: NEGOCIOS });
    if (propostasParadas > 0) alertas.push({ t: `${propostasParadas} propostas sem retorno`, d: "há mais de 9 dias sem atividade", cls: "text-amber-600 dark:text-amber-400", ico: "bg-amber-50 dark:bg-amber-950", to: NEGOCIOS });
    if (semMeta.length > 0) alertas.push({ t: `${semMeta.length} ${semMeta.length === 1 ? "gerente sem meta" : "gerentes sem meta"}`, d: semMeta.map((g) => (g.nome || "").split(" ")[0]).join(", ") + " — sem baseline", cls: "text-slate-600 dark:text-slate-300", ico: "bg-slate-100 dark:bg-gray-700", to: EQUIPES_TAB });

    return { assinado, meta, metaPct, faltam, projecao, projPct, diasRestantes: Math.max(0, diasNoMes - diaDoMes), saude, totalNeg, emDiaPct, vgvEmJogo, funil, vendasCount: ganhosMes.length, vendasVgv, ticket, taxaFechamento, vgvMedio, equipes, vendasLista, alertas };
  }, [eq, board]);

  const nome = perfil?.nome || "Diretora";
  const primeiro = nome.split(" ")[0];
  const loading = eqLoading || boardLoading;

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-slate-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl p-4 space-y-3">
        {/* Saudação (igual ao CEO) */}
        <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white">
          {perfil?.avatar_url
            ? <img src={perfil.avatar_url} alt={nome} className="h-14 w-14 shrink-0 rounded-full object-cover" />
            : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-[16px] font-bold">{iniciais(nome)}</div>}
          <div className="min-w-0 flex-1">
            <div className="text-[20px] font-extrabold leading-tight">{saudacaoHora()}, {primeiro}! 👋</div>
            <div className="text-[13px] text-white/80">Negócio bom é negócio que anda — bora fechar o mês.</div>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-lg bg-white/15 px-3 h-9 text-[13px] font-semibold">
            {(() => { const m = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }); return m.charAt(0).toUpperCase() + m.slice(1); })()}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-gray-800" />)}</div>
        ) : (
        <>
        {/* Meta (card claro) + Vendas */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="relative overflow-hidden lg:col-span-2" onClick={() => openTab(VENDAS)}>
            <span className="absolute inset-y-0 left-0 w-1 bg-indigo-500" />
            <div className="flex items-center gap-2"><Target className="h-4 w-4 text-indigo-500" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Meta do mês · VGV assinado</span><ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-slate-500" /></div>
            <div className="mt-2 flex items-end gap-3">
              <span className="text-4xl font-extrabold leading-none text-indigo-700 dark:text-indigo-300">{money(d.assinado)}</span>
              <span className="pb-1 text-[14px] font-semibold text-slate-500 dark:text-slate-400">{d.meta > 0 ? `de ${money(d.meta)} · ${d.metaPct}%` : "meta não configurada"}</span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, d.metaPct ?? 0)}%` }} /></div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <span className="text-slate-500 dark:text-slate-400">{d.meta > 0 ? <>Faltam <b className="text-slate-800 dark:text-slate-100">{money(d.faltam)}</b> · restam {d.diasRestantes} dias</> : "Configure a meta dos gerentes pra acompanhar"}</span>
              {d.meta > 0 && d.projPct != null && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${d.projPct >= 100 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>
                  <AlertTriangle className="h-3.5 w-3.5" /> Projeção: {money(d.projecao)} ({d.projPct}%) — {d.projPct >= 100 ? "no ritmo" : "abaixo"}
                </span>
              )}
            </div>
          </Card>
          <Card onClick={() => openTab(VENDAS)}>
            <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-emerald-600" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Vendas no mês</span><ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-slate-500" /></div>
            <div className="mt-2 flex items-baseline gap-2"><span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{d.vendasCount}</span><span className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">assinadas</span></div>
            <div className="mt-2 space-y-1 text-[12px] text-slate-500 dark:text-slate-400">
              <div className="flex justify-between"><span>VGV assinado</span><b className="text-slate-700 dark:text-slate-200">{money(d.vendasVgv)}</b></div>
              <div className="flex justify-between"><span>Ticket médio</span><b className="text-slate-700 dark:text-slate-200">{money(d.ticket)}</b></div>
            </div>
          </Card>
        </div>

        {/* Saúde dos negócios + métricas comerciais */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="lg:col-span-2" onClick={() => openTab(NEGOCIOS)}>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Saúde dos negócios em andamento</span>
              <span className="inline-flex items-center gap-1 text-[12px] text-slate-400">{d.totalNeg} negócios · {money(d.vgvEmJogo)} em jogo <ArrowRight className="h-3.5 w-3.5 transition-colors group-hover:text-slate-500" /></span>
            </div>
            <div className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{d.emDiaPct}%</span><span className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">em dia</span></div>
            <div className="mt-2"><HealthBar counts={d.saude} h="h-2.5" /></div>
            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              {ORDER.map((k) => (<span key={k} className="inline-flex items-center gap-1.5 text-[13px]"><span className={`h-2 w-2 rounded-full ${SAUDE[k].dot}`} /><b className={SAUDE[k].text}>{d.saude[k]}</b> <span className="text-slate-400">{SAUDE[k].label}</span></span>))}
            </div>
          </Card>
          <Card>
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Indicadores comerciais</span>
            <div className="mt-2 space-y-1.5 text-[12.5px]">
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Ticket médio</span><b className="text-slate-800 dark:text-slate-100">{money(d.ticket)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">VGV médio / negócio</span><b className="text-slate-800 dark:text-slate-100">{money(d.vgvMedio)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">VGV em jogo</span><b className="text-slate-800 dark:text-slate-100">{money(d.vgvEmJogo)}</b></div>
              <div className="mt-1 flex justify-between border-t border-slate-100 dark:border-gray-700 pt-1.5"><span className="font-semibold text-slate-600 dark:text-slate-300">Taxa de fechamento</span><b className="text-emerald-600 dark:text-emerald-400">{d.taxaFechamento}%</b></div>
            </div>
          </Card>
        </div>

        {/* Funil de negócios */}
        <Card onClick={() => openTab(NEGOCIOS)}>
          <div className="mb-3 flex items-center gap-2"><Handshake className="h-4 w-4 text-slate-500" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Funil de negócios</span><ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-slate-500" /></div>
          <div className="flex flex-wrap items-stretch gap-2">
            {d.funil.map((s) => (
              <div key={s.nome} className="flex-1 min-w-[110px]">
                <div className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${s.dot}`} /><span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{s.nome}</span></div>
                <div className="mt-1 text-2xl font-extrabold text-slate-800 dark:text-slate-100">{s.n}</div>
                <div className="text-[11px] text-slate-400">{s.vgv > 0 ? money(s.vgv) : "—"}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Performance por equipe */}
        <div>
          <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Performance por equipe</span><span className="text-[11px] text-slate-400">ordenado por meta</span></div>
          <div className="grid gap-3 lg:grid-cols-3">
            {d.equipes.map((g) => (
              <div key={g.nome} role="button" tabIndex={0} onClick={() => openTab(EQUIPES_TAB)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTab(EQUIPES_TAB); } }} className="group cursor-pointer rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-gray-600">
                <div className="flex items-center justify-between"><span className="text-[14px] font-bold text-slate-800 dark:text-slate-100">{g.nome}</span><span><b className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{g.neg}</b><span className="ml-1 text-[10px] font-semibold uppercase text-slate-400">neg.</span></span></div>
                {g.metaPct != null ? (<><div className="mt-2 flex justify-between text-[11px]"><span className="font-semibold text-slate-500 dark:text-slate-400">Meta {money(g.assinado)}/{money(g.meta ?? 0)}</span><b>{g.metaPct}%</b></div><div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, g.metaPct)}%` }} /></div></>) : (<div className="mt-2 text-[11px] italic text-slate-400">Meta do mês não configurada</div>)}
                <div className="mt-2.5"><HealthBar counts={g.saude} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* Vendas assinadas + alertas */}
        <div className="grid gap-3 lg:grid-cols-2">
          <Card onClick={() => openTab(VENDAS)}>
            <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Vendas assinadas no mês</span><ArrowRight className="h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-slate-500" /></div>
            {d.vendasLista.length === 0 ? <div className="py-4 text-center text-[12px] text-slate-400">Nenhuma venda assinada neste mês ainda.</div> : (
              <div className="divide-y divide-slate-100 dark:divide-gray-700">
                {d.vendasLista.map((v, i) => (<div key={i} className="flex items-center justify-between py-2"><div className="min-w-0"><div className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{v.cliente}</div><div className="truncate text-[11px] text-slate-400">{v.sub}</div></div><span className="shrink-0 text-[13px] font-extrabold text-emerald-600 dark:text-emerald-400">{money(v.vgv)}</span></div>))}
              </div>
            )}
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Alertas comerciais</span></div>
            {d.alertas.length === 0 ? <div className="py-4 text-center text-[12px] text-emerald-600 dark:text-emerald-400">Tudo sob controle — sem alertas. 🎉</div> : (
              <div className="space-y-2">
                {d.alertas.map((a) => (
                  <div key={a.t} role="button" tabIndex={0} onClick={() => openTab(a.to)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTab(a.to); } }} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-gray-700/50">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${a.ico}`}><AlertTriangle className={`h-4 w-4 ${a.cls}`} /></div>
                    <div className="min-w-0 flex-1"><div className={`text-[13px] font-semibold ${a.cls}`}>{a.t}</div><div className="text-[11px] text-slate-400">{a.d}</div></div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
