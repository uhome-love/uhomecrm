// ────────────────────────────────────────────────────────────────────────────
// SUB-FIX 4 — Guardrail de stage avançada (22/05/2026, aprovacao b1d4a221)
// Bloqueia criação/reativação de lead via campanha Átrio quando já existe
// lead com mesmo telefone em estado "intocável":
//   • arquivado = true                       → respeitar inativação (princípio 24)
//   • stage_id ∈ STAGES_INTOCAVEIS           → fase avançada de venda
//   • negocio_id IS NOT NULL                 → negócio já formalizado
//
// Lista de stages aprovada pelo CEO em 22/05/2026 (9 stages):
export const STAGES_INTOCAVEIS = new Set<string>([
  "a857139f-c419-4e37-ae17-5f5e70b21172", // Visita
  "c9fcf0ad-dcab-4575-b91f-3f76610e4d44", // Visita Marcada
  "5ad4f4aa-b66f-4dc2-ac90-97c55e846a14", // Visita Realizada
  "d932fb49-419c-4fda-bae1-9ef06ee2d033", // Pós-Visita
  "de6cee2f-8dda-4e60-a4e2-6b7f21aeae96", // Proposta
  "a8a1a867-5b0c-414e-9532-8873c4ca5a0f", // Negócio Criado
  "8c1eed68-4526-479f-9bb4-b8e70bee1416", // Contrato Gerado (stage fantasma, proteção defensiva)
  "213e9ca3-0cb3-4893-979d-25f7e2e9cfa1", // Negociação
  "2d7739eb-1787-4ad6-887a-7a4a32dcfc05", // Venda
]);

export type LeadIntocavelMotivo = "arquivado" | "stage" | "negocio_id";
export interface CheckLeadIntocavelResult {
  skip: boolean;
  motivo?: LeadIntocavelMotivo;
  lead?: { id: string; nome: string | null; stage_nome: string | null };
}

/**
 * Verifica se já existe um lead "intocável" para este telefone.
 * Match heurístico pelos últimos 8 dígitos (Sub-fix 1 substitui por canônico).
 * Ordem de avaliação: arquivado → stage → negocio_id (primeiro motivo vence).
 *
 * @param supabase  cliente Supabase (qualquer cliente com `.from(...).select(...)`)
 * @param telefone  telefone bruto recebido do WhatsApp (payload `from`)
 */
export async function checkLeadIntocavel(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  telefone: string,
): Promise<CheckLeadIntocavelResult> {
  const digits = (telefone || "").replace(/\D/g, "");
  const last8 = digits.slice(-8);
  if (last8.length !== 8) return { skip: false };

  const { data, error } = await supabase
    .from("pipeline_leads")
    .select(
      "id, nome, telefone_normalizado, stage_id, arquivado, negocio_id, pipeline_stages!inner(nome)",
    )
    .ilike("telefone_normalizado", `%${last8}`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("checkLeadIntocavel select err", error);
    return { skip: false };
  }

  for (const c of (data || [])) {
    let motivo: LeadIntocavelMotivo | null = null;
    if (c.arquivado === true) motivo = "arquivado";
    else if (c.stage_id && STAGES_INTOCAVEIS.has(c.stage_id)) motivo = "stage";
    else if (c.negocio_id != null) motivo = "negocio_id";

    if (motivo) {
      return {
        skip: true,
        motivo,
        lead: {
          id: c.id,
          nome: c.nome ?? null,
          stage_nome: c.pipeline_stages?.nome ?? null,
        },
      };
    }
  }
  return { skip: false };
}
