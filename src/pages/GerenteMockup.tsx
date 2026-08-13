// ─────────────────────────────────────────────────────────────────
// GerenteMockup — mockup ISOLADO do dashboard do GERENTE (o time dele).
// Rota pública /gerente-mockup. NÃO é produção. Tema claro fixo.
// 3 MODELOS (A Cockpit do Time · B Time em Foco · C Meu Dia), todos com saudação.
// Gerente exemplo: Bruno Schuler. Vê presença · leads · visitas · negócios · funil
// + agenda do gerente (feature futura).
// ─────────────────────────────────────────────────────────────────
import { useState } from "react";
import {
  Target, Handshake, Users, CalendarCheck, UserCheck, AlertTriangle, ArrowRight,
  Sparkles, Clock, Bell, TrendingUp, Pencil, Trophy,
} from "lucide-react";

const NOME = "Bruno Schuler";
const PRIMEIRO = NOME.split(" ")[0];
const INICIAIS = NOME.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

// Saúde de LEAD (tem estagnado). Negócio usa só os 3 primeiros.
type SaudeKey = "em_dia" | "atencao" | "desatualizado" | "estagnado";
const SAUDE = {
  em_dia: { label: "em dia", bar: "bg-emerald-500", dot: "bg-emerald-500", text: "text-emerald-600" },
  atencao: { label: "atenção", bar: "bg-amber-500", dot: "bg-amber-500", text: "text-amber-600" },
  desatualizado: { label: "desatualizado", bar: "bg-red-500", dot: "bg-red-500", text: "text-red-600" },
  estagnado: { label: "estagnado", bar: "bg-violet-500", dot: "bg-violet-500", text: "text-violet-600" },
} as const;
const LEAD_ORDER: SaudeKey[] = ["em_dia", "atencao", "desatualizado", "estagnado"];

function HealthBar({ counts, order, h = "h-2" }: { counts: Partial<Record<SaudeKey, number>>; order: SaudeKey[]; h?: string }) {
  const total = order.reduce((s, k) => s + (counts[k] || 0), 0) || 1;
  return (
    <div className={`flex ${h} w-full overflow-hidden rounded-full bg-slate-100`}>
      {order.map((k) => { const pct = ((counts[k] || 0) / total) * 100; return pct > 0 ? <div key={k} className={SAUDE[k].bar} style={{ width: `${pct}%` }} /> : null; })}
    </div>
  );
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>{children}</div>;
}
function KpiMini({ icon, label, value, sub, tone = "text-slate-800" }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex items-center gap-1.5 text-slate-400">{icon}<span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span></div>
      <div className={`mt-1 text-xl font-extrabold ${tone}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

// dados de exemplo — time do Bruno (15 corretores)
const TIME = {
  corretores: 15, presentes: 12,
  leads: 803, leadsSaude: { em_dia: 612, atencao: 110, desatualizado: 62, estagnado: 18 } as Record<SaudeKey, number>,
  // VISITAS do mês: total agendadas · realizadas · comparecimento (realizadas/total)
  visitasHoje: 6, visitasTotalMes: 72, visitasRealizadasMes: 58, comparecimento: 81,
  negocios: 12, negFunil: [
    { nome: "Pós-Visita", n: 9, dot: "bg-cyan-500" }, { nome: "Documentação", n: 3, dot: "bg-sky-500" },
    { nome: "Proposta", n: 5, dot: "bg-violet-500" }, { nome: "Contrato", n: 1, dot: "bg-indigo-500" },
    { nome: "Ganho (mês)", n: 2, dot: "bg-emerald-500" },
  ],
  meta: 4_000_000, assinado: 1_800_000, metaPct: 44, pipelineAtivo: "R$ 1,7M",
  // RESULTADO do mês
  vendasMes: 6, vgvMes: "R$ 1,8M", ticket: "R$ 300k",
  convVisita: 22,   // lead → visita (%)
  convVenda: 4.1,   // lead → venda (%)
};
// corretores — números rápidos do MÊS (sem saúde; a saúde do time já está em cima).
// leads = recebidos no mês. Ranqueado por vendas → negócios → realizadas → leads.
const CORRETORES = [
  { nome: "William Brizola", leadsMes: 100, visitasTotais: 15, visitasReal: 12, negocios: 1, vendas: 2 },
  { nome: "Matheus Pasin", leadsMes: 87, visitasTotais: 10, visitasReal: 8, negocios: 1, vendas: 1 },
  { nome: "Luiza Clós", leadsMes: 79, visitasTotais: 13, visitasReal: 11, negocios: 0, vendas: 1 },
  { nome: "Rafaela Sandin", leadsMes: 127, visitasTotais: 12, visitasReal: 9, negocios: 0, vendas: 0 },
  { nome: "Ebert Silva", leadsMes: 98, visitasTotais: 4, visitasReal: 3, negocios: 0, vendas: 0 },
].sort((a, b) => b.vendas - a.vendas || b.negocios - a.negocios || b.visitasReal - a.visitasReal || b.leadsMes - a.leadsMes);

function Saudacao({ variante = "cockpit" }: { variante?: string }) {
  const frase = variante === "dia" ? "Bora organizar o dia do time." : "Time bom é time que anda junto — bora fechar o mês.";
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-[16px] font-bold">{INICIAIS}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[20px] font-extrabold leading-tight">Boa tarde, {PRIMEIRO}! 👋</div>
        <div className="text-[13px] text-white/80">{frase} · {TIME.corretores} corretores</div>
      </div>
      <div className="hidden sm:flex items-center gap-2 rounded-lg bg-white/15 px-3 h-9 text-[13px] font-semibold">Agosto 2026</div>
    </div>
  );
}

function MetaCard() {
  return (
    <Card className="relative overflow-hidden">
      <span className="absolute inset-y-0 left-0 w-1 bg-indigo-500" />
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-indigo-500" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Meta do mês · VGV assinado</span>
        <button className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 h-7 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"><Pencil className="h-3 w-3" /> Alterar meta</button>
      </div>
      <div className="mt-2 flex items-end gap-3"><span className="text-4xl font-extrabold leading-none text-indigo-700">R$ 1,8M</span><span className="pb-1 text-[14px] font-semibold text-slate-500">de R$ 4,0M · {TIME.metaPct}%</span></div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${TIME.metaPct}%` }} /></div>
      <div className="mt-2.5 text-[12px] text-slate-500">Pipeline ativo: <b className="text-slate-800">{TIME.pipelineAtivo}</b> · faltam R$ 2,2M</div>
    </Card>
  );
}

// Resultado do mês — KPIs de RESULTADO (o que o Lucas pediu). Clicáveis (setinha).
function ResultadoKpis() {
  const items = [
    { icon: <Trophy className="h-3.5 w-3.5" />, label: "Vendas no mês", value: String(TIME.vendasMes), sub: `${TIME.vgvMes} · ticket ${TIME.ticket}`, tone: "text-emerald-600", to: "vendas" },
    { icon: <Users className="h-3.5 w-3.5" />, label: "Leads da equipe", value: TIME.leads.toLocaleString("pt-BR"), sub: "76% em dia", tone: "text-slate-800", to: "leads" },
    { icon: <CalendarCheck className="h-3.5 w-3.5" />, label: "Conversão lead→visita", value: `${TIME.convVisita}%`, sub: "no mês", tone: "text-slate-800", to: "convVisita" },
    { icon: <TrendingUp className="h-3.5 w-3.5" />, label: "Conversão lead→venda", value: `${TIME.convVenda}%`, sub: "no mês", tone: "text-slate-800", to: "convVenda" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((k) => (
        <button key={k.label} className="group rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center gap-1.5 text-slate-400">{k.icon}<span className="text-[11px] font-semibold uppercase tracking-wide">{k.label}</span><ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" /></div>
          <div className={`mt-1 text-2xl font-extrabold ${k.tone}`}>{k.value}</div>
          <div className="text-[11px] text-slate-400">{k.sub}</div>
        </button>
      ))}
    </div>
  );
}
function PresencaCard() {
  return (
    <Card>
      <div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-emerald-600" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Presença hoje</span></div>
      <div className="mt-2 flex items-baseline gap-2"><span className="text-3xl font-extrabold text-slate-800">{TIME.presentes}</span><span className="text-[13px] font-semibold text-slate-500">de {TIME.corretores}</span></div>
      <div className="mt-2 flex flex-wrap gap-1">
        {Array.from({ length: TIME.corretores }).map((_, i) => <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < TIME.presentes ? "bg-emerald-500" : "bg-slate-200"}`} />)}
      </div>
      <div className="mt-1.5 text-[11px] text-slate-400">3 ausentes — Ebert, Paula, Léo</div>
    </Card>
  );
}
function LeadsCard() {
  const acao = TIME.leadsSaude.atencao + TIME.leadsSaude.desatualizado + TIME.leadsSaude.estagnado;
  return (
    <Card>
      <div className="flex items-baseline justify-between"><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Saúde dos leads do time</span><span className="text-[12px] text-slate-400">{TIME.leads} leads</span></div>
      <div className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-extrabold text-emerald-600">76%</span><span className="text-[13px] font-semibold text-slate-500">em dia · {acao} p/ ação</span></div>
      <div className="mt-2"><HealthBar counts={TIME.leadsSaude} order={LEAD_ORDER} h="h-2.5" /></div>
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        {LEAD_ORDER.slice(1).map((k) => (<span key={k} className="inline-flex items-center gap-1.5 text-[13px]"><span className={`h-2 w-2 rounded-full ${SAUDE[k].dot}`} /><b className={SAUDE[k].text}>{TIME.leadsSaude[k]}</b> <span className="text-slate-400">{SAUDE[k].label}</span></span>))}
      </div>
    </Card>
  );
}
function VisitasCard() {
  return (
    <button className="group w-full text-left">
    <Card className="transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
      <div className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-sky-600" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Visitas do mês</span><ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" /></div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div><div className="text-2xl font-extrabold text-slate-800">{TIME.visitasTotalMes}</div><div className="text-[9px] font-semibold uppercase text-slate-400">total</div></div>
        <div><div className="text-2xl font-extrabold text-emerald-600">{TIME.visitasRealizadasMes}</div><div className="text-[9px] font-semibold uppercase text-slate-400">realizadas</div></div>
        <div><div className="text-2xl font-extrabold text-indigo-600">{TIME.comparecimento}%</div><div className="text-[9px] font-semibold uppercase text-slate-400">comparec.</div></div>
      </div>
      <div className="mt-2 text-[11px] text-slate-400">{TIME.visitasHoje} agendadas hoje · → abrir agenda</div>
    </Card>
    </button>
  );
}
function FunilCard() {
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2"><Handshake className="h-4 w-4 text-slate-500" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Funil de negócios do time</span><button className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 h-7 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">Ver no pipeline <ArrowRight className="h-3 w-3" /></button></div>
      <div className="flex flex-wrap items-stretch gap-2">
        {TIME.negFunil.map((s) => (
          <div key={s.nome} className="flex-1 min-w-[100px]">
            <div className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${s.dot}`} /><span className="text-[11px] font-semibold text-slate-500">{s.nome}</span></div>
            <div className="mt-1 text-2xl font-extrabold text-slate-800">{s.n}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
// Agenda do gerente — FEATURE FUTURA (teaser)
function AgendaGerente({ big }: { big?: boolean }) {
  const itens = [
    { ico: <Handshake className="h-4 w-4 text-red-600" />, t: "2 negócios em risco no time", d: "Matheus e William com contrato parado +7d", cls: "bg-red-50" },
    { ico: <UserCheck className="h-4 w-4 text-amber-600" />, t: "3 corretores sem atividade hoje", d: "cobrar Ebert, Paula, Léo", cls: "bg-amber-50" },
    { ico: <CalendarCheck className="h-4 w-4 text-sky-600" />, t: "6 visitas do time hoje", d: "acompanhar resultado até 18h", cls: "bg-sky-50" },
  ];
  return (
    <Card className="border-indigo-200 bg-indigo-50/30">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-indigo-600" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-700">Agenda do gerente · prioridades do time</span>
        <span className="ml-auto rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">EM BREVE</span>
      </div>
      <div className={`grid gap-2 ${big ? "sm:grid-cols-3" : ""}`}>
        {itens.map((a) => (
          <div key={a.t} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${a.cls}`}>{a.ico}</div>
            <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-slate-800">{a.t}</div><div className="text-[11px] text-slate-400">{a.d}</div></div>
          </div>
        ))}
      </div>
    </Card>
  );
}
function CorretorRow({ c, rank }: { c: typeof CORRETORES[number]; rank: number }) {
  const medalha = rank === 1 ? "bg-amber-100 text-amber-700" : rank === 2 ? "bg-slate-200 text-slate-600" : rank === 3 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-400";
  return (
    <button className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:bg-slate-50">
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${medalha}`}>{rank}</span>
      <div className="w-32 shrink-0 min-w-0"><div className="truncate text-[13px] font-semibold text-slate-800">{c.nome}</div><div className="text-[11px] text-slate-400">{c.leadsMes} leads no mês</div></div>
      <div className="flex flex-1 items-center justify-end gap-4 sm:gap-6">
        <div className="text-center"><div className="text-[13px] font-bold text-slate-700">{c.visitasTotais}<span className="text-slate-300"> / </span>{c.visitasReal}</div><div className="text-[9px] uppercase text-slate-400">vis. tot/real</div></div>
        <div className="text-center"><div className="text-[13px] font-bold text-slate-700">{c.negocios}</div><div className="text-[9px] uppercase text-slate-400">negócios</div></div>
        <div className="text-center"><div className="text-[15px] font-extrabold text-emerald-600">{c.vendas}</div><div className="text-[9px] uppercase text-slate-400">vendas</div></div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-slate-500" />
    </button>
  );
}

// ═══════ A — Cockpit do Time ═══════
function ModeloA() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3"><div className="lg:col-span-2"><MetaCard /></div><PresencaCard /></div>
      {/* KPIs de RESULTADO do mês */}
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Resultado do mês</div>
      <ResultadoKpis />
      <div className="grid gap-3 lg:grid-cols-3"><div className="lg:col-span-2"><LeadsCard /></div><VisitasCard /></div>
      <FunilCard />
      <AgendaGerente big />
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Corretores do time · resultado do mês</span>
          <span className="text-[11px] text-slate-400">ranqueado por vendas → negócios → visitas → leads</span>
        </div>
        <div className="space-y-1.5">{CORRETORES.map((c, i) => <CorretorRow key={c.nome} c={c} rank={i + 1} />)}</div>
      </div>
    </div>
  );
}

// ═══════ B — Time em Foco (roster domina) ═══════
function ModeloB() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiMini icon={<UserCheck className="h-3.5 w-3.5" />} label="Presença" value={`${TIME.presentes}/${TIME.corretores}`} tone="text-emerald-600" />
        <KpiMini icon={<Users className="h-3.5 w-3.5" />} label="Leads" value="803" sub="76% em dia" />
        <KpiMini icon={<CalendarCheck className="h-3.5 w-3.5" />} label="Visitas hoje" value={String(TIME.visitasHoje)} />
        <KpiMini icon={<Handshake className="h-3.5 w-3.5" />} label="Negócios" value={String(TIME.negocios)} tone="text-slate-800" />
        <KpiMini icon={<Target className="h-3.5 w-3.5" />} label="Meta" value={`${TIME.metaPct}%`} sub="R$1,8M/4,0M" tone="text-indigo-600" />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Meu time</span><span className="text-[11px] text-slate-400">ranqueado · leads · visitas · negócios · vendas</span></div>
        <div className="space-y-1.5">{CORRETORES.map((c, i) => <CorretorRow key={c.nome} c={c} rank={i + 1} />)}</div>
      </div>
      <AgendaGerente />
    </div>
  );
}

// ═══════ C — Meu Dia (operacional de hoje) ═══════
function ModeloC() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMini icon={<UserCheck className="h-3.5 w-3.5" />} label="Presentes hoje" value={`${TIME.presentes}/${TIME.corretores}`} tone="text-emerald-600" />
        <KpiMini icon={<CalendarCheck className="h-3.5 w-3.5" />} label="Visitas hoje" value={String(TIME.visitasHoje)} sub="acompanhar resultado" />
        <KpiMini icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Leads p/ ação" value="190" sub="atenção+desatual" tone="text-amber-600" />
        <KpiMini icon={<Handshake className="h-3.5 w-3.5" />} label="Negócios em risco" value="2" sub="contrato parado" tone="text-red-600" />
      </div>
      <AgendaGerente big />
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center gap-2"><Clock className="h-4 w-4 text-sky-600" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Visitas do time hoje</span></div>
          <div className="divide-y divide-slate-100">
            {[["09:30", "Rafaela", "Casa Tua Canoas"], ["11:00", "Luiza", "Lake Eyre"], ["14:00", "Matheus", "The Arch"], ["16:30", "William", "Connect JW"]].map((v, i) => (
              <div key={i} className="flex items-center gap-3 py-2"><span className="w-12 shrink-0 text-[13px] font-bold text-slate-700">{v[0]}</span><span className="w-24 shrink-0 truncate text-[13px] text-slate-600">{v[1]}</span><span className="flex-1 truncate text-[12px] text-slate-400">{v[2]}</span></div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-2 flex items-center gap-2"><Bell className="h-4 w-4 text-red-500" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Cobranças do dia</span></div>
          <div className="space-y-2">
            {[["Ebert sem atividade", "0 toques hoje", "bg-amber-50", "text-amber-600"], ["Matheus — contrato parado", "há 8 dias", "bg-red-50", "text-red-600"], ["Paula ausente", "não bateu presença", "bg-slate-100", "text-slate-600"]].map((a, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5"><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${a[2]}`}><AlertTriangle className={`h-4 w-4 ${a[3]}`} /></div><div className="min-w-0 flex-1"><div className={`text-[13px] font-semibold ${a[3]}`}>{a[0]}</div><div className="text-[11px] text-slate-400">{a[1]}</div></div><ArrowRight className="h-3.5 w-3.5 text-slate-300" /></div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function GerenteMockup() {
  const [modelo, setModelo] = useState<"A" | "B" | "C">("A");
  const modelos = [
    { key: "A" as const, nome: "A · Cockpit do Time", desc: "mensal e completo" },
    { key: "B" as const, nome: "B · Time em Foco", desc: "os corretores dominam" },
    { key: "C" as const, nome: "C · Meu Dia", desc: "operacional de hoje" },
  ];
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-[20px] font-extrabold">Dashboard do Gerente — 3 modelos pra comparar</h1>
        <p className="mt-1 text-[13px] text-slate-500">O gerente vê o <b>time dele</b>: presença · leads · visitas · negócios · funil + <b>agenda do gerente</b> (feature futura, teaser). Troca o modelo pra comparar.</p>

        <div className="mt-4 inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {modelos.map((m) => (
            <button key={m.key} onClick={() => setModelo(m.key)} className={`rounded-lg px-3.5 py-2 text-left transition-colors ${modelo === m.key ? "bg-white shadow-sm" : "hover:bg-white/60"}`}>
              <div className={`text-[13px] font-bold ${modelo === m.key ? "text-slate-900" : "text-slate-500"}`}>{m.nome}</div>
              <div className="text-[11px] text-slate-400">{m.desc}</div>
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          <Saudacao variante={modelo === "C" ? "dia" : "cockpit"} />
          {modelo === "A" && <ModeloA />}
          {modelo === "B" && <ModeloB />}
          {modelo === "C" && <ModeloC />}
        </div>
      </div>
    </div>
  );
}
