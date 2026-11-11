// ─────────────────────────────────────────────────────────────────
// CaminhoDoLead — último movimento de etapa (botão) + caminho completo
// num Popover. Lê só o pipeline_historico que a ficha já carrega.
// Idas e voltas no mesmo dia (BRT) são escondidas apenas na exibição.
// ─────────────────────────────────────────────────────────────────
import { ArrowRight, ChevronDown, Undo2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { direcaoEtapa } from "@/lib/timelineNarrativa";

export interface HistoricoEtapa {
  stage_anterior_id: string | null;
  stage_novo_id: string | null;
  created_at: string;
}
export interface Etapa {
  id: string;
  nome: string;
  ordem?: number | null;
}
interface Props {
  historico: HistoricoEtapa[];
  stages: Etapa[];
  currentStageId?: string | null;
  createdAt?: string | null;
  /** Data de entrada na etapa atual (pipeline_leads.stage_changed_at). */
  stageChangedAt?: string | null;
}
export interface Passo {
  stageId: string;
  data?: string | null;
  voltou: boolean;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function partesBRT(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "numeric", year: "numeric" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { dia: g("day"), mes: Number(g("month") || "1"), ano: g("year") };
}
function diaMesBRT(iso?: string | null) {
  const p = partesBRT(iso);
  return p ? `${p.dia} ${MESES[p.mes - 1]}` : "";
}
function chaveDia(iso?: string | null) {
  const p = partesBRT(iso);
  return p ? `${p.ano}-${p.mes}-${p.dia}` : "";
}

/** Monta os passos do caminho, sem as idas e voltas do mesmo dia. */
export function montarCaminho(historico: HistoricoEtapa[], stages: Etapa[], createdAt?: string | null): Passo[] {
  const movs = [...historico]
    .filter((h) => h.stage_novo_id && h.stage_novo_id !== h.stage_anterior_id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const base: { stageId: string; data?: string | null; deId?: string | null }[] = [];
  if (movs[0]?.stage_anterior_id) base.push({ stageId: movs[0].stage_anterior_id, data: createdAt });
  for (const m of movs) {
    const ultimo = base[base.length - 1];
    // Etapa de origem sem registro de entrada: entra no caminho sem data.
    if (m.stage_anterior_id && ultimo && ultimo.stageId !== m.stage_anterior_id) {
      base.push({ stageId: m.stage_anterior_id, data: null, deId: ultimo.stageId });
    }
    base.push({ stageId: m.stage_novo_id!, data: m.created_at, deId: m.stage_anterior_id });
  }

  // Remove ida (i) + volta (i+1) quando volta para a etapa de antes no mesmo dia.
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (let i = 1; i + 1 < base.length; i++) {
      if (base[i].data && base[i - 1].stageId === base[i + 1].stageId && chaveDia(base[i].data) === chaveDia(base[i + 1].data)) {
        base.splice(i, 2);
        mudou = true;
        break;
      }
    }
  }
  // Mesma regra de direção da linha do tempo (timelineNarrativa.direcaoEtapa).
  return base.map((b, i) => ({
    stageId: b.stageId,
    data: b.data,
    voltou: i > 0 && direcaoEtapa(stages, base[i - 1].stageId, b.stageId) === "voltou",
  }));
}

export function CaminhoLista({ passos, nomeDe }: { passos: Passo[]; nomeDe: (id: string) => string }) {
  return (
    <ol className="max-h-[280px] overflow-y-auto py-1" aria-label="Etapas por onde o lead passou">
      {passos.map((p, i) => {
        const atual = i === passos.length - 1;
        return (
          <li
            key={`${p.stageId}-${i}`}
            aria-current={atual ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px]",
              atual ? "bg-primary/10 text-primary font-semibold" : "text-foreground/80",
            )}
          >
            {p.voltou ? <Undo2 className="h-3.5 w-3.5 shrink-0" /> : <span className="h-1.5 w-1.5 mx-1 rounded-full bg-current opacity-50 shrink-0" />}
            <span className="truncate flex-1">{p.voltou ? `Voltou para ${nomeDe(p.stageId)}` : nomeDe(p.stageId)}</span>
            <span className="tabular-nums text-[11.5px] text-muted-foreground shrink-0">{p.data ? diaMesBRT(p.data) : "sem registro"}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Quando o histórico não termina na etapa atual, acrescenta a etapa atual no fim (só exibição). */
export function caminhoAteEtapaAtual(passos: Passo[], currentStageId?: string | null, stageChangedAt?: string | null): { passos: Passo[]; semRegistro: boolean } {
  if (!currentStageId || passos.length === 0 || passos[passos.length - 1].stageId === currentStageId) return { passos, semRegistro: false };
  return { passos: [...passos, { stageId: currentStageId, data: stageChangedAt ?? null, voltou: false }], semRegistro: true };
}

const FINAL_LABEL: Record<string, string> = { caiu: "Caiu", descarte: "Descartado", venda: "Ganho" };

export function UltimoMovimento({ historico, stages, createdAt, currentStageId, stageChangedAt }: Props) {
  const { passos, semRegistro } = caminhoAteEtapaAtual(montarCaminho(historico, stages, createdAt), currentStageId, stageChangedAt);
  if (passos.length < 2) return null;
  const nomeDe = (id: string) => stages.find((s) => s.id === id)?.nome ?? "Etapa";
  const tipoDe = (id: string) => (stages.find((s) => s.id === id) as { tipo?: string } | undefined)?.tipo;
  const ult = passos[passos.length - 1];
  const Icone = semRegistro ? ArrowRight : ult.voltou ? Undo2 : ArrowRight;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-w-0 max-w-full items-center gap-1 whitespace-nowrap rounded-md px-1 -mx-1 text-[12px] font-medium hover:bg-muted transition-colors",
            ult.voltou && !semRegistro ? "text-primary" : "text-muted-foreground",
          )}
          aria-label="Ver caminho do lead"
        >
          <Icone className="h-3.5 w-3.5 shrink-0" />
          {FINAL_LABEL[tipoDe(ult.stageId) ?? ""] && ult.data ? (
            <span className="min-w-0 truncate pr-px">{FINAL_LABEL[tipoDe(ult.stageId)!]} em {diaMesBRT(ult.data)}</span>
          ) : semRegistro ? (
            <>
              <span className="min-w-0 truncate pr-px">Em {nomeDe(ult.stageId)}</span>
              {ult.data && <span className="shrink-0">desde {diaMesBRT(ult.data)}</span>}
            </>
          ) : (
            <>
              <span className="min-w-0 truncate pr-px">{ult.voltou ? "Voltou para" : "Avançou para"} {nomeDe(ult.stageId)}</span>
              <span className="shrink-0">· {diaMesBRT(ult.data)}</span>
            </>
          )}
          <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-[calc(100vw-2rem)] sm:w-72 p-1.5">
        <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Caminho do lead</p>
        <CaminhoLista passos={passos} nomeDe={nomeDe} />
      </PopoverContent>
    </Popover>
  );
}
