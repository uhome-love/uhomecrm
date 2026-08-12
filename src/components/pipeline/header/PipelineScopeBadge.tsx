/**
 * PipelineScopeBadge — Mostra o contexto atual do Pipeline.
 *
 * Fase 1 do refactor das visões Gestor/CEO. Renderiza:
 *   • Corretor       → "Meus leads · N"
 *   • Gestor         → "Time · N leads"
 *   • CEO sem filtro → "Escritório · N leads"
 *   • CEO filtrado   → "Time {Nome} · N · filtrado por CEO"
 */
import { GERENTES_REAIS } from "./gerentesReais";
import { useGestoresPipeline } from "@/hooks/useGestoresPipeline";

export interface PipelineScopeBadgeProps {
  isAdmin: boolean;
  isDiretor?: boolean;
  isGestor: boolean;
  /** Rótulo já pronto e tab-aware, ex.: "1.531 leads" ou "112 negócios · R$ 55,8 mi". */
  countLabel: string;
  gestorFilter?: string; // "todos" ou gerente_id
}

// Contexto do Pipeline — texto suave (sem "Escritório", só números, como o mockup aprovado).
// O único prefixo é quando o CEO filtra um gestor específico (aí mostra de quem é o dado).
export default function PipelineScopeBadge({
  isAdmin,
  isDiretor = false,
  isGestor,
  countLabel,
  gestorFilter = "todos",
}: PipelineScopeBadgeProps) {
  const { data: gestores } = useGestoresPipeline(isAdmin || isDiretor);
  let prefix = "";
  if ((isAdmin || isDiretor) && gestorFilter && gestorFilter !== "todos") {
    const dyn = gestores?.find((x) => x.id === gestorFilter);
    const fallback = GERENTES_REAIS.find((x) => x.id === gestorFilter);
    prefix = `Time ${dyn?.apelido ?? fallback?.apelido ?? "Gestor"} · `;
  }
  return (
    <span className="hidden truncate text-[12.5px] font-medium text-muted-foreground lg:inline">
      {prefix}{countLabel}
    </span>
  );
}
