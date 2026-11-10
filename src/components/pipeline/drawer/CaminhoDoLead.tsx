// ─────────────────────────────────────────────────────────────────
// CaminhoDoLead — as etapas por onde o lead passou, com data, numa linha.
// Lê só o pipeline_historico que a ficha já carrega (leadData.historico).
// Quando o lead volta para uma etapa anterior, o chip diz "Voltou para".
// ─────────────────────────────────────────────────────────────────
import { Fragment } from "react";
import { ArrowRight, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoricoEtapa {
  stage_anterior_id: string | null;
  stage_novo_id: string | null;
  created_at: string;
}
interface Etapa {
  id: string;
  nome: string;
  ordem?: number | null;
}

interface Props {
  historico: HistoricoEtapa[];
  stages: Etapa[];
  currentStageId?: string | null;
  /** data de entrada do lead, usada no primeiro passo */
  createdAt?: string | null;
  /** quantos passos mostrar no máximo (os mais recentes) */
  max?: number;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function diaMesBRT(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const partes = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "numeric" }).formatToParts(d);
  const dia = partes.find((x) => x.type === "day")?.value ?? "";
  const mes = Number(partes.find((x) => x.type === "month")?.value ?? "1");
  return `${dia} ${MESES[mes - 1]}`;
}

interface Passo {
  stageId: string;
  data?: string | null;
  voltou: boolean;
}

export default function CaminhoDoLead({ historico, stages, currentStageId, createdAt, max = 5 }: Props) {
  const ordemDe = (id?: string | null) => {
    const i = stages.findIndex((s) => s.id === id);
    if (i === -1) return null;
    return stages[i].ordem ?? i;
  };
  const nomeDe = (id: string) => stages.find((s) => s.id === id)?.nome ?? "Etapa";

  const movimentos = [...historico]
    .filter((h) => h.stage_novo_id && h.stage_novo_id !== h.stage_anterior_id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const passos: Passo[] = [];
  if (movimentos[0]?.stage_anterior_id) {
    passos.push({ stageId: movimentos[0].stage_anterior_id, data: createdAt, voltou: false });
  }
  for (const m of movimentos) {
    const de = ordemDe(m.stage_anterior_id);
    const para = ordemDe(m.stage_novo_id);
    passos.push({ stageId: m.stage_novo_id!, data: m.created_at, voltou: de != null && para != null && para < de });
  }
  if (passos.length === 0 && currentStageId) passos.push({ stageId: currentStageId, data: createdAt, voltou: false });
  if (passos.length < 2) return null; // um passo só não conta história

  const visiveis = passos.slice(-max);
  const cortados = passos.length - visiveis.length;

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Caminho do lead</span>
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="Etapas por onde o lead passou">
        {cortados > 0 && <li className="text-[12px] text-muted-foreground">+{cortados}</li>}
        {visiveis.map((p, i) => {
          const atual = i === visiveis.length - 1;
          return (
            <Fragment key={`${p.stageId}-${i}`}>
              {i > 0 && (
                <li aria-hidden className="text-muted-foreground/60">
                  <ArrowRight className="h-3.5 w-3.5" />
                </li>
              )}
              <li
                aria-current={atual ? "step" : undefined}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold",
                  atual ? "border border-primary/30 bg-primary/10 text-primary" : "bg-muted text-foreground/75",
                )}
              >
                {p.voltou && <Undo2 className="h-3.5 w-3.5" />}
                {p.voltou ? `Voltou para ${nomeDe(p.stageId)}` : nomeDe(p.stageId)}
                {p.data && <span className="font-medium opacity-75 tabular-nums">{diaMesBRT(p.data)}</span>}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}
