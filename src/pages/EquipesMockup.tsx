// ─────────────────────────────────────────────────────────────────
// EquipesMockup — mockup ISOLADO da tela Equipes no FORMATO NOVO (nova gestão).
// Rota pública /equipes-mockup. NÃO é produção — é pra aprovar o visual.
// Tema claro fixo. Vocabulário do lead: Atenção · Desatualizados · Estagnados · Negócios.
// ─────────────────────────────────────────────────────────────────
import { AlertTriangle, Clock, Snowflake, Handshake, ChevronDown, TrendingUp, Users } from "lucide-react";

// KPI do escritório — foco em SAÚDE + negócios (mesma vocabulária do lead).
function Kpi({ icon, label, value, tone, ring }: { icon: React.ReactNode; label: string; value: string; tone: string; ring: string }) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${ring}`}>
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>{icon}</div>
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-extrabold text-slate-800">{value}</div>
    </div>
  );
}

function MiniMetric({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="text-center">
      <div className={`text-lg font-extrabold ${cls}`}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

function GestorCard({ nome, corretores, leads, accent, meta, atencao, desatualizado, estagnado, negocios, pipeline }: {
  nome: string; corretores: number; leads: number; accent: string; meta: number | null;
  atencao: number; desatualizado: number; estagnado: number; negocios: number; pipeline: string;
}) {
  const iniciais = nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className={`rounded-2xl border bg-white p-4 ${accent}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-[13px] font-bold text-slate-600">{iniciais}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-slate-800">{nome}</div>
          <div className="text-[11.5px] text-slate-400">{corretores} corretores · {leads.toLocaleString("pt-BR")} leads</div>
        </div>
        <ChevronDown className="h-4 w-4 text-slate-300" />
      </div>

      {/* Meta do mês */}
      <div className="mt-3">
        {meta != null ? (
          <>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-500">Meta do mês</span>
              <span className="font-bold text-slate-700">{meta}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${meta}%` }} />
            </div>
          </>
        ) : (
          <button className="text-[11px] font-semibold text-indigo-600 hover:underline">+ Configurar meta do mês</button>
        )}
        <div className="mt-1 text-[11px] text-slate-400">Pipeline ativo: <b className="text-slate-600">{pipeline}</b></div>
      </div>

      {/* KPIs por SAÚDE + negócios */}
      <div className="mt-3 grid grid-cols-4 gap-1 border-t border-slate-100 pt-3">
        <MiniMetric label="Atenção" value={String(atencao)} cls="text-amber-600" />
        <MiniMetric label="Desatual." value={String(desatualizado)} cls="text-red-600" />
        <MiniMetric label="Estagn." value={String(estagnado)} cls="text-violet-600" />
        <MiniMetric label="Negócios" value={String(negocios)} cls="text-emerald-600" />
      </div>
    </div>
  );
}

export default function EquipesMockup() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-[20px] font-extrabold">Tela Equipes — formato novo (mockup)</h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Mesma vocabulária do lead: <b>Atenção · Desatualizados · Estagnados · Negócios</b> (some "Atrasadas" e "Em fechamento").
          Leads totais e VGV viram linha de contexto. Cada gerente mostra a saúde do time dele + negócios.
        </p>

        {/* Linha de contexto (números que saíram dos KPIs) */}
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700"><Users className="h-4 w-4 text-slate-400" /> 1.696 leads ativos</span>
          <span className="inline-flex items-center gap-1.5 text-slate-500"><TrendingUp className="h-4 w-4 text-slate-400" /> Pipeline ativo R$ 16,6M</span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600"><Handshake className="h-4 w-4" /> Ganho no mês R$ 2,1M</span>
        </div>

        {/* KPIs — SAÚDE + negócios */}
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} tone="bg-amber-50" ring="border-amber-200" label="Atenção" value="253" />
          <Kpi icon={<Clock className="h-4 w-4 text-red-600" />} tone="bg-red-50" ring="border-red-200" label="Desatualizados" value="103" />
          <Kpi icon={<Snowflake className="h-4 w-4 text-violet-600" />} tone="bg-violet-50" ring="border-violet-200" label="Estagnados" value="41" />
          <Kpi icon={<Handshake className="h-4 w-4 text-emerald-600" />} tone="bg-emerald-50" ring="border-emerald-200" label="Negócios" value="17" />
        </div>

        {/* Cards dos gerentes — formato novo */}
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <GestorCard nome="Bruno Schuler" corretores={15} leads={803} accent="border-blue-200" meta={44} pipeline="R$ 375k" atencao={110} desatualizado={62} estagnado={18} negocios={1} />
          <GestorCard nome="Gabriel Vieira" corretores={8} leads={630} accent="border-emerald-200" meta={null} pipeline="R$ 7,0M" atencao={88} desatualizado={31} estagnado={12} negocios={11} />
          <GestorCard nome="Junior Padilha" corretores={4} leads={263} accent="border-amber-200" meta={null} pipeline="R$ 9,2M" atencao={55} desatualizado={19} estagnado={9} negocios={5} />
        </div>

        {/* Legenda das decisões */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { t: "Fala a língua do lead", d: "Atenção (âmbar) · Desatualizados (vermelho) · Estagnados (violeta) — os mesmos da saúde do corretor. Fim de \"Atrasadas\" e \"Em fechamento\"." },
            { t: "Negócios no lugar de fechamento", d: "\"Em fechamento\" vira \"Negócios\" — o número real de negócios em andamento, coerente com a aba Negócios." },
            { t: "Contexto sem poluir", d: "Leads totais e VGV viram uma linha de contexto no topo, em vez de 2 cards competindo com a saúde." },
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
