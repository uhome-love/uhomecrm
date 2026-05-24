/**
 * PipelineFiltroBadges — 4 pílulas clicáveis do header do Pipeline v2.
 *
 * Fonte de verdade UNIFICADA com o Dashboard v3:
 *   - Em dia / Sem tarefa / Atrasado vêm de `useCorretorKpisCarteira` (mesma queryKey/cache)
 *   - Negócios vem de `useNegociosCount` (categoria informacional, stage convertido)
 *
 * Decisão CEO 25/05/2026 (revisão da decisão de 23/05):
 *   - "Em dia" no Pipeline = `em_dia + para_hoje` (saúde do funil, não execução do dia)
 *   - Soma garante que Em dia + Sem tarefa + Atrasado + Negócios = total do header
 *   - Dashboard segue mostrando 4 buckets separados (visão de execução do dia)
 *   - Princípio 59b: mesma fonte de verdade ≠ números idênticos; agrupamento pode variar por tela
 *
 * Click escreve `?filtro=em_dia|sem_tarefa|atrasado|negocios` na URL e chama onChange.
 * URL é a fonte de verdade do filtro; PipelineKanban tem useEffect que re-sincroniza.
 */
import { useSearchParams } from "react-router-dom";
import { useCorretorKpisCarteira } from "@/hooks/useCorretorKpisCarteira";
import { useNegociosCount } from "@/hooks/useNegociosCount";
import { trackPipelineEvent } from "@/lib/pipelineTelemetry";

export type PipelineFiltroKey = "em_dia" | "sem_tarefa" | "atrasado" | "negocios";

interface PipelineFiltroBadgesProps {
  /** Filtro atualmente ativo (vindo de PipelineKanban state). `null` = "Todos". */
  active: PipelineFiltroKey | null;
  /** Callback ao trocar filtro (clique numa pílula). */
  onChange: (filtro: PipelineFiltroKey | null) => void;
  /**
   * Contagens já calculadas client-side a partir dos leads em escopo
   * (preFilteredLeads do PipelineKanban). Quando informado, ignora os
   * hooks legados `useCorretorKpisCarteira`/`useNegociosCount` — esses
   * filtram por `corretor_id = user.id` e davam 0 para gestor/CEO.
   * Quando ausente, mantém o comportamento antigo (compat corretor).
   */
  counts?: { em_dia: number; sem_tarefa: number; atrasado: number; negocios: number };
}

interface BadgeDef {
  key: PipelineFiltroKey;
  label: string;
  color: string;         // text color
  dotColor: string;      // dot color
  bgActive: string;
  bgIdle: string;
}

const BADGES: BadgeDef[] = [
  { key: "em_dia",     label: "em dia",     color: "#047857", dotColor: "#22c55e", bgActive: "rgba(34,197,94,0.12)",  bgIdle: "transparent" },
  { key: "sem_tarefa", label: "sem tarefa", color: "#B45309", dotColor: "#F59E0B", bgActive: "rgba(245,158,11,0.12)", bgIdle: "transparent" },
  { key: "atrasado",   label: "atrasado",   color: "#DC2626", dotColor: "#DC2626", bgActive: "rgba(220,38,38,0.12)",  bgIdle: "transparent" },
  { key: "negocios",   label: "negócios",   color: "#1D4ED8", dotColor: "#3B82F6", bgActive: "rgba(59,130,246,0.12)", bgIdle: "transparent" },
];

export default function PipelineFiltroBadges({ active, onChange, counts: countsProp }: PipelineFiltroBadgesProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  // Hooks corretor-only: só são consultados quando `countsProp` não é passado
  // (fallback para a visão do corretor durante o rollout do fix Bug 1).
  const { data: carteira } = useCorretorKpisCarteira();
  const { data: negocios = 0 } = useNegociosCount();

  const counts: Record<PipelineFiltroKey, number> = countsProp ?? {
    // "Em dia" agrega em_dia + para_hoje — leads saudáveis (não atrasados, não sem tarefa).
    em_dia: (carteira?.em_dia ?? 0) + (carteira?.para_hoje ?? 0),
    sem_tarefa: carteira?.sem_tarefa ?? 0,
    atrasado: carteira?.atrasado ?? 0,
    negocios,
  };

  const handleClick = (key: PipelineFiltroKey) => {
    const next = active === key ? null : key;
    trackPipelineEvent("pipeline_filtro_clicked", {
      filtro: next ?? "clear",
      previous: active ?? null,
    });
    // URL como fonte de verdade — useEffect em PipelineKanban re-sincroniza state.
    if (next) searchParams.set("filtro", next);
    else searchParams.delete("filtro");
    setSearchParams(searchParams, { replace: true });
    onChange(next);
    // Scroll horizontal até "Negócio Criado" quando ativar o filtro Negócios
    if (next === "negocios") {
      requestAnimationFrame(() => {
        document
          .querySelector('[data-stage-tipo="convertido"]')
          ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
      });
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {BADGES.map((b) => {
        const isActive = active === b.key;
        const count = counts[b.key];
        const alertBorder = b.key === "atrasado" && count > 0;
        return (
          <button
            key={b.key}
            type="button"
            onClick={() => handleClick(b.key)}
            title={
              b.key === "em_dia"
                ? "Leads em dia (inclui tarefas pra hoje que ainda não venceram)"
                : `Filtrar por ${b.label}`
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: 999,
              border: alertBorder
                ? "2px solid #DC2626"
                : isActive
                  ? `1px solid ${b.dotColor}`
                  : "1px solid hsl(var(--border))",
              background: isActive ? b.bgActive : b.bgIdle,
              color: b.color,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
              outline: "none",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = b.bgActive;
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = b.bgIdle;
            }}
          >
            <span
              aria-hidden
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: b.dotColor,
                display: "inline-block",
              }}
            />
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{count.toLocaleString("pt-BR")}</span>
            <span>{b.label}</span>
          </button>
        );
      })}
    </div>
  );
}
