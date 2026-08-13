// ─────────────────────────────────────────────────────────────────
// DiretoraMockup — mockup ISOLADO do dashboard da DIRETORA (foco em NEGÓCIOS).
// Rota pública /diretora-mockup. NÃO é produção. Tema claro fixo.
// Hierarquia: o NÚMERO do mês (meta) → o que alimenta (saúde + funil) →
// quem executa (equipes) → detalhe (vendas + alertas comerciais).
// ─────────────────────────────────────────────────────────────────
import { Handshake, TrendingUp, AlertTriangle, ArrowRight, Target, Trophy } from "lucide-react";

type SaudeKey = "em_dia" | "atencao" | "desatualizado";
const SAUDE = {
  em_dia: { label: "em dia", bar: "bg-emerald-500", dot: "bg-emerald-500", text: "text-emerald-600" },
  atencao: { label: "atenção", bar: "bg-amber-500", dot: "bg-amber-500", text: "text-amber-600" },
  desatualizado: { label: "desatualizado", bar: "bg-red-500", dot: "bg-red-500", text: "text-red-600" },
} as const;
const ORDER: SaudeKey[] = ["em_dia", "atencao", "desatualizado"];

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

// Etapa do funil de negócios
function FunilStage({ nome, n, vgv, dot, conv }: { nome: string; n: number; vgv?: string; dot: string; conv?: string }) {
  return (
    <div className="flex-1 min-w-[120px]">
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="text-[11px] font-semibold text-slate-500">{nome}</span>
      </div>
      <div className="mt-1 text-2xl font-extrabold text-slate-800">{n}</div>
      <div className="text-[11px] text-slate-400">{vgv ?? "—"}</div>
      {conv && <div className="mt-0.5 text-[10.5px] font-semibold text-slate-400">{conv}</div>}
    </div>
  );
}

export default function DiretoraMockup() {
  const meta = 5_000_000, assinado = 2_100_000;
  const metaPct = Math.round((assinado / meta) * 100);
  const projecao = 3_800_000; // no ritmo atual
  const projPct = Math.round((projecao / meta) * 100);
  const saudeNeg: Record<SaudeKey, number> = { em_dia: 58, atencao: 13, desatualizado: 14 };
  const totalNeg = ORDER.reduce((s, k) => s + saudeNeg[k], 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-extrabold">Dashboard da Diretora — foco em negócios (mockup)</h1>
            <p className="mt-1 text-[13px] text-slate-500">Comercial-first: o número do mês, o que alimenta (saúde + funil), quem executa e os alertas. Sem roleta/marketing.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 h-9 text-[13px] font-semibold text-slate-600">Agosto 2026</div>
        </div>

        {/* ══ HERÓI: o número do mês (vamos bater?) ══ */}
        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          <Card className="lg:col-span-2 !bg-gradient-to-br from-indigo-600 to-violet-600 !border-transparent text-white">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-white/80">Meta do mês · VGV assinado</span>
            </div>
            <div className="mt-2 flex items-end gap-3">
              <span className="text-4xl font-extrabold leading-none">R$ 2,1M</span>
              <span className="pb-1 text-[14px] font-semibold text-white/80">de R$ 5,0M · {metaPct}%</span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white" style={{ width: `${metaPct}%` }} />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-white/85">
              <span>Faltam <b className="text-white">R$ 2,9M</b> · restam 19 dias</span>
              <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Projeção no ritmo: <b className="text-white">R$ 3,8M ({projPct}%)</b> — abaixo</span>
            </div>
          </Card>

          {/* Vendas assinadas + ticket */}
          <Card>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-emerald-600" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Vendas no mês</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-800">7</span>
              <span className="text-[13px] font-semibold text-slate-500">assinadas</span>
            </div>
            <div className="mt-2 space-y-1 text-[12px] text-slate-500">
              <div className="flex justify-between"><span>Ticket médio</span><b className="text-slate-700">R$ 300k</b></div>
              <div className="flex justify-between"><span>vs mês anterior</span><b className="text-emerald-600">+2 vendas</b></div>
            </div>
          </Card>
        </div>

        {/* ══ O QUE ALIMENTA: saúde dos negócios + conversão ══ */}
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Saúde dos negócios em andamento</span>
              <span className="text-[12px] text-slate-400">{totalNeg} negócios · R$ 18,3M em jogo</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-emerald-600">{Math.round((saudeNeg.em_dia / totalNeg) * 100)}%</span>
              <span className="text-[13px] font-semibold text-slate-500">em dia</span>
            </div>
            <div className="mt-2"><HealthBar counts={saudeNeg} h="h-2.5" /></div>
            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              {ORDER.map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5 text-[13px]">
                  <span className={`h-2 w-2 rounded-full ${SAUDE[k].dot}`} />
                  <b className={SAUDE[k].text}>{saudeNeg[k]}</b> <span className="text-slate-400">{SAUDE[k].label}</span>
                </span>
              ))}
            </div>
          </Card>
          <Card>
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Conversão do funil</span>
            <div className="mt-2 space-y-1.5 text-[12.5px]">
              <div className="flex items-center justify-between"><span className="text-slate-500">Visita → Proposta</span><b className="text-slate-800">34%</b></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Proposta → Contrato</span><b className="text-slate-800">41%</b></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Contrato → Ganho</span><b className="text-slate-800">78%</b></div>
              <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-1.5"><span className="font-semibold text-slate-600">Lead → Venda</span><b className="text-emerald-600">6,2%</b></div>
            </div>
          </Card>
        </div>

        {/* ══ FUNIL DE NEGÓCIOS ══ */}
        <Card className="mt-3">
          <div className="mb-3 flex items-center gap-2">
            <Handshake className="h-4 w-4 text-slate-500" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Funil de negócios</span>
          </div>
          <div className="flex flex-wrap items-stretch gap-2">
            <FunilStage nome="Pós-Visita" n={61} dot="bg-cyan-500" conv="pronto p/ virar" />
            <FunilStage nome="Documentação" n={9} vgv="R$ 7,9M" dot="bg-sky-500" conv="↓ 15%" />
            <FunilStage nome="Proposta" n={11} vgv="R$ 10,3M" dot="bg-violet-500" conv="↓ 34%" />
            <FunilStage nome="Contrato" n={2} vgv="R$ 395k" dot="bg-indigo-500" conv="↓ 41%" />
            <FunilStage nome="Ganho (mês)" n={7} vgv="R$ 2,1M" dot="bg-emerald-500" conv="↓ 78%" />
          </div>
        </Card>

        {/* ══ QUEM EXECUTA: performance por equipe ══ */}
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Performance por equipe</span>
            <span className="text-[11px] text-slate-400">ordenado por meta</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {[
              { nome: "Bruno Schuler", metaPct: 44, assinado: "R$ 1,8M", meta: "R$ 4,0M", neg: 2, saude: { em_dia: 470, atencao: 136, desatualizado: 26 } as Record<SaudeKey, number>, accent: "border-blue-200" },
              { nome: "Gabriel Vieira", metaPct: null, assinado: "R$ 0,3M", meta: null, neg: 11, saude: { em_dia: 380, atencao: 74, desatualizado: 11 } as Record<SaudeKey, number>, accent: "border-emerald-200" },
              { nome: "Junior Padilha", metaPct: null, assinado: "R$ 0", meta: null, neg: 5, saude: { em_dia: 180, atencao: 20, desatualizado: 2 } as Record<SaudeKey, number>, accent: "border-amber-200" },
            ].map((g) => (
              <div key={g.nome} className={`rounded-2xl border bg-white p-4 ${g.accent}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-slate-800">{g.nome}</span>
                  <span className="text-right"><b className="text-lg font-extrabold text-slate-800">{g.neg}</b><span className="ml-1 text-[10px] font-semibold uppercase text-slate-400">neg.</span></span>
                </div>
                {g.metaPct != null ? (
                  <>
                    <div className="mt-2 flex items-center justify-between text-[11px]"><span className="font-semibold text-slate-500">Meta {g.assinado}/{g.meta}</span><b className="text-slate-700">{g.metaPct}%</b></div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${g.metaPct}%` }} /></div>
                  </>
                ) : (
                  <button className="mt-2 text-[11px] font-semibold text-indigo-600 hover:underline">+ Configurar meta</button>
                )}
                <div className="mt-2.5"><HealthBar counts={g.saude} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ DETALHE: vendas assinadas + alertas comerciais ══ */}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Vendas assinadas no mês</span>
              <a className="text-[11px] font-semibold text-indigo-600">ver todas →</a>
            </div>
            <div className="divide-y divide-slate-100">
              {[["Carlos A. Filipini", "Lake Vitória", "R$ 6,2M", "Bruno"], ["Miguel Padilha", "Lake Eyre", "R$ 2,6M", "Gabriel"], ["Tassia", "Casa 94 Terra Matter", "R$ 1,3M", "Junior"]].map((v, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="min-w-0"><div className="truncate text-[13px] font-semibold text-slate-800">{v[0]}</div><div className="truncate text-[11px] text-slate-400">{v[1]} · {v[3]}</div></div>
                  <span className="shrink-0 text-[13px] font-extrabold text-emerald-600">{v[2]}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Alertas comerciais</span>
            </div>
            <div className="space-y-2">
              {[
                { t: "14 negócios desatualizados", d: "parados há +14 dias — R$ 4,1M em risco", cls: "text-red-600", ico: "bg-red-50" },
                { t: "3 propostas sem retorno", d: "enviadas há +9 dias, sem resposta", cls: "text-amber-600", ico: "bg-amber-50" },
                { t: "2 gerentes sem meta configurada", d: "Gabriel e Junior — sem baseline de acompanhamento", cls: "text-slate-600", ico: "bg-slate-100" },
              ].map((a) => (
                <button key={a.t} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 text-left hover:bg-slate-50">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${a.ico}`}><AlertTriangle className={`h-4 w-4 ${a.cls}`} /></div>
                  <div className="min-w-0 flex-1"><div className={`text-[13px] font-semibold ${a.cls}`}>{a.t}</div><div className="text-[11px] text-slate-400">{a.d}</div></div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
