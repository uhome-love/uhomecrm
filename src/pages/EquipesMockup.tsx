// ─────────────────────────────────────────────────────────────────
// EquipesMockup — mockup ISOLADO da tela Equipes (formato novo). Rota /equipes-mockup.
// v3 ENXUTA: hierarquia — sucesso (em dia) como contexto/barra, problemas acionáveis
// em destaque, Negócios como métrica-herói. Tema claro fixo. NÃO é produção.
// ─────────────────────────────────────────────────────────────────
import { Handshake, ChevronDown, TrendingUp, Users, ArrowRight } from "lucide-react";

const SAUDE = {
  em_dia: { label: "em dia", bar: "bg-emerald-500", dot: "bg-emerald-500", text: "text-emerald-600", goes: "leads em dia" },
  atencao: { label: "atenção", bar: "bg-amber-500", dot: "bg-amber-500", text: "text-amber-600", goes: "filtra atenção" },
  desatualizado: { label: "desatualizado", bar: "bg-red-500", dot: "bg-red-500", text: "text-red-600", goes: "filtra desatualizado" },
  estagnado: { label: "estagnado", bar: "bg-violet-500", dot: "bg-violet-500", text: "text-violet-600", goes: "abre estagnados" },
} as const;
type SaudeKey = keyof typeof SAUDE;
const ORDER: SaudeKey[] = ["em_dia", "atencao", "desatualizado", "estagnado"];

// Barra de saúde proporcional (um olhar = time verde ou com problema).
function HealthBar({ counts, h = "h-2" }: { counts: Record<SaudeKey, number>; h?: string }) {
  const total = ORDER.reduce((s, k) => s + counts[k], 0) || 1;
  return (
    <div className={`flex ${h} w-full overflow-hidden rounded-full bg-slate-100`}>
      {ORDER.map((k) => {
        const pct = (counts[k] / total) * 100;
        return pct > 0 ? <div key={k} className={SAUDE[k].bar} style={{ width: `${pct}%` }} title={`${counts[k]} ${SAUDE[k].label}`} /> : null;
      })}
    </div>
  );
}

// Número de saúde clicável (leve — o sucesso não grita igual ao problema).
function SaudeStat({ k, n, big }: { k: SaudeKey; n: number; big?: boolean }) {
  const s = SAUDE[k];
  return (
    <button className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-slate-50" title={`→ ${s.goes}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      <span className={`${big ? "text-[15px]" : "text-[13px]"} font-bold ${s.text}`}>{n.toLocaleString("pt-BR")}</span>
      <span className="text-[11px] text-slate-400">{s.label}</span>
    </button>
  );
}

function GestorCard({ nome, corretores, leads, accent, meta, counts, negocios, pipeline }: {
  nome: string; corretores: number; leads: number; accent: string; meta: number | null;
  counts: Record<SaudeKey, number>; negocios: number; pipeline: string;
}) {
  const iniciais = nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const emDiaPct = Math.round((counts.em_dia / (ORDER.reduce((s, k) => s + counts[k], 0) || 1)) * 100);
  const precisaAcao = counts.atencao + counts.desatualizado + counts.estagnado;
  return (
    <div className={`rounded-2xl border bg-white p-4 ${accent}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-[13px] font-bold text-slate-600">{iniciais}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-slate-800">{nome}</div>
          <div className="text-[11.5px] text-slate-400">{corretores} corretores · {leads.toLocaleString("pt-BR")} leads</div>
        </div>
        {/* Negócios = métrica-herói do gerente */}
        <div className="text-right">
          <div className="text-xl font-extrabold text-slate-800">{negocios}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">negócios</div>
        </div>
      </div>

      {/* Meta */}
      <div className="mt-3">
        {meta != null ? (
          <>
            <div className="flex items-center justify-between text-[11px]"><span className="font-semibold text-slate-500">Meta do mês</span><span className="font-bold text-slate-700">{meta}%</span></div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${meta}%` }} /></div>
          </>
        ) : (
          <button className="text-[11px] font-semibold text-indigo-600 hover:underline">+ Configurar meta do mês</button>
        )}
        <div className="mt-1 text-[11px] text-slate-400">Pipeline ativo: <b className="text-slate-600">{pipeline}</b></div>
      </div>

      {/* Saúde do time — barra proporcional + resumo (sucesso leve, ação em destaque) */}
      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-emerald-600">{emDiaPct}% em dia</span>
          <span className="font-semibold text-slate-500">{precisaAcao} precisam ação</span>
        </div>
        <div className="mt-1.5"><HealthBar counts={counts} /></div>
        {/* Detalhe fino — leve, disponível sem gritar */}
        <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px]">
          <SaudeStat k="atencao" n={counts.atencao} />
          <SaudeStat k="desatualizado" n={counts.desatualizado} />
          <SaudeStat k="estagnado" n={counts.estagnado} />
        </div>
      </div>
    </div>
  );
}

export default function EquipesMockup() {
  const esc: Record<SaudeKey, number> = { em_dia: 1171, atencao: 253, desatualizado: 103, estagnado: 41 };
  const escTotal = ORDER.reduce((s, k) => s + esc[k], 0);
  const emDiaPct = Math.round((esc.em_dia / escTotal) * 100);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-[20px] font-extrabold">Tela Equipes — formato novo · v3 enxuta</h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Mesma info, com <b>hierarquia</b>: o sucesso ("em dia") vira barra/percentual de contexto; os problemas
          acionáveis (atenção/desatualizado/estagnado) e <b>Negócios</b> ficam em destaque. Números são clicáveis
          (filtram os leads na pílula / abrem a aba). Menos ruído, foco no que o CEO faz.
        </p>

        {/* Contexto */}
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700"><Users className="h-4 w-4 text-slate-400" /> 1.696 leads ativos</span>
          <span className="inline-flex items-center gap-1.5 text-slate-500"><TrendingUp className="h-4 w-4 text-slate-400" /> Pipeline ativo R$ 16,6M</span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600"><Handshake className="h-4 w-4" /> Ganho no mês R$ 2,1M</span>
        </div>

        {/* Topo: Saúde do escritório (herói) + Negócios */}
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Saúde do pipeline</span>
              <span className="text-[12px] text-slate-400">{escTotal.toLocaleString("pt-BR")} leads no funil</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-600">{emDiaPct}%</span>
              <span className="text-[13px] font-semibold text-slate-500">em dia</span>
            </div>
            <div className="mt-2"><HealthBar counts={esc} h="h-2.5" /></div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <SaudeStat k="em_dia" n={esc.em_dia} big />
              <SaudeStat k="atencao" n={esc.atencao} big />
              <SaudeStat k="desatualizado" n={esc.desatualizado} big />
              <SaudeStat k="estagnado" n={esc.estagnado} big />
            </div>
          </div>

          <button className="group text-left rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100"><Handshake className="h-4 w-4 text-slate-600" /></div>
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Negócios</span>
              <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-800">17</span>
              <span className="text-[13px] font-semibold text-emerald-600">R$ 2,1M</span>
            </div>
            <div className="text-[11px] text-slate-400">→ abre a aba Negócios</div>
          </button>
        </div>

        {/* Gerentes */}
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <GestorCard nome="Bruno Schuler" corretores={15} leads={803} accent="border-blue-200" meta={44} pipeline="R$ 375k" negocios={1} counts={{ em_dia: 612, atencao: 110, desatualizado: 62, estagnado: 18 }} />
          <GestorCard nome="Gabriel Vieira" corretores={8} leads={630} accent="border-emerald-200" meta={null} pipeline="R$ 7,0M" negocios={11} counts={{ em_dia: 499, atencao: 88, desatualizado: 31, estagnado: 12 }} />
          <GestorCard nome="Junior Padilha" corretores={4} leads={263} accent="border-amber-200" meta={null} pipeline="R$ 9,2M" negocios={5} counts={{ em_dia: 180, atencao: 55, desatualizado: 19, estagnado: 9 }} />
        </div>

        {/* O que mudou vs a densa */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { t: "Sucesso vira contexto", d: "\"Em dia\" deixa de ser um card do mesmo tamanho do problema — vira o percentual/barra de saúde. Celebra sem competir com o acionável." },
            { t: "Negócios é o herói", d: "No topo e em cada gerente, Negócios ganha destaque (é o que fecha venda), em vez de virar mais um número igual aos outros." },
            { t: "Detalhe leve, não parede", d: "Barra proporcional dá o panorama num olhar; os números finos (atenção/desatual/estagn) ficam pequenos e clicáveis, sem gritar." },
          ].map((c) => (
            <div key={c.t} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-[13px] font-bold text-slate-800">{c.t}</div>
              <div className="mt-1 text-[12px] leading-relaxed text-slate-500">{c.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
