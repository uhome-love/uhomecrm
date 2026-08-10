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
  updated_at?: string | null;
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

// Tier de prioridade por temperatura: Quente > Morno > (não definida) > Frio.
// Não definida fica no MEIO (desconhecido merece mais atenção que frio conhecido).
function tempTier(t?: string | null): number {
  const s = (t ?? "").toLowerCase();
  if (s === "quente" || s === "muito_quente" || s === "urgente") return 4;
  if (s === "morno") return 3;
  if (s === "frio" || s === "gelado") return 1;
  return 2; // nao_definida / vazio
}

function temMarcacao(t?: string | null): boolean {
  const s = (t ?? "").toLowerCase();
  return ["quente", "muito_quente", "urgente", "morno", "frio", "gelado"].includes(s);
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

function recencia(l: SortableLead): number {
  return new Date(l.updated_at ?? l.created_at).getTime();
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
      // Qualificação → Contrato: por temperatura (Quente>Morno>não def>Frio).
      // Desempate: marcados = esfriando (mais dias sem atividade); NÃO DEFINIDA
      // (padrão, enquanto o time não marca) = mais recente atualizado primeiro.
      return [...leads].sort((a, b) => {
        const w = tempTier(b.temperatura) - tempTier(a.temperatura);
        if (w !== 0) return w;
        if (temMarcacao(a.temperatura)) {
          return diasSemAtividade(b) - diasSemAtividade(a);
        }
        return recencia(b) - recencia(a);
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
      return [...leads].sort((a, b) => tempTier(b.temperatura) - tempTier(a.temperatura));
    case "atividade":
    default:
      return sortLeadsByActivity(leads, tarefasMap);
  }
}
