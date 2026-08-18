// ─────────────────────────────────────────────────────────────────
// GerenteCockpit — dashboard do GERENTE (o time dele). Rota /gerente/cockpit.
// Visual = Cockpit aprovado (mockup /gerente-mockup, modelo A), DADOS REAIS via
// RPC dedicada get_dashboard_gerente_cockpit (fonte única, escopo do gerente).
// ─────────────────────────────────────────────────────────────────
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTabContext } from "@/contexts/TabContext";
import { GreetingBar } from "@/components/ui/GreetingBar";
import { fmtMoney } from "@/lib/fmtMoney";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Target, Handshake, Users, CalendarCheck, UserCheck, ArrowRight, TrendingUp, Trophy, Pencil, Sparkles,
} from "lucide-react";

type SaudeKey = "em_dia" | "atencao" | "desatualizado" | "estagnado";
const SAUDE = {
  em_dia: { label: "em dia", bar: "bg-emerald-500", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  atencao: { label: "atenção", bar: "bg-amber-500", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  desatualizado: { label: "desatualizado", bar: "bg-red-500", dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  estagnado: { label: "estagnado", bar: "bg-violet-500", dot: "bg-violet-500", text: "text-violet-600 dark:text-violet-400" },
} as const;
const ORDER: SaudeKey[] = ["em_dia", "atencao", "desatualizado", "estagnado"];

interface Cockpit {
  corretores_total: number; presentes: number;
  meta: { assinado: number; meta: number; pipeline_ativo: number };
  resultado: { vendas_count: number; vendas_vgv: number; leads_ativos: number; leads_mes: number };
  saude: Record<SaudeKey, number>;
  visitas: { total: number; realizadas: number; no_show: number; hoje: number };
  funil: { pos_visita: number; documentacao: number; proposta: number; contrato: number; ganho_mes: number };
  corretores: { nome: string; leads_mes: number; vis_total: number; vis_real: number; negocios: number; vendas: number }[];
}

function HealthBar({ counts, h = "h-2" }: { counts: Record<SaudeKey, number>; h?: string }) {
  const total = ORDER.reduce((s, k) => s + (counts[k] || 0), 0) || 1;
  return (
    <div className={`flex ${h} w-full overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700`}>
      {ORDER.map((k) => { const pct = ((counts[k] || 0) / total) * 100; return pct > 0 ? <div key={k} className={SAUDE[k].bar} style={{ width: `${pct}%` }} /> : null; })}
    </div>
  );
}
function Card({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  const c = !!onClick;
  return <div onClick={onClick} role={c ? "button" : undefined} tabIndex={c ? 0 : undefined} onKeyDown={c ? (e) => { if (e.key === "Enter") onClick!(); } : undefined}
    className={`group rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 ${c ? "cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md" : ""} ${className}`}>{children}</div>;
}
function money(v: number): string { return fmtMoney(v, "short"); }
function iniciais(n: string): string { return n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?"; }
function saud(): string { const h = Number(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false })); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; }

const NEGOCIOS = "/pipeline-leads?tab=negocios";
const LEADS_TAB = "/pipeline-leads?tab=kanban";
const VENDAS = "/vendas-realizadas";
const VISITAS = "/visitas";

export default function GerenteCockpit() {
  const { user } = useAuth();
  const { openTab } = useTabContext();
  const qc = useQueryClient();
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaVal, setMetaVal] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: perfil } = useQuery({
    queryKey: ["gerente-perfil", user?.id], enabled: !!user, staleTime: 5 * 60_000,
    queryFn: async () => (await supabase.from("profiles").select("nome, avatar_url").eq("user_id", user!.id).maybeSingle()).data as { nome: string | null; avatar_url: string | null } | null,
  });
  const { data, isLoading } = useQuery({
    queryKey: ["gerente-cockpit", user?.id], enabled: !!user, staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_gerente_cockpit");
      if (error) throw error;
      return data as unknown as Cockpit;
    },
  });

  const d = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const diaDoMes = Number(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", day: "numeric" }));
    const diasNoMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const meta = data.meta.meta, assinado = data.meta.assinado;
    const metaPct = meta > 0 ? Math.round((assinado / meta) * 100) : null;
    const projecao = diaDoMes > 0 ? Math.round(assinado / (diaDoMes / diasNoMes)) : assinado;
    const totalSaude = ORDER.reduce((s, k) => s + (data.saude[k] || 0), 0);
    const emDiaPct = totalSaude > 0 ? Math.round((data.saude.em_dia / totalSaude) * 100) : 0;
    const acao = data.saude.atencao + data.saude.desatualizado + data.saude.estagnado;
    const comparec = (data.visitas.realizadas + data.visitas.no_show) > 0 ? Math.round((data.visitas.realizadas / (data.visitas.realizadas + data.visitas.no_show)) * 100) : 0;
    const ticket = data.resultado.vendas_count > 0 ? Math.round(data.resultado.vendas_vgv / data.resultado.vendas_count) : 0;
    const convVisita = data.resultado.leads_mes > 0 ? Math.round((data.visitas.total / data.resultado.leads_mes) * 100) : 0;
    const convVenda = data.resultado.leads_mes > 0 ? +((data.resultado.vendas_count / data.resultado.leads_mes) * 100).toFixed(1) : 0;
    const funil = [
      { nome: "Pós-Visita", n: data.funil.pos_visita, dot: "bg-cyan-500" },
      { nome: "Documentação", n: data.funil.documentacao, dot: "bg-sky-500" },
      { nome: "Proposta", n: data.funil.proposta, dot: "bg-violet-500" },
      { nome: "Contrato", n: data.funil.contrato, dot: "bg-indigo-500" },
      { nome: "Ganho (mês)", n: data.funil.ganho_mes, dot: "bg-emerald-500" },
    ];
    return { meta, assinado, metaPct, projecao, emDiaPct, acao, comparec, ticket, convVisita, convVenda, funil };
  }, [data]);

  const nome = perfil?.nome || "Gerente";
  const primeiro = nome.split(" ")[0];

  const salvarMeta = async () => {
    const val = Number((metaVal || "").replace(/\./g, "").replace(",", "."));
    if (!val || val <= 0 || !user) { toast.error("Informe um valor de meta válido"); return; }
    setSalvando(true);
    const mes = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
    const { error } = await supabase.from("ceo_metas_mensais").upsert({ gerente_id: user.id, mes, meta_vgv_assinado: val } as any, { onConflict: "gerente_id,mes" });
    setSalvando(false);
    if (error) { toast.error("Não foi possível salvar a meta. " + error.message); return; }
    toast.success("Meta do mês atualizada ✅");
    setMetaOpen(false);
    qc.invalidateQueries({ queryKey: ["gerente-cockpit"] });
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-slate-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl p-4 space-y-3">
        {/* Saudação — mesmo componente do CEO (fonte única), sem filtro de data */}
        <GreetingBar
          name={nome}
          avatarUrl={perfil?.avatar_url}
          subtitle={`Time bom é time que anda junto — bora fechar o mês.${data ? ` · ${data.corretores_total} corretores` : ""}`}
          showFilter={false}
        />

        {isLoading || !data || !d ? (
          <div className="grid gap-3 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-gray-800" />)}</div>
        ) : (
        <>
        {/* Meta + Presença */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="relative overflow-hidden lg:col-span-2">
            <span className="absolute inset-y-0 left-0 w-1 bg-indigo-500" />
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-500" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Meta do mês · VGV assinado</span>
              <button onClick={() => { setMetaVal(d.meta ? String(d.meta) : ""); setMetaOpen(true); }} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 h-7 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-muted dark:hover:bg-gray-700"><Pencil className="h-3 w-3" /> Alterar meta</button>
            </div>
            <div className="mt-2 flex items-end gap-3"><span className="text-4xl font-extrabold leading-none text-indigo-700 dark:text-indigo-300">{money(d.assinado)}</span><span className="pb-1 text-[14px] font-semibold text-slate-500 dark:text-slate-400">{d.meta > 0 ? `de ${money(d.meta)} · ${d.metaPct}%` : "meta não configurada"}</span></div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, d.metaPct ?? 0)}%` }} /></div>
            <div className="mt-2.5 text-[12px] text-slate-500 dark:text-slate-400">Pipeline ativo: <b className="text-slate-800 dark:text-slate-100">{money(data.meta.pipeline_ativo)}</b>{d.meta > 0 ? ` · faltam ${money(Math.max(0, d.meta - d.assinado))}` : ""}</div>
          </Card>
          <Card>
            <div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-emerald-600" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Presença hoje</span></div>
            <div className="mt-2 flex items-baseline gap-2"><span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{data.presentes}</span><span className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">de {data.corretores_total}</span></div>
            <div className="mt-2 flex flex-wrap gap-1">{Array.from({ length: data.corretores_total }).map((_, i) => <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < data.presentes ? "bg-emerald-500" : "bg-slate-200 dark:bg-gray-600"}`} />)}</div>
          </Card>
        </div>

        {/* Resultado do mês */}
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Resultado do mês</div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: <Trophy className="h-3.5 w-3.5" />, label: "Vendas no mês", value: String(data.resultado.vendas_count), sub: `${money(data.resultado.vendas_vgv)} · ticket ${money(d.ticket)}`, tone: "text-emerald-600 dark:text-emerald-400", to: VENDAS },
            { icon: <Users className="h-3.5 w-3.5" />, label: "Leads da equipe", value: data.resultado.leads_ativos.toLocaleString("pt-BR"), sub: `${d.emDiaPct}% em dia`, tone: "text-slate-800 dark:text-slate-100", to: LEADS_TAB },
            { icon: <CalendarCheck className="h-3.5 w-3.5" />, label: "Conversão lead→visita", value: `${d.convVisita}%`, sub: "no mês", tone: "text-slate-800 dark:text-slate-100", to: VISITAS },
            { icon: <TrendingUp className="h-3.5 w-3.5" />, label: "Conversão lead→venda", value: `${d.convVenda}%`, sub: "no mês", tone: "text-slate-800 dark:text-slate-100", to: VENDAS },
          ].map((k) => (
            <button key={k.label} onClick={() => openTab(k.to)} className="group rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center gap-1.5 text-slate-400">{k.icon}<span className="text-[11px] font-semibold uppercase tracking-wide">{k.label}</span><ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" /></div>
              <div className={`mt-1 text-2xl font-extrabold ${k.tone}`}>{k.value}</div>
              <div className="text-[11px] text-slate-400">{k.sub}</div>
            </button>
          ))}
        </div>

        {/* Saúde dos leads + Visitas */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="lg:col-span-2" onClick={() => openTab(LEADS_TAB)}>
            <div className="flex items-baseline justify-between"><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Saúde dos leads do time</span><span className="inline-flex items-center gap-1 text-[12px] text-slate-400">{data.resultado.leads_ativos} leads <ArrowRight className="h-3.5 w-3.5 group-hover:text-slate-500" /></span></div>
            <div className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{d.emDiaPct}%</span><span className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">em dia · {d.acao} p/ ação</span></div>
            <div className="mt-2"><HealthBar counts={data.saude} h="h-2.5" /></div>
            <div className="mt-2.5 flex flex-wrap items-center gap-3">{ORDER.slice(1).map((k) => (<span key={k} className="inline-flex items-center gap-1.5 text-[13px]"><span className={`h-2 w-2 rounded-full ${SAUDE[k].dot}`} /><b className={SAUDE[k].text}>{data.saude[k]}</b> <span className="text-slate-400">{SAUDE[k].label}</span></span>))}</div>
          </Card>
          <Card onClick={() => openTab(VISITAS)}>
            <div className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-sky-600" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Visitas do mês</span><ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" /></div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div><div className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{data.visitas.total}</div><div className="text-[9px] font-semibold uppercase text-slate-400">total</div></div>
              <div><div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{data.visitas.realizadas}</div><div className="text-[9px] font-semibold uppercase text-slate-400">realizadas</div></div>
              <div><div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{d.comparec}%</div><div className="text-[9px] font-semibold uppercase text-slate-400">comparec.</div></div>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">{data.visitas.hoje} agendadas hoje · → abrir agenda</div>
          </Card>
        </div>

        {/* Funil */}
        <Card onClick={() => openTab(NEGOCIOS)}>
          <div className="mb-3 flex items-center gap-2"><Handshake className="h-4 w-4 text-slate-500" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Funil de negócios do time</span><span className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 h-7 text-[11px] font-semibold text-slate-600 dark:text-slate-300 group-hover:bg-muted">Ver no pipeline <ArrowRight className="h-3 w-3" /></span></div>
          <div className="flex flex-wrap items-stretch gap-2">
            {d.funil.map((s) => (<div key={s.nome} className="flex-1 min-w-[100px]"><div className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${s.dot}`} /><span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{s.nome}</span></div><div className="mt-1 text-2xl font-extrabold text-slate-800 dark:text-slate-100">{s.n}</div></div>))}
          </div>
        </Card>

        {/* Agenda do gerente — feature futura (teaser) */}
        <Card className="border-indigo-200 dark:border-indigo-900 bg-indigo-50/30 dark:bg-indigo-950/20">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-600" /><span className="text-[11px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-400">Agenda do gerente · prioridades do time</span><span className="ml-auto rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">EM BREVE</span></div>
          <p className="mt-1.5 text-[12px] text-slate-500 dark:text-slate-400">Em breve: as prioridades do dia (negócios em risco, corretores sem atividade, visitas a acompanhar) num lugar só, pro gerente se organizar.</p>
        </Card>

        {/* Corretores ranqueados */}
        <div>
          <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Corretores do time · resultado do mês</span><span className="text-[11px] text-slate-400">ranqueado por vendas → negócios → visitas → leads</span></div>
          <div className="space-y-1.5">
            {data.corretores.map((c, i) => {
              const rank = i + 1;
              const medalha = rank === 1 ? "bg-amber-100 text-amber-700" : rank === 2 ? "bg-slate-200 text-slate-600" : rank === 3 ? "bg-orange-100 text-orange-700" : "bg-slate-100 dark:bg-gray-700 text-slate-400";
              return (
                <div key={c.nome} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${medalha}`}>{rank}</span>
                  <div className="w-32 shrink-0 min-w-0"><div className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{c.nome}</div><div className="text-[11px] text-slate-400">{c.leads_mes} leads no mês</div></div>
                  <div className="flex flex-1 items-center justify-end gap-4 sm:gap-6">
                    <div className="text-center"><div className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{c.vis_total}<span className="text-slate-300"> / </span>{c.vis_real}</div><div className="text-[9px] uppercase text-slate-400">vis. tot/real</div></div>
                    <div className="text-center"><div className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{c.negocios}</div><div className="text-[9px] uppercase text-slate-400">negócios</div></div>
                    <div className="text-center"><div className="text-[15px] font-extrabold text-emerald-600 dark:text-emerald-400">{c.vendas}</div><div className="text-[9px] uppercase text-slate-400">vendas</div></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </>
        )}
      </div>

      {/* Editar meta (gerente edita a própria — grava na fonte ceo_metas_mensais) */}
      <Dialog open={metaOpen} onOpenChange={(o) => { if (!o && !salvando) setMetaOpen(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Meta do mês · VGV assinado</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">Valor da meta de VGV assinado do time neste mês. Grava na fonte (usada em todo o CRM).</p>
          <Input inputMode="numeric" autoFocus placeholder="Ex.: 4000000" value={metaVal} onChange={(e) => setMetaVal(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setMetaOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button size="sm" onClick={salvarMeta} disabled={salvando}>{salvando ? "Salvando…" : "Salvar meta"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
