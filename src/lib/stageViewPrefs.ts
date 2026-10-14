// Preferência de ordenação/filtro POR ETAPA do Pipeline (só tela, localStorage).
import { todayBRT } from "@/lib/brtTime";
import { diasSemToque } from "@/lib/leadSaude";
import {
  QUALIFICACAO_SUBSTATUS, AQUECIMENTO_SUBSTATUS, VISITA_SUBSTATUS,
  NEGOCIACAO_SUBSTATUS, CONTRATO_SUBSTATUS, type SubstatusOption,
} from "@/lib/leadHelpers";
import type { SortableTarefa } from "@/lib/pipelineSortOrder";

export type StageSort =
  | "padrao" | "mais_recente" | "mais_antigo" | "sem_contato" | "mais_atualizado" | "mais_atrasado";

export const STAGE_SORT_OPTIONS: { value: StageSort; label: string }[] = [
  { value: "padrao", label: "Padrão (igual ao geral)" },
  { value: "mais_recente", label: "Mais recente" },
  { value: "mais_antigo", label: "Mais antigo" },
  { value: "sem_contato", label: "Mais tempo sem contato" },
  { value: "mais_atualizado", label: "Mais atualizado" },
  { value: "mais_atrasado", label: "Mais atrasado" },
];

export interface StageView { sort: StageSort; sub: string[] }
export const DEFAULT_VIEW: StageView = { sort: "padrao", sub: [] };

const key = (stageId: string) => `pipeline-stage-view:${stageId}`;

export function loadStageView(stageId: string): StageView {
  try {
    const raw = window.localStorage.getItem(key(stageId));
    if (!raw) return DEFAULT_VIEW;
    const v = JSON.parse(raw);
    const sort = STAGE_SORT_OPTIONS.some((o) => o.value === v?.sort) ? v.sort : "padrao";
    const sub = Array.isArray(v?.sub) ? v.sub.filter((s: unknown) => typeof s === "string") : [];
    return { sort, sub };
  } catch { return DEFAULT_VIEW; }
}

export function saveStageView(stageId: string, v: StageView) {
  try {
    if (v.sort === "padrao" && v.sub.length === 0) window.localStorage.removeItem(key(stageId));
    else window.localStorage.setItem(key(stageId), JSON.stringify(v));
  } catch { /* ignore */ }
}

/** Substatus por tipo de etapa: campo em flag_status + opções. */
export function substatusDaEtapa(tipo: string | null | undefined, nome?: string | null):
  { campo: string; opcoes: SubstatusOption[] } | null {
  const t = (tipo ?? "").toLowerCase();
  const n = (nome ?? "").toLowerCase();
  if (t.includes("qualific") || n.includes("qualifica")) return { campo: "status_atendimento", opcoes: QUALIFICACAO_SUBSTATUS };
  if (n.includes("aquecimento")) return { campo: "prazo", opcoes: AQUECIMENTO_SUBSTATUS };
  if (t.startsWith("visita") || n.startsWith("visita")) return { campo: "status_visita", opcoes: VISITA_SUBSTATUS };
  if (t === "negociacao" || n.includes("negocia")) return { campo: "status_negociacao", opcoes: NEGOCIACAO_SUBSTATUS };
  if (t.startsWith("contrato") || n.startsWith("contrato")) return { campo: "status_contrato", opcoes: CONTRATO_SUBSTATUS };
  return null;
}

type L = {
  id: string; created_at: string; ultimo_toque_at?: string | null;
  distribuido_em?: string | null; aceito_em?: string | null; flag_status?: unknown;
};

export function applyStageView<T extends L>(
  leads: T[], view: StageView, campo: string | null, tarefasMap: Record<string, SortableTarefa>,
): T[] {
  let out = leads;
  if (campo && view.sub.length) {
    out = out.filter((l) => {
      const fs = (l.flag_status ?? {}) as Record<string, unknown>;
      const v = fs[campo];
      return v != null && view.sub.includes(String(v));
    });
  }
  if (view.sort === "padrao") return out;
  const ts = (s?: string | null) => (s ? new Date(s).getTime() : 0);
  const toque = (l: T) => ts(l.ultimo_toque_at ?? l.aceito_em ?? l.distribuido_em ?? l.created_at);
  const dias = (l: T) => diasSemToque({ ultimo_toque_at: l.ultimo_toque_at, distribuido_em: l.distribuido_em, aceito_em: l.aceito_em, created_at: l.created_at }) ?? 0;
  const arr = [...out];
  switch (view.sort) {
    case "mais_recente": arr.sort((a, b) => ts(b.created_at) - ts(a.created_at)); break;
    case "mais_antigo": arr.sort((a, b) => ts(a.created_at) - ts(b.created_at)); break;
    case "sem_contato": arr.sort((a, b) => dias(b) - dias(a) || toque(a) - toque(b)); break;
    case "mais_atualizado": arr.sort((a, b) => toque(b) - toque(a)); break;
    case "mais_atrasado": {
      const hoje = todayBRT();
      // 0 = tarefa vencida (mais antiga primeiro), 1 = sem próximo passo (mais dias parado), 2 = hoje/futuro
      const rank = (l: T): [number, string, number] => {
        const t = tarefasMap[l.id];
        if (!t || !t.vence_em) return [1, "", -dias(l)];
        if (t.vence_em < hoje) return [0, `${t.vence_em} ${t.hora_vencimento ?? "23:59"}`, 0];
        return [2, `${t.vence_em} ${t.hora_vencimento ?? "23:59"}`, 0];
      };
      arr.sort((a, b) => {
        const ra = rank(a), rb = rank(b);
        return ra[0] - rb[0] || ra[1].localeCompare(rb[1]) || ra[2] - rb[2];
      });
      break;
    }
  }
  return arr;
}
