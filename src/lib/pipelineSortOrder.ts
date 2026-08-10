// ─────────────────────────────────────────────────────────────────
// pipelineSortOrder — Ordenação Activity-Based para cards do Kanban
//
// Prioriza leads que demandam ação AGORA:
//   1) Tarefa atrasada       (mais antiga primeiro — quem está esperando mais)
//   2) Tarefa para hoje      (hora mais cedo primeiro)
//   3) Tarefa futura         (data mais próxima primeiro)
//   4) Sem tarefa            (lead mais recente primeiro — created_at DESC)
//
// Todas as comparações de data/hora rodam em BRT via @/lib/brtTime.
// ─────────────────────────────────────────────────────────────────

import { todayBRT } from "@/lib/brtTime";
import { diasSemToque } from "@/lib/leadSaude";

export type SortableTarefa = {
  vence_em: string | null;
  hora_vencimento: string | null;
} | null | undefined;

export type SortableLead = {
  id: string;
  created_at: string;
  nome?: string | null;
  valor_estimado?: number | null;
  temperatura?: string | null;
  ultimo_toque_at?: string | null;
  distribuido_em?: string | null;
  aceito_em?: string | null;
};

export type PipelineSortOrder =
  | "prioridade"
  | "atividade"
  | "mais_recente"
  | "mais_antigo"
  | "nome"
  | "valor"
  | "temperatura";

type Bucket = 0 | 1 | 2 | 3; // atrasada=0, hoje=1, futura=2, sem=3

function bucketAndKey(
  tarefa: SortableTarefa,
  hojeBRT: string
): { bucket: Bucket; key: string } {
  if (!tarefa || !tarefa.vence_em) {
    return { bucket: 3, key: "" };
  }
  const venceEm = tarefa.vence_em; // já é YYYY-MM-DD em BRT (nossa convenção)
  if (venceEm < hojeBRT) {
    return { bucket: 0, key: `${venceEm} ${tarefa.hora_vencimento ?? "23:59"}` };
  }
  if (venceEm === hojeBRT) {
    return { bucket: 1, key: tarefa.hora_vencimento ?? "23:59" };
  }
  return { bucket: 2, key: `${venceEm} ${tarefa.hora_vencimento ?? "00:00"}` };
}

/**
 * Ordena leads in-place numa cópia, retornando novo array.
 * `tarefasMap[leadId]` deve apontar pra próxima tarefa pendente do lead (ou faltar).
 */
export function sortLeadsByActivity<T extends SortableLead>(
  leads: T[],
  tarefasMap: Record<string, SortableTarefa>
): T[] {
  const hoje = todayBRT();
  const decorated = leads.map((lead) => ({
    lead,
    ...bucketAndKey(tarefasMap[lead.id] ?? null, hoje),
  }));

  decorated.sort((a, b) => {
    if (a.bucket !== b.bucket) return a.bucket - b.bucket;
    if (a.bucket === 3) {
      // sem tarefa → created_at DESC (mais novo primeiro)
      return new Date(b.lead.created_at).getTime() - new Date(a.lead.created_at).getTime();
    }
    // atrasada / hoje / futura → ordem ASC pelo key (mais cedo/antigo primeiro)
    return a.key.localeCompare(b.key);
  });

  return decorated.map((d) => d.lead);
}

const TEMPERATURA_WEIGHT: Record<string, number> = {
  muito_quente: 5, urgente: 5, quente: 4, morno: 3, frio: 2, gelado: 1,
};

function tempWeight(t?: string | null): number {
  return TEMPERATURA_WEIGHT[(t ?? "morno").toLowerCase()] ?? 3;
}

function diasSemAtividade(l: SortableLead): number {
  return (
    diasSemToque({
      ultimo_toque_at: l.ultimo_toque_at,
      distribuido_em: l.distribuido_em,
      aceito_em: l.aceito_em,
      created_at: l.created_at,
    }) ?? 0
  );
}

/**
 * Despachador genérico — aplica a ordenação escolhida pelo usuário.
 * `atividade` (default) preserva o comportamento Activity-Based.
 */
export function sortLeads<T extends SortableLead>(
  leads: T[],
  order: PipelineSortOrder,
  tarefasMap: Record<string, SortableTarefa>,
  stageTipo?: string | null
): T[] {
  switch (order) {
    case "prioridade":
      // A bússola da Nova Gestão é POR ETAPA:
      //  - Novo Lead   → mais recente (velocidade de 1º atendimento)
      //  - Sem Contato → pela cadência (próxima tentativa mais devida) = por tarefa
      //  - Qualif+     → quente esfriando (temperatura × dias sem atividade)
      if (stageTipo === "novo_lead") {
        return [...leads].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      if (stageTipo === "sem_contato") {
        return sortLeadsByActivity(leads, tarefasMap);
      }
      return [...leads].sort((a, b) => {
        const w = tempWeight(b.temperatura) - tempWeight(a.temperatura);
        if (w !== 0) return w;
        return diasSemAtividade(b) - diasSemAtividade(a);
      });
    case "mais_recente":
      return [...leads].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    case "mais_antigo":
      return [...leads].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    case "nome":
      return [...leads].sort((a, b) =>
        (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR", { sensitivity: "base" })
      );
    case "valor":
      return [...leads].sort((a, b) => (b.valor_estimado ?? 0) - (a.valor_estimado ?? 0));
    case "temperatura":
      return [...leads].sort(
        (a, b) =>
          (TEMPERATURA_WEIGHT[b.temperatura ?? ""] ?? 0) -
          (TEMPERATURA_WEIGHT[a.temperatura ?? ""] ?? 0)
      );
    case "atividade":
    default:
      return sortLeadsByActivity(leads, tarefasMap);
  }
}
