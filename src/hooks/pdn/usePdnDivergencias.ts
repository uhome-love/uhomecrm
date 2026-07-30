import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Divergências entre `negocios` e `pipeline_leads` que fazem o PDN e as telas de
 * Negócios/Vendas mostrarem números diferentes. Só leitura — nada é corrigido
 * automaticamente; o gestor decide item a item.
 */
export type DivergenciaTipo =
  | "lead_arquivado"
  | "fase_divergente"
  | "negocio_sem_lead"
  | "lead_sem_negocio";

export interface DivergenciaRow {
  tipo: DivergenciaTipo;
  negocioId: string | null;
  pipelineLeadId: string | null;
  nome: string;
  detalhe: string;
  corretorAuthId: string | null;
}

const FASES_ATIVAS = ["em_negociacao", "contrato"];
// negocios.fase → pipeline_stages.tipo esperado
const FASE_TO_TIPO: Record<string, string> = {
  em_negociacao: "proposta",
  contrato: "contrato_gerado",
  ganho: "venda",
};

export function usePdnDivergencias(scopeAuthIds: string[] | null | undefined) {
  const [rows, setRows] = useState<DivergenciaRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (scopeAuthIds === undefined) return;
    setLoading(true);
    try {
      const inScope = (authId: string | null) =>
        scopeAuthIds === null ? true : !!authId && scopeAuthIds.includes(authId);

      const { data: stages } = await supabase.from("pipeline_stages").select("id, nome, tipo");
      const stageById: Record<string, { nome: string; tipo: string }> = {};
      for (const s of stages || []) stageById[(s as any).id] = { nome: (s as any).nome, tipo: (s as any).tipo };
      const negocioStageIds = Object.keys(stageById).filter(id =>
        ["proposta", "contrato_gerado"].includes(stageById[id].tipo),
      );

      const { data: negs } = await supabase
        .from("negocios")
        .select("id, nome_cliente, pipeline_lead_id, fase, status")
        .in("fase", [...FASES_ATIVAS, "ganho"])
        .eq("status", "ativo")
        .limit(2000);

      const leadIds = [...new Set((negs || []).map((n: any) => n.pipeline_lead_id).filter(Boolean))] as string[];
      const leadById: Record<string, any> = {};
      if (leadIds.length > 0) {
        const { data: leads } = await supabase
          .from("pipeline_leads")
          .select("id, nome, corretor_id, arquivado, stage_id")
          .in("id", leadIds);
        for (const l of leads || []) leadById[(l as any).id] = l;
      }

      const out: DivergenciaRow[] = [];

      for (const n of (negs || []) as any[]) {
        const lead = n.pipeline_lead_id ? leadById[n.pipeline_lead_id] : null;
        if (!n.pipeline_lead_id) {
          if (scopeAuthIds !== null) continue; // sem lead não há como aplicar escopo
          out.push({
            tipo: "negocio_sem_lead",
            negocioId: n.id,
            pipelineLeadId: null,
            nome: n.nome_cliente || "—",
            detalhe: `Negócio ativo (${n.fase}) sem lead vinculado no pipeline`,
            corretorAuthId: null,
          });
          continue;
        }
        if (!lead) continue;
        if (!inScope(lead.corretor_id)) continue;

        if (lead.arquivado) {
          out.push({
            tipo: "lead_arquivado",
            negocioId: n.id,
            pipelineLeadId: lead.id,
            nome: lead.nome || n.nome_cliente || "—",
            detalhe: `Negócio ativo (${n.fase}) em lead arquivado`,
            corretorAuthId: lead.corretor_id || null,
          });
          continue;
        }

        const esperado = FASE_TO_TIPO[n.fase];
        const atual = stageById[lead.stage_id];
        if (esperado && atual && atual.tipo !== esperado) {
          out.push({
            tipo: "fase_divergente",
            negocioId: n.id,
            pipelineLeadId: lead.id,
            nome: lead.nome || n.nome_cliente || "—",
            detalhe: `Negócio em "${n.fase}" mas lead está na etapa "${atual.nome}"`,
            corretorAuthId: lead.corretor_id || null,
          });
        }
      }

      // Leads em etapa de negócio sem nenhum negócio ativo vinculado
      if (negocioStageIds.length > 0) {
        let q = supabase
          .from("pipeline_leads")
          .select("id, nome, corretor_id, stage_id")
          .in("stage_id", negocioStageIds)
          .eq("arquivado", false)
          .limit(2000);
        if (scopeAuthIds !== null && scopeAuthIds.length > 0) q = q.in("corretor_id", scopeAuthIds);
        const { data: leadsEtapa } = await q;
        const ids = (leadsEtapa || []).map((l: any) => l.id);
        const comNegocio = new Set<string>();
        if (ids.length > 0) {
          const { data: ns } = await supabase
            .from("negocios")
            .select("pipeline_lead_id, status")
            .in("pipeline_lead_id", ids)
            .neq("status", "perdido");
          for (const n of ns || []) comNegocio.add((n as any).pipeline_lead_id);
        }
        for (const l of (leadsEtapa || []) as any[]) {
          if (comNegocio.has(l.id)) continue;
          out.push({
            tipo: "lead_sem_negocio",
            negocioId: null,
            pipelineLeadId: l.id,
            nome: l.nome || "—",
            detalhe: `Lead em "${stageById[l.stage_id]?.nome || "etapa de negócio"}" sem negócio criado`,
            corretorAuthId: l.corretor_id || null,
          });
        }
      }

      setRows(out);
    } finally {
      setLoading(false);
    }
  }, [scopeAuthIds]);

  useEffect(() => { load(); }, [load]);

  return { rows, loading, reload: load };
}
