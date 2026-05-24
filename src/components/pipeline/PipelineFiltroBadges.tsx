/**
 * PipelineFiltroBadges — 4 pílulas clicáveis do header do Pipeline v2.
 *
 * Fonte de verdade UNIFICADA com o Dashboard v3:
 *   - Em dia / Sem tarefa / Atrasado vêm de `useCorretorKpisCarteira` (mesma queryKey/cache)
 *   - Negócios vem de `useNegociosCount` (categoria informacional, stage convertido)
 *
 * Decisão CEO 23/05/2026:
 *   - "Em dia" = `em_dia` puro (espelha Dashboard, não soma para_hoje)
 *   - "Para hoje" NÃO vira pílula — Activity-Based sort já empurra para topo da coluna
 *
 * Click escreve `?filtro=em_dia|sem_tarefa|atrasado|negocios` na URL e chama onChange.
 * URL é a fonte de verdade do filtro; PipelineKanban tem useEffect que re-sincroniza.
 */
import { useSearchParams } from "react-router-dom";
import { useCorretorKpisCarteira } from "@/hooks/useCorretorKpisCarteira";
import { useNegociosCount } from "@/hooks/useNegociosCount";

export type PipelineFiltroKey = "em_dia" | "sem_tarefa" | "atrasado" | "negocios";

interface PipelineFiltroBadgesProps {
  /** Filtro atualmente ativo (vindo de PipelineKanban state). `null` = "Todos". */
  active: PipelineFiltroKey | null;
  /** Callback ao trocar filtro (clique numa pílula). */
  onChange: (filtro: PipelineFiltroKey | null) => void;
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

export default function PipelineFiltroBadges({ active, onChange }: PipelineFiltroBadgesProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: carteira } = useCorretorKpisCarteira();
  const { data: negocios = 0 } = useNegociosCount();

  const counts: Record<PipelineFiltroKey, number> = {
    em_dia: carteira?.em_dia ?? 0,
    sem_tarefa: carteira?.sem_tarefa ?? 0,
    atrasado: carteira?.atrasado ?? 0,
    negocios,
  };

  const handleClick = (key: PipelineFiltroKey) => {
    const next = active === key ? null : key;
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
                ? "Tarefas de hoje aparecem no topo da coluna"
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
