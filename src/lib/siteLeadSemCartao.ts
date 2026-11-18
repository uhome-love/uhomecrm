import type { BuscaLead } from "@/hooks/useBuscaLeads";

export interface SiteLeadSemCartao {
  id: string; nome: string; telefone: string | null; email: string | null;
  imovel_interesse: string | null; origem: string | null; status: string | null;
  observacoes: string | null; created_at: string; updated_at: string;
  pipeline_lead_id: string | null; is_teste: boolean;
}

/** Só cadastros sem cartão; o vínculo explícito evita repetir o mesmo lead na busca. */
export function siteLeadNaBusca(row: SiteLeadSemCartao): BuscaLead | null {
  if (row.pipeline_lead_id || row.is_teste || row.status === "arquivado") return null;
  return {
    id: row.id, nome: row.nome, telefone: row.telefone, telefone2: null, email: row.email,
    telefone_normalizado: null, empreendimento: row.imovel_interesse, campanha: null,
    origem: row.origem, data_lead: row.created_at, status: row.status ?? "novo",
    motivo_descarte: null, corretor_id: null, lista_id: "", em_atendimento_por: null,
    em_atendimento_ate: null, tentativas_count: 0, ultima_tentativa: null,
    cadastrado_jetimob: false, created_at: row.created_at, updated_at: row.updated_at,
    observacoes: row.observacoes, lista_nome: "Site", source: "site",
  };
}