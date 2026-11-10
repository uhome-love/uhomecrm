// Régua única de negócios para resumos da IA: lê v_negocios_pipeline
// (Documentação → Proposta → Contrato vêm da etapa do Pipeline; Ganho = vendas assinadas ativas).
// "Em Negociação" não existe mais.
// deno-lint-ignore no-explicit-any
export async function resumoNegociosPipeline(client: any, corretorAuthIds: string[] | null, mes: string): Promise<string> {
  let q = client.from("v_negocios_pipeline").select("etapa, vgv, data_assinatura, corretor_auth_id");
  if (corretorAuthIds) {
    if (corretorAuthIds.length === 0) return "- Negócios (Pipeline): nenhum corretor no time.";
    q = q.in("corretor_auth_id", corretorAuthIds);
  }
  const { data, error } = await q;
  if (error) return "- Negócios (Pipeline): indisponível agora.";
  const rows = (data || []) as Array<{ etapa: string; vgv: number | null; data_assinatura: string | null }>;
  const conta = (e: string) => rows.filter((r) => r.etapa === e).length;
  const ganhosMes = rows.filter((r) => r.etapa === "ganho" && (r.data_assinatura || "").startsWith(mes));
  const andamento = rows.filter((r) => ["documentacao", "proposta", "contrato"].includes(r.etapa));
  const soma = (xs: typeof rows) => xs.reduce((s, r) => s + Number(r.vgv || 0), 0);
  return `- Negócios no Pipeline agora: Documentação ${conta("documentacao")} | Proposta ${conta("proposta")} | Contrato ${conta("contrato")}
- Ganhos assinados no mês: ${ganhosMes.length} (VGV R$ ${(soma(ganhosMes) / 1000).toFixed(0)}k)
- VGV em andamento (Documentação+Proposta+Contrato): R$ ${(soma(andamento) / 1000).toFixed(0)}k`;
}
