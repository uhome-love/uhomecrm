/**
 * FocusConfigScreen — Sprint 1 Rodada 1
 *
 * Tela de configuração do Modo Foco com:
 *  - Saudação personalizada (firstName via useAuthUser)
 *  - 3 contadores no topo (Atrasadas / Hoje / Sem direção)
 *  - 4 critérios em grid 2x2 com badges de contagem
 *  - Toggle "incluir próximos 2 dias" refinado
 *  - Filtro de etapa
 *  - CTA "Iniciar Modo Foco" com gradient-focus
 *
 * Tokens semânticos (sem hardcode):
 *   --gradient-focus, --gradient-focus-soft, --font-focus-display
 *
 * Lógica é responsabilidade do parent — este é puro presentational.
 */
import { motion } from "framer-motion";
import { Loader2, Zap, Filter, ListChecks, CalendarClock, Clock, Inbox, Target, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthUser } from "@/hooks/useAuthUser";
import type { FocusCriteria, FocusLead, FocusState } from "@/hooks/useFocusLeads";
import { FOCUS_LEVELS } from "@/hooks/useFocusLeads";

interface Stage {
  id: string;
  nome: string;
  tipo: string;
}

interface FocusConfigScreenProps {
  /** Leads pré-carregados com criteria=["all"] + includeUpcoming2d=true para contagens reais. */
  allLeads: FocusLead[];
  countsLoading: boolean;
  stages: Stage[];
  stagesLoading: boolean;
  selectedCriteria: FocusCriteria[];
  includeUpcoming: boolean;
  selectedStageId: string;
  pipelineTipo: "leads" | "negocios";
  onToggleCriteria: (value: FocusCriteria) => void;
  onToggleIncludeUpcoming: () => void;
  onSelectStage: (id: string) => void;
  onStart: () => void;
}

interface CriteriaOption {
  value: FocusCriteria;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string; // hsl token reference for left chip
  bgVar: string;  // background tint
  borderVar: string;
}

const CRITERIA_OPTIONS: CriteriaOption[] = [
  {
    value: "all",
    label: "Tudo que precisa de atenção",
    description: "Atrasados + tarefas de hoje + sem próximo passo",
    icon: <Target className="w-4 h-4" />,
    accent: "hsl(var(--primary-500))",
    bgVar: "hsl(var(--primary-500) / 0.10)",
    borderVar: "hsl(var(--primary-500) / 0.45)",
  },
  {
    value: "overdue_tasks",
    label: "Tarefas atrasadas",
    description: "Vencidas por data ou hora (BRT)",
    icon: <CalendarClock className="w-4 h-4" />,
    accent: "hsl(var(--danger-500))",
    bgVar: "hsl(var(--danger-500) / 0.10)",
    borderVar: "hsl(var(--danger-500) / 0.45)",
  },
  {
    value: "today",
    label: "Para hoje",
    description: "Tarefas com vencimento hoje, ainda não vencidas",
    icon: <Clock className="w-4 h-4" />,
    accent: "hsl(var(--warning-500))",
    bgVar: "hsl(var(--warning-500) / 0.10)",
    borderVar: "hsl(var(--warning-500) / 0.45)",
  },
  {
    value: "no_next_step",
    label: "Sem próximo passo",
    description: `Zero tarefa pendente. 🟡 1–4d · 🟠 5–9d · 🔴 ${FOCUS_LEVELS.critical}+d`,
    icon: <Inbox className="w-4 h-4" />,
    accent: "hsl(38 92% 50%)",
    bgVar: "hsl(38 92% 50% / 0.10)",
    borderVar: "hsl(38 92% 50% / 0.45)",
  },
];

// R4.1 — "Todos": filosofia diferente (ignora régua, mostra universo completo).
// Renderizado separado para sinalizar visualmente que é uma opção paralela.
const EVERY_OPTION: CriteriaOption = {
  value: "every",
  label: "Todos",
  description: "Todos os leads ativos, ordenados pela régua de saúde",
  icon: <Users className="w-4 h-4" />,
  accent: "hsl(var(--primary))",
  bgVar: "hsl(var(--primary) / 0.08)",
  borderVar: "hsl(var(--primary) / 0.35)",
};


function getGreeting(): string {
  const hour = parseInt(
    new Date().toLocaleTimeString("en-GB", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }),
    10
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function countByState(leads: FocusLead[]): Record<FocusState, number> {
  const acc: Record<FocusState, number> = {
    atrasado: 0,
    para_hoje: 0,
    em_dia_proximo: 0,
    sem_direcao: 0,
  };
  for (const l of leads) acc[l.state] += 1;
  return acc;
}

export default function FocusConfigScreen({
  allLeads,
  countsLoading,
  stages,
  stagesLoading,
  selectedCriteria,
  includeUpcoming,
  selectedStageId,
  pipelineTipo,
  onToggleCriteria,
  onToggleIncludeUpcoming,
  onSelectStage,
  onStart,
}: FocusConfigScreenProps) {
  const { profile } = useAuthUser();
  const firstName = profile?.nome?.trim().split(/\s+/)[0] || "corretor";
  const counts = countByState(allLeads);
  const semDirecao = counts.sem_direcao;

  const totalLeads = allLeads.length;
  const isEvery = selectedCriteria.includes("every");

  // Badge per critério
  const badgeFor = (v: FocusCriteria): number => {
    if (v === "every") return totalLeads;
    if (v === "all") return counts.atrasado + counts.para_hoje + counts.sem_direcao + (includeUpcoming ? counts.em_dia_proximo : 0);
    if (v === "overdue_tasks") return counts.atrasado;
    if (v === "today") return counts.para_hoje;
    return semDirecao;
  };

  const totalSelected = isEvery
    ? totalLeads
    : selectedCriteria.includes("all")
      ? badgeFor("all")
      : selectedCriteria.reduce((sum, c) => sum + badgeFor(c), 0);


  return (
    <div className="flex flex-col items-center justify-start pt-6 sm:pt-10 min-h-full px-4 py-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-xl space-y-5"
      >
        {/* Greeting */}
        <div className="text-center space-y-2">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-lg"
            style={{ background: "var(--gradient-focus)", boxShadow: "0 12px 32px -10px hsl(var(--primary-500) / 0.45)" }}
          >
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h2
            className="text-white text-2xl sm:text-3xl leading-tight"
            style={{ fontFamily: "var(--font-focus-display)", fontWeight: 600, letterSpacing: "-0.01em" }}
          >
            {getGreeting()}, {firstName}.
          </h2>
          <p className="text-slate-400 text-sm">No que você quer focar agora?</p>
        </div>

        {/* 4 Counters topo (R4.1: +Todos) */}
        <div className="grid grid-cols-4 gap-2">
          <CounterCard
            label="Atrasadas"
            value={counts.atrasado}
            color="hsl(var(--danger-500))"
            loading={countsLoading}
          />
          <CounterCard
            label="Hoje"
            value={counts.para_hoje}
            color="hsl(var(--warning-500))"
            loading={countsLoading}
          />
          <CounterCard
            label="Sem direção"
            value={semDirecao}
            color="hsl(38 92% 50%)"
            loading={countsLoading}
          />
          <CounterCard
            label="Todos"
            value={totalLeads}
            color="hsl(var(--primary))"
            loading={countsLoading}
          />
        </div>


        {/* Criteria 2x2 */}
        <div className="space-y-2">
          <label className="text-slate-300 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5" /> Critérios
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CRITERIA_OPTIONS.map((opt) => {
              const isSelected = selectedCriteria.includes(opt.value);
              const badge = badgeFor(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => onToggleCriteria(opt.value)}
                  className="group flex items-start gap-3 p-3 rounded-xl text-left transition-all hover:brightness-125"
                  style={{
                    background: isSelected ? opt.bgVar : "hsl(0 0% 100% / 0.03)",
                    border: `1.5px solid ${isSelected ? opt.borderVar : "hsl(0 0% 100% / 0.06)"}`,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                    style={{
                      background: isSelected ? `${opt.accent.replace(")", " / 0.18)")}` : "hsl(0 0% 100% / 0.05)",
                      color: isSelected ? opt.accent : "hsl(var(--neutral-500))",
                    }}
                  >
                    {opt.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: isSelected ? "#fff" : "hsl(var(--neutral-400))" }}
                      >
                        {opt.label}
                      </span>
                      {!countsLoading && badge > 0 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-md font-bold shrink-0"
                          style={{
                            background: isSelected ? `${opt.accent.replace(")", " / 0.25)")}` : "hsl(0 0% 100% / 0.08)",
                            color: isSelected ? opt.accent : "hsl(var(--neutral-400))",
                            fontFamily: "var(--font-focus-mono)",
                          }}
                        >
                          {badge}
                        </span>
                      )}
                    </div>
                    <span
                      className="text-[10.5px] leading-tight block mt-1"
                      style={{ color: isSelected ? "hsl(var(--neutral-400))" : "hsl(var(--neutral-500))" }}
                    >
                      {opt.description}
                    </span>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 shrink-0 mt-1" style={{ color: opt.accent }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* R4.1 — "Todos": filosofia paralela, separado por divider sutil */}
          <div className="mt-3 pt-3 border-t border-white/[0.05]">
            {(() => {
              const opt = EVERY_OPTION;
              const isSelected = isEvery;
              const badge = badgeFor(opt.value);
              return (
                <button
                  onClick={() => onToggleCriteria(opt.value)}
                  className="w-full group flex items-start gap-3 p-3 rounded-xl text-left transition-all hover:brightness-125"
                  style={{
                    background: isSelected ? opt.bgVar : "hsl(0 0% 100% / 0.03)",
                    border: `1.5px solid ${isSelected ? opt.borderVar : "hsl(0 0% 100% / 0.06)"}`,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                    style={{
                      background: isSelected ? `${opt.accent.replace(")", " / 0.18)")}` : "hsl(0 0% 100% / 0.05)",
                      color: isSelected ? opt.accent : "hsl(var(--neutral-500))",
                    }}
                  >
                    {opt.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: isSelected ? "#fff" : "hsl(var(--neutral-400))" }}
                      >
                        {opt.label}
                      </span>
                      {!countsLoading && badge > 0 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-md font-bold shrink-0"
                          style={{
                            background: isSelected ? `${opt.accent.replace(")", " / 0.25)")}` : "hsl(0 0% 100% / 0.08)",
                            color: isSelected ? opt.accent : "hsl(var(--neutral-400))",
                            fontFamily: "var(--font-focus-mono)",
                          }}
                        >
                          {badge}
                        </span>
                      )}
                    </div>
                    <span
                      className="text-[10.5px] leading-tight block mt-1"
                      style={{ color: isSelected ? "hsl(var(--neutral-400))" : "hsl(var(--neutral-500))" }}
                    >
                      {opt.description}
                    </span>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 shrink-0 mt-1" style={{ color: opt.accent }} />
                  )}
                </button>
              );
            })()}
          </div>
        </div>

        {/* Toggle próx 2d — oculto quando "Todos" ativo (R4.1) */}
        {!isEvery && (
          <button
            type="button"
            onClick={onToggleIncludeUpcoming}
            className="w-full flex items-center justify-between gap-3 p-3 rounded-xl transition-all text-left"
            style={{
              background: includeUpcoming ? "var(--gradient-focus-soft)" : "hsl(0 0% 100% / 0.03)",
              border: `1.5px solid ${includeUpcoming ? "hsl(var(--primary-500) / 0.45)" : "hsl(0 0% 100% / 0.06)"}`,
            }}
          >
            <div className="min-w-0">
              <span
                className="text-sm font-semibold block"
                style={{ color: includeUpcoming ? "#fff" : "hsl(var(--neutral-400))" }}
              >
                Incluir próximos 2 dias
              </span>
              <span className="text-[10.5px] leading-tight block mt-0.5" style={{ color: "hsl(var(--neutral-500))" }}>
                No filtro "Tudo", inclui leads com tarefa amanhã ou depois de amanhã
              </span>
            </div>
            <div
              className="shrink-0 w-10 h-6 rounded-full transition-all relative"
              style={{ background: includeUpcoming ? "var(--gradient-focus)" : "hsl(0 0% 100% / 0.12)" }}
            >
              <div
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow"
                style={{ left: includeUpcoming ? "calc(100% - 22px)" : "2px" }}
              />
            </div>
          </button>
        )}


        {/* Stage filter */}
        <div className="space-y-2">
          <label className="text-slate-300 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Filtrar por etapa
          </label>
          <Select value={selectedStageId} onValueChange={onSelectStage}>
            <SelectTrigger
              className="h-10 text-sm border-0 rounded-xl"
              style={{ background: "hsl(0 0% 100% / 0.06)", color: "hsl(var(--neutral-200))" }}
            >
              <SelectValue placeholder="Todas as etapas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pipelineTipo === "leads" && (
            <p className="text-[10px] mt-1" style={{ color: "hsl(var(--neutral-500))" }}>
              Negócios em andamento aparecem em{" "}
              <span style={{ color: "hsl(var(--neutral-300))" }}>Meus Negócios → Modo Foco</span>.
            </p>
          )}
        </div>

        {/* CTA */}
        <Button
          onClick={onStart}
          disabled={stagesLoading || totalSelected === 0}
          className="w-full h-12 text-sm font-bold gap-2 rounded-xl text-white border-0 shadow-lg hover:brightness-110 disabled:opacity-50"
          style={{
            background: "var(--gradient-focus)",
            boxShadow: "0 12px 32px -10px hsl(var(--primary-500) / 0.55)",
          }}
        >
          {stagesLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Iniciar Modo Foco
              {!countsLoading && totalSelected > 0 && (
                <span
                  className="ml-1 text-[11px] px-2 py-0.5 rounded-md bg-white/20"
                  style={{ fontFamily: "var(--font-focus-mono)" }}
                >
                  {totalSelected}
                </span>
              )}
            </>
          )}
        </Button>
      </motion.div>
    </div>
  );
}

interface CounterCardProps {
  label: string;
  value: number;
  color: string;
  loading: boolean;
}

function CounterCard({ label, value, color, loading }: CounterCardProps) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col items-center justify-center gap-1"
      style={{
        background: "hsl(0 0% 100% / 0.04)",
        border: "1px solid hsl(0 0% 100% / 0.08)",
      }}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" style={{ color }} />
      ) : (
        <span
          className="text-3xl leading-none font-extrabold tabular-nums tracking-tight"
          style={{ color }}
        >
          {value}
        </span>
      )}
      <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "hsl(var(--neutral-400))" }}>
        {label}
      </span>
    </div>
  );
}
