// ─────────────────────────────────────────────────────────────────
// HeaderMockup — mockup ISOLADO do "header padrão" do Pipeline (Leads ↔ Negócios).
// Rota pública /header-mockup. NÃO é o header de produção — é só pra aprovar o visual.
// Tema claro fixo (regra do Lucas). Uma estrutura só, conteúdo segue a aba.
// ─────────────────────────────────────────────────────────────────
import { useState } from "react";
import {
  Search, SlidersHorizontal, ArrowUpDown, Sparkles, Plus, Trophy,
  Users, Inbox, Briefcase, ChevronDown, MoreHorizontal, X,
} from "lucide-react";

type Tab = "equipes" | "leads" | "negocios";

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: "equipes", label: "Equipes", icon: Users },
  { key: "leads", label: "Leads", icon: Inbox },
  { key: "negocios", label: "Negócios", icon: Briefcase },
];

// Chip de contexto que MUDA com a aba (fim do "1531 leads" na aba Negócios).
// Só números — sem "Escritório". Quando um gestor é filtrado, aqui entra o nome dele.
function contextoDaAba(tab: Tab): string {
  if (tab === "leads") return "1.531 leads";
  if (tab === "negocios") return "112 negócios · R$ 55,8 mi";
  return "8 gestores · 47 corretores";
}

// Pílula de sinal. Vira BOTÃO clicável (filtro rápido) quando recebe onClick —
// mesmo padrão que já existe hoje nas pílulas de saúde do Leads.
function Pill({ tone, active, onClick, children }: { tone: "green" | "amber" | "red" | "slate"; active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  const map = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
    red: "bg-red-50 text-red-700 ring-red-600/20",
    slate: "bg-slate-100 text-slate-600 ring-slate-500/15",
  }[tone];
  const base = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset ${map}`;
  if (!onClick) return <span className={base}>{children}</span>;
  return (
    <button
      onClick={onClick}
      className={`${base} cursor-pointer transition-all hover:brightness-95 ${active ? "ring-2 ring-offset-1 ring-offset-white" : ""}`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function Dot({ cls }: { cls: string }) {
  return <span className={`h-2 w-2 rounded-full ${cls}`} />;
}

// Faixa de sinal — segue a aba. Mesmo "chrome", dado diferente. Pílulas clicáveis = filtro rápido.
function SignalStrip({ tab, active, onToggle }: { tab: Tab; active: Set<string>; onToggle: (id: string, label: string) => void }) {
  if (tab === "negocios") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="slate" active={active.has("passo:pos_visita")} onClick={() => onToggle("passo:pos_visita", "Pós-Visita")}><Dot cls="bg-cyan-500" /> Pós-Visita <b className="font-bold">90</b></Pill>
        <Pill tone="slate" active={active.has("passo:proposta")} onClick={() => onToggle("passo:proposta", "Proposta")}><Dot cls="bg-violet-500" /> Proposta <b className="font-bold">15</b> · R$ 16 mi</Pill>
        <Pill tone="slate" active={active.has("passo:contrato")} onClick={() => onToggle("passo:contrato", "Contrato")}><Dot cls="bg-indigo-500" /> Contrato <b className="font-bold">2</b> · R$ 395 mil</Pill>
        <Pill tone="green" active={active.has("passo:ganho")} onClick={() => onToggle("passo:ganho", "Ganho")}><Trophy className="h-3.5 w-3.5" /> Ganho <b className="font-bold">96</b> · R$ 55 mi</Pill>
      </div>
    );
  }
  if (tab === "equipes") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="green" active={active.has("time:ritmo")} onClick={() => onToggle("time:ritmo", "No ritmo")}>● 5 no ritmo</Pill>
        <Pill tone="amber" active={active.has("time:atencao")} onClick={() => onToggle("time:atencao", "Atenção")}>● 2 atenção</Pill>
        <Pill tone="red" active={active.has("time:travado")} onClick={() => onToggle("time:travado", "Travado")}>● 1 travado</Pill>
      </div>
    );
  }
  // leads
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill tone="green" active={active.has("saude:em_dia")} onClick={() => onToggle("saude:em_dia", "Em dia")}>● 1.200 em dia</Pill>
      <Pill tone="amber" active={active.has("saude:atencao")} onClick={() => onToggle("saude:atencao", "Atenção")}>● 240 atenção</Pill>
      <Pill tone="red" active={active.has("saude:desatualizado")} onClick={() => onToggle("saude:desatualizado", "Desatualizado")}>● 91 desatualizado</Pill>
    </div>
  );
}

// Ação primária muda por aba (Leads/Negócios = Novo lead + Foco; Equipes = neutro).
function AcaoPrimaria({ tab }: { tab: Tab }) {
  if (tab === "equipes") return null;
  return (
    <div className="flex items-center gap-2">
      <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 h-9 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
        <Sparkles className="h-4 w-4 text-indigo-500" /> Foco
      </button>
      <button className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 h-9 text-[13px] font-semibold text-white hover:bg-indigo-700">
        <Plus className="h-4 w-4" /> Novo lead
      </button>
    </div>
  );
}

function ToolButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 h-9 text-[13px] font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap">
      {children}
    </button>
  );
}

function StandardHeader() {
  const [tab, setTab] = useState<Tab>("negocios");
  const [toolsOpen, setToolsOpen] = useState(true);
  // Filtros ativos (chips). Começa com 1 de exemplo; pílulas de sinal ligam/desligam mais.
  const [filtros, setFiltros] = useState<{ id: string; label: string }[]>([{ id: "corretor:anderson", label: "Corretor: Anderson" }]);
  const activeIds = new Set(filtros.map((f) => f.id));
  const toggleFiltro = (id: string, label: string) =>
    setFiltros((f) => (f.some((x) => x.id === id) ? f.filter((x) => x.id !== id) : [...f, { id, label }]));
  const removeFiltro = (id: string) => setFiltros((f) => f.filter((x) => x.id !== id));
  const activeFiltros = filtros.length;
  return (
    <div className="w-full bg-white">
      {/* ══ ZONA 1 — Identidade + ação primária (uma linha, alinhada) ══ */}
      <div className="flex h-14 items-center gap-4 px-5">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <span className="text-[16px] font-extrabold tracking-tight text-slate-900">Pipeline</span>
          <span className="hidden truncate text-[12.5px] font-medium text-slate-400 sm:inline">
            {contextoDaAba(tab)}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Ganhos = MÉTRICA (quieta), não botão — separada das ações */}
          <div className="hidden items-center gap-1.5 text-[13px] font-semibold text-emerald-600 md:flex">
            <Trophy className="h-4 w-4" /> 96 · R$ 55 mi
          </div>
          <div className="hidden h-5 w-px bg-slate-200 md:block" />
          {tab !== "equipes" && (
            <>
              <button className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 h-9 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex">
                <Sparkles className="h-4 w-4 text-indigo-500" /> Foco
              </button>
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 h-9 text-[13px] font-semibold text-white hover:bg-indigo-700">
                <Plus className="h-4 w-4" /> Novo lead
              </button>
            </>
          )}
        </div>
      </div>

      {/* ══ ZONA 2 — Navegação (abas) à esquerda + Sinal à direita, mesma linha ══ */}
      <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 px-5 py-2.5">
        {/* Segmented control — SEMPRE com texto (nunca ícone críptico) */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 h-8 text-[13px] font-semibold transition-colors ${
                  active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <SignalStrip tab={tab} active={activeIds} onToggle={toggleFiltro} />
          <div className="h-5 w-px bg-slate-200" />
          {/* Toggle da 3ª linha — aberto: chevron discreto de ocultar; fechado: "Filtros · N" */}
          {toolsOpen ? (
            <button
              onClick={() => setToolsOpen(false)}
              aria-label="Ocultar busca e filtros"
              title="Ocultar busca e filtros"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white h-9 w-9 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
              <ChevronDown className="h-4 w-4 rotate-180" />
            </button>
          ) : (
            <button
              onClick={() => setToolsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 h-9 text-[13px] font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filtros</span>
              {activeFiltros > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">{activeFiltros}</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ══ CHIPS DE FILTRO ATIVO — sempre visível quando há filtro (mesmo com a linha colapsada) ══ */}
      {filtros.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-2">
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Filtros ativos</span>
          {filtros.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[12px] font-medium text-slate-600">
              {f.label}
              <button onClick={() => removeFiltro(f.id)} aria-label={`Remover ${f.label}`} className="ml-0.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button onClick={() => setFiltros([])} className="ml-1 text-[12px] font-semibold text-slate-500 hover:text-slate-700">Limpar tudo</button>
        </div>
      )}

      {/* ══ ZONA 3 — Ferramentas (busca + filtros + ações de lista) · colapsável ══ */}
      {toolsOpen && (
      <div className="flex min-h-12 flex-wrap items-center gap-2.5 border-t border-slate-100 px-5 py-2.5">
        <div className="relative min-w-[200px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            placeholder="Buscar lead, cliente, empreendimento…"
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 h-9 text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
        {/* Filtros primários — no tablet/mobile colapsam no botão "Filtros" */}
        <div className="hidden lg:flex items-center gap-2.5">
          <ToolButton>Corretores <ChevronDown className="h-3.5 w-3.5 text-slate-400" /></ToolButton>
          <ToolButton>Gestores <ChevronDown className="h-3.5 w-3.5 text-slate-400" /></ToolButton>
        </div>
        <ToolButton><SlidersHorizontal className="h-4 w-4" /> Filtros</ToolButton>
        <div className="ml-auto flex items-center gap-2.5">
          <ToolButton><ArrowUpDown className="h-4 w-4" /> <span className="hidden sm:inline">Prioridade</span></ToolButton>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 h-9 text-[13px] font-semibold text-indigo-700 hover:bg-indigo-100">
            <Sparkles className="h-4 w-4" /> HOMI
          </button>
          <button aria-label="Mais ações" className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white h-9 w-9 text-slate-500 hover:bg-slate-50">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

export default function HeaderMockup() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-[20px] font-extrabold text-slate-900">Header padrão — mockup v2</h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Três zonas alinhadas, com respiro (divisória fina). Clique nas abas <b>Equipes / Leads / Negócios</b> pra ver
          contexto e sinal mudarem. <b>Clique nas pílulas de sinal</b> (ex.: "Contrato · 2") pra filtrar o board — vira
          um chip de filtro ativo removível. Use o chevron na direita pra <b>colapsar a linha de ferramentas</b>.
          Redimensione pra ver o responsivo.
        </p>

        {/* Moldura "app" com sidebar fake pra dar a sensação real */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <StandardHeader />
          {/* Corpo fake do board só pra contextualizar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 bg-slate-50 p-4">
            {["Pós-Visita", "Documentação", "Proposta", "Contrato", "Ganho"].map((c) => (
              <div key={c} className="rounded-xl bg-slate-100/70 p-2">
                <div className="mb-2 px-1 text-[12px] font-bold text-slate-500">{c}</div>
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="rounded-lg border border-slate-200 bg-white p-2.5">
                      <div className="h-2 w-16 rounded bg-slate-200" />
                      <div className="mt-2 h-2.5 w-24 rounded bg-slate-300" />
                      <div className="mt-1.5 h-2 w-14 rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legenda das decisões */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { t: "Alinhado por zona, com respiro", d: "3 zonas separadas por divisória fina, cada linha com altura fixa e tudo centralizado. Sem elementos \"colados\": Ganhos vira métrica quieta, separada das ações por um divisor." },
            { t: "Sinal clicável + chips de filtro", d: "Clicar numa pílula de sinal filtra o board (mesmo padrão que já existe no Leads) e vira um chip removível em \"Filtros ativos\". Dá pra colapsar a linha de ferramentas — os chips continuam visíveis." },
            { t: "Contexto + sinal seguem a aba", d: "O chip ao lado de \"Pipeline\" e a faixa de sinal mudam por aba: leads/saúde em Leads; negócios+VGV/passos em Negócios; time/ritmo em Equipes." },
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
