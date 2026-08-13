// ─────────────────────────────────────────────────────────────────
// DiretoraMockup — mockup ISOLADO do dashboard da DIRETORA (foco em NEGÓCIOS).
// Rota pública /diretora-mockup. NÃO é produção. Tema claro fixo.
// 3 MODELOS pra comparar (A Cockpit · B Foco na Meta · C Executiva), todos com
// a saudação + nome (igual o CEO). Nome real da diretora: Gabrielle Rodrigues.
// ─────────────────────────────────────────────────────────────────
import { useState } from "react";
import { Handshake, TrendingUp, AlertTriangle, ArrowRight, Target, Trophy, Users } from "lucide-react";

const NOME = "Gabrielle Rodrigues";
const PRIMEIRO = NOME.split(" ")[0];
const INICIAIS = NOME.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

type SaudeKey = "em_dia" | "atencao" | "desatualizado";
const SAUDE = {
  em_dia: { label: "em dia", bar: "bg-emerald-500", dot: "bg-emerald-500", text: "text-emerald-600" },
  atencao: { label: "atenção", bar: "bg-amber-500", dot: "bg-amber-500", text: "text-amber-600" },
  desatualizado: { label: "desatualizado", bar: "bg-red-500", dot: "bg-red-500", text: "text-red-600" },
} as const;
const ORDER: SaudeKey[] = ["em_dia", "atencao", "desatualizado"];
const saudeNeg: Record<SaudeKey, number> = { em_dia: 58, atencao: 13, desatualizado: 14 };
const totalNeg = ORDER.reduce((s, k) => s + saudeNeg[k], 0);
const emDiaPct = Math.round((saudeNeg.em_dia / totalNeg) * 100);

function HealthBar({ counts, h = "h-2" }: { counts: Record<SaudeKey, number>; h?: string }) {
  const total = ORDER.reduce((s, k) => s + counts[k], 0) || 1;
  return (
    <div className={`flex ${h} w-full overflow-hidden rounded-full bg-slate-100`}>
      {ORDER.map((k) => {
        const pct = (counts[k] / total) * 100;
        return pct > 0 ? <div key={k} className={SAUDE[k].bar} style={{ width: `${pct}%` }} /> : null;
      })}
    </div>
  );
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>{children}</div>;
}
function Kpi({ label, value, sub, tone = "text-slate-800" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-extrabold ${tone}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

// Saudação — MESMO padrão do CEO (banner com avatar + nome + frase).
function Saudacao() {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-[16px] font-bold">{INICIAIS}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[20px] font-extrabold leading-tight">Boa tarde, {PRIMEIRO}! 👋</div>
        <div className="text-[13px] text-white/80">Negócio bom é negócio que anda — bora fechar o mês.</div>
      </div>
      <div className="hidden sm:flex items-center gap-2 rounded-lg bg-white/15 px-3 h-9 text-[13px] font-semibold">Agosto 2026</div>
    </div>
  );
}

function MetaHero({ big }: { big?: boolean }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white ${big ? "sm:p-6" : ""}`}>
      <div className="flex items-center gap-2"><Target className="h-4 w-4" /><span className="text-[11px] font-bold uppercase tracking-wide text-white/80">Meta do mês · VGV assinado</span></div>
      <div className="mt-2 flex items-end gap-3">
        <span className={`font-extrabold leading-none ${big ? "text-6xl" : "text-4xl"}`}>R$ 2,1M</span>
        <span className="pb-1 text-[14px] font-semibold text-white/80">de R$ 5,0M · 42%</span>
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: "42%" }} /></div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-white/85">
        <span>Faltam <b className="text-white">R$ 2,9M</b> · restam 19 dias</span>
        <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Projeção no ritmo: <b className="text-white">R$ 3,8M (76%)</b> — abaixo</span>
      </div>
    </div>
  );
}

// Meta em card CLARO (pro Cockpit) — cor sem competir com o roxo da saudação.
function MetaCardLight() {
  return (
    <Card className="relative overflow-hidden">
      <span className="absolute inset-y-0 left-0 w-1 bg-indigo-500" />
      <div className="flex items-center gap-2"><Target className="h-4 w-4 text-indigo-500" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Meta do mês · VGV assinado</span></div>
      <div className="mt-2 flex items-end gap-3">
        <span className="text-4xl font-extrabold leading-none text-indigo-700">R$ 2,1M</span>
        <span className="pb-1 text-[14px] font-semibold text-slate-500">de R$ 5,0M · 42%</span>
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: "42%" }} /></div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <span className="text-slate-500">Faltam <b className="text-slate-800">R$ 2,9M</b> · restam 19 dias</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Projeção: R$ 3,8M (76%) — abaixo</span>
      </div>
    </Card>
  );
}

function SaudeNegocios() {
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Saúde dos negócios em andamento</span>
        <span className="text-[12px] text-slate-400">{totalNeg} negócios · R$ 18,3M em jogo</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-extrabold text-emerald-600">{emDiaPct}%</span><span className="text-[13px] font-semibold text-slate-500">em dia</span></div>
      <div className="mt-2"><HealthBar counts={saudeNeg} h="h-2.5" /></div>
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        {ORDER.map((k) => (<span key={k} className="inline-flex items-center gap-1.5 text-[13px]"><span className={`h-2 w-2 rounded-full ${SAUDE[k].dot}`} /><b className={SAUDE[k].text}>{saudeNeg[k]}</b> <span className="text-slate-400">{SAUDE[k].label}</span></span>))}
      </div>
    </Card>
  );
}

function Funil({ compact }: { compact?: boolean }) {
  const stages = [
    { nome: "Pós-Visita", n: 61, vgv: "—", dot: "bg-cyan-500", conv: "pronto" },
    { nome: "Documentação", n: 9, vgv: "R$ 7,9M", dot: "bg-sky-500", conv: "↓15%" },
    { nome: "Proposta", n: 11, vgv: "R$ 10,3M", dot: "bg-violet-500", conv: "↓34%" },
    { nome: "Contrato", n: 2, vgv: "R$ 395k", dot: "bg-indigo-500", conv: "↓41%" },
    { nome: "Ganho (mês)", n: 7, vgv: "R$ 2,1M", dot: "bg-emerald-500", conv: "↓78%" },
  ];
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2"><Handshake className="h-4 w-4 text-slate-500" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Funil de negócios</span></div>
      <div className="flex flex-wrap items-stretch gap-2">
        {stages.map((s) => (
          <div key={s.nome} className="flex-1 min-w-[110px]">
            <div className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${s.dot}`} /><span className="text-[11px] font-semibold text-slate-500">{s.nome}</span></div>
            <div className={`mt-1 font-extrabold text-slate-800 ${compact ? "text-xl" : "text-2xl"}`}>{s.n}</div>
            <div className="text-[11px] text-slate-400">{s.vgv}</div>
            <div className="text-[10.5px] font-semibold text-slate-400">{s.conv}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

const EQUIPES = [
  { nome: "Bruno Schuler", metaPct: 44, assinado: "R$ 1,8M", meta: "R$ 4,0M", neg: 2, saude: { em_dia: 470, atencao: 136, desatualizado: 26 } as Record<SaudeKey, number>, accent: "border-blue-200", alertas: 26 },
  { nome: "Gabriel Vieira", metaPct: null, assinado: "R$ 0,3M", meta: null, neg: 11, saude: { em_dia: 380, atencao: 74, desatualizado: 11 } as Record<SaudeKey, number>, accent: "border-emerald-200", alertas: 11 },
  { nome: "Junior Padilha", metaPct: null, assinado: "R$ 0", meta: null, neg: 5, saude: { em_dia: 180, atencao: 20, desatualizado: 2 } as Record<SaudeKey, number>, accent: "border-amber-200", alertas: 2 },
];

function Alertas() {
  const items = [
    { t: "14 negócios desatualizados", d: "parados há +14 dias — R$ 4,1M em risco", cls: "text-red-600", ico: "bg-red-50" },
    { t: "3 propostas sem retorno", d: "enviadas há +9 dias, sem resposta", cls: "text-amber-600", ico: "bg-amber-50" },
    { t: "2 gerentes sem meta", d: "Gabriel e Junior — sem baseline", cls: "text-slate-600", ico: "bg-slate-100" },
  ];
  return (
    <Card>
      <div className="mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Alertas comerciais</span></div>
      <div className="space-y-2">
        {items.map((a) => (
          <button key={a.t} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 text-left hover:bg-slate-50">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${a.ico}`}><AlertTriangle className={`h-4 w-4 ${a.cls}`} /></div>
            <div className="min-w-0 flex-1"><div className={`text-[13px] font-semibold ${a.cls}`}>{a.t}</div><div className="text-[11px] text-slate-400">{a.d}</div></div>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
          </button>
        ))}
      </div>
    </Card>
  );
}

function Vendas() {
  const v = [["Carlos A. Filipini", "Lake Vitória · Bruno", "R$ 6,2M"], ["Miguel Padilha", "Lake Eyre · Gabriel", "R$ 2,6M"], ["Tassia", "Terra Matter · Junior", "R$ 1,3M"]];
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Vendas assinadas no mês</span><span className="text-[11px] font-semibold text-indigo-600">ver todas →</span></div>
      <div className="divide-y divide-slate-100">
        {v.map((x, i) => (<div key={i} className="flex items-center justify-between py-2"><div className="min-w-0"><div className="truncate text-[13px] font-semibold text-slate-800">{x[0]}</div><div className="truncate text-[11px] text-slate-400">{x[1]}</div></div><span className="shrink-0 text-[13px] font-extrabold text-emerald-600">{x[2]}</span></div>))}
      </div>
    </Card>
  );
}

// ══════════ MODELO A — Cockpit (visual, completo) ══════════
function ModeloA() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2"><MetaCardLight /></div>
        <Card>
          <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-emerald-600" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Vendas no mês</span></div>
          <div className="mt-2 flex items-baseline gap-2"><span className="text-3xl font-extrabold text-slate-800">7</span><span className="text-[13px] font-semibold text-slate-500">assinadas</span></div>
          <div className="mt-2 space-y-1 text-[12px] text-slate-500"><div className="flex justify-between"><span>Ticket médio</span><b className="text-slate-700">R$ 300k</b></div><div className="flex justify-between"><span>vs mês anterior</span><b className="text-emerald-600">+2 vendas</b></div></div>
        </Card>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2"><SaudeNegocios /></div>
        <Card>
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Conversão do funil</span>
          <div className="mt-2 space-y-1.5 text-[12.5px]">
            <div className="flex justify-between"><span className="text-slate-500">Visita → Proposta</span><b>34%</b></div>
            <div className="flex justify-between"><span className="text-slate-500">Proposta → Contrato</span><b>41%</b></div>
            <div className="flex justify-between"><span className="text-slate-500">Contrato → Ganho</span><b>78%</b></div>
            <div className="mt-1 flex justify-between border-t border-slate-100 pt-1.5"><span className="font-semibold text-slate-600">Lead → Venda</span><b className="text-emerald-600">6,2%</b></div>
          </div>
        </Card>
      </div>
      <Funil />
      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Performance por equipe</div>
        <div className="grid gap-3 lg:grid-cols-3">
          {EQUIPES.map((g) => (
            <div key={g.nome} className={`rounded-2xl border bg-white p-4 ${g.accent}`}>
              <div className="flex items-center justify-between"><span className="text-[14px] font-bold text-slate-800">{g.nome}</span><span><b className="text-lg font-extrabold text-slate-800">{g.neg}</b><span className="ml-1 text-[10px] font-semibold uppercase text-slate-400">neg.</span></span></div>
              {g.metaPct != null ? (<><div className="mt-2 flex justify-between text-[11px]"><span className="font-semibold text-slate-500">Meta {g.assinado}/{g.meta}</span><b>{g.metaPct}%</b></div><div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${g.metaPct}%` }} /></div></>) : (<button className="mt-2 text-[11px] font-semibold text-indigo-600 hover:underline">+ Configurar meta</button>)}
              <div className="mt-2.5"><HealthBar counts={g.saude} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2"><Vendas /><Alertas /></div>
    </div>
  );
}

// ══════════ MODELO B — Foco na Meta (minimalista, o número domina) ══════════
function ModeloB() {
  return (
    <div className="space-y-3">
      <MetaHero big />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Vendas no mês" value="7" sub="R$ 2,1M · ticket R$ 300k" tone="text-emerald-600" />
        <Kpi label="Negócios ativos" value="85" sub="R$ 18,3M em jogo" />
        <Kpi label="Em dia" value={`${emDiaPct}%`} sub="saúde do pipeline" tone="text-emerald-600" />
        <Kpi label="Lead → Venda" value="6,2%" sub="conversão" />
      </div>
      <Funil compact />
      <Card>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Equipes</div>
        <div className="divide-y divide-slate-100">
          {EQUIPES.map((g) => (
            <div key={g.nome} className="flex items-center gap-3 py-2.5">
              <span className="w-40 shrink-0 truncate text-[13px] font-semibold text-slate-800">{g.nome}</span>
              <span className="w-16 shrink-0 text-[13px]"><b className="text-slate-800">{g.neg}</b> <span className="text-[10px] text-slate-400">neg</span></span>
              <div className="flex-1"><HealthBar counts={g.saude} h="h-1.5" /></div>
              <span className="w-14 shrink-0 text-right text-[12px] font-bold text-slate-700">{g.metaPct != null ? `${g.metaPct}%` : "—"}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ══════════ MODELO C — Executiva (tabela de comparação por equipe) ══════════
function ModeloC() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Meta do mês" value="42%" sub="R$ 2,1M / 5,0M" tone="text-indigo-600" />
        <Kpi label="Projeção" value="76%" sub="R$ 3,8M — abaixo" tone="text-amber-600" />
        <Kpi label="Vendas" value="7" sub="ticket R$ 300k" tone="text-emerald-600" />
        <Kpi label="Negócios" value="85" sub="R$ 18,3M em jogo" />
        <Kpi label="Em dia" value={`${emDiaPct}%`} tone="text-emerald-600" />
        <Kpi label="Lead→Venda" value="6,2%" />
      </div>
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5">Equipe</th><th className="px-3 py-2.5 text-right">Meta</th><th className="px-3 py-2.5 text-right">Assinado</th><th className="px-3 py-2.5 text-right">Negócios</th><th className="px-3 py-2.5 w-40">Saúde</th><th className="px-4 py-2.5 text-right">Desatual.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {EQUIPES.map((g) => (
                <tr key={g.nome} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{g.nome}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-700">{g.metaPct != null ? `${g.metaPct}%` : <span className="text-indigo-600">definir</span>}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{g.assinado}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-800">{g.neg}</td>
                  <td className="px-3 py-2.5"><HealthBar counts={g.saude} h="h-1.5" /></td>
                  <td className={`px-4 py-2.5 text-right font-bold ${g.alertas > 15 ? "text-red-600" : "text-slate-500"}`}>{g.alertas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-3 lg:grid-cols-2"><Funil compact /><Alertas /></div>
    </div>
  );
}

export default function DiretoraMockup() {
  const [modelo, setModelo] = useState<"A" | "B" | "C">("A");
  const modelos = [
    { key: "A" as const, nome: "A · Cockpit", desc: "visual e completo" },
    { key: "B" as const, nome: "B · Foco na Meta", desc: "minimalista, o número domina" },
    { key: "C" as const, nome: "C · Executiva", desc: "tabela de comparação" },
  ];
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-[20px] font-extrabold">Dashboard da Diretora — 3 modelos pra comparar</h1>
        <p className="mt-1 text-[13px] text-slate-500">Todos com foco em negócios e a saudação com o nome (igual o CEO). Troca o modelo pra comparar.</p>

        {/* Seletor de modelo */}
        <div className="mt-4 inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {modelos.map((m) => (
            <button key={m.key} onClick={() => setModelo(m.key)} className={`rounded-lg px-3.5 py-2 text-left transition-colors ${modelo === m.key ? "bg-white shadow-sm" : "hover:bg-white/60"}`}>
              <div className={`text-[13px] font-bold ${modelo === m.key ? "text-slate-900" : "text-slate-500"}`}>{m.nome}</div>
              <div className="text-[11px] text-slate-400">{m.desc}</div>
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          <Saudacao />
          {modelo === "A" && <ModeloA />}
          {modelo === "B" && <ModeloB />}
          {modelo === "C" && <ModeloC />}
        </div>
      </div>
    </div>
  );
}
