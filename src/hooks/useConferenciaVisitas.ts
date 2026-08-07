import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VisitaConferencia {
  id: string;
  data_visita: string;
  hora_visita: string | null;
  status: string;
  nome_cliente: string;
  empreendimento: string | null;
  corretor_id: string;
  corretor_nome: string;
  pipeline_lead_id: string | null;
  lead_stage_tipo: string | null;
  lead_stage_nome: string | null;
  lead_status: string | null;
  negocio_fase: string | null;
  bucket: "pos_visita" | "avancou" | "regrediu" | "caiu" | "sem_lead";
}

/**
 * Auditoria de visitas do mês para o gestor: lista TODAS as visitas do mês
 * agrupadas pelo estado atual do lead (fonte: pipeline_leads/pipeline_stages
 * + negocios). Independe do PDN — serve para conferir se cada visita
 * está no lugar certo.
 */
export function useConferenciaVisitas(mes: string) {
  const [rows, setRows] = useState<VisitaConferencia[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [year, month] = mes.split("-").map(Number);
      const inicio = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
      const fim = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

      const { data: visitas } = await supabase
        .from("visitas")
        .select(`
          id, data_visita, hora_visita, status,
          nome_cliente, empreendimento,
          corretor_id, pipeline_lead_id
        `)
        .gte("data_visita", inicio)
        .lte("data_visita", fim)
        .in("status", ["realizada", "confirmada", "marcada", "no_show", "reagendada"])
        .order("data_visita", { ascending: false });

      const list = (visitas || []) as any[];
      if (list.length === 0) { setRows([]); return; }

      const leadIds = Array.from(new Set(list.map(v => v.pipeline_lead_id).filter(Boolean)));
      const corretorIds = Array.from(new Set(list.map(v => v.corretor_id).filter(Boolean)));

      const [leadsRes, profilesRes] = await Promise.all([
        leadIds.length
          ? supabase.from("pipeline_leads")
              .select("id, arquivado, stage_id, pipeline_stages!inner(tipo, nome)")
              .in("id", leadIds)
          : Promise.resolve({ data: [] as any[] }),
        corretorIds.length
          ? supabase.from("profiles").select("id, nome, user_id").in("user_id", corretorIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const leadMap = new Map<string, any>();
      for (const l of (leadsRes.data || []) as any[]) leadMap.set(l.id, l);

      // negócios ativos por lead (para saber se já virou negócio → "avancou")
      const negocioMap = new Map<string, string>();
      if (leadIds.length) {
        const { data: negs } = await supabase
          .from("negocios")
          .select("pipeline_lead_id, fase, status")
          .in("pipeline_lead_id", leadIds);
        for (const n of (negs || []) as any[]) {
          if (n.status !== "arquivado" && n.pipeline_lead_id) {
            negocioMap.set(n.pipeline_lead_id, n.fase);
          }
        }
      }

      const nameMap = new Map<string, string>();
      for (const p of (profilesRes.data || []) as any[]) nameMap.set(p.user_id, p.nome);

      const out: VisitaConferencia[] = list.map(v => {
        const lead = v.pipeline_lead_id ? leadMap.get(v.pipeline_lead_id) : null;
        const stageTipo = lead?.pipeline_stages?.tipo ?? null;
        const stageNome = lead?.pipeline_stages?.nome ?? null;
        const leadStatus = lead?.arquivado ? "arquivado" : null;
        const negFase = v.pipeline_lead_id ? negocioMap.get(v.pipeline_lead_id) ?? null : null;

        let bucket: VisitaConferencia["bucket"];
        if (!lead) bucket = "sem_lead";
        else if (leadStatus === "arquivado" || stageTipo === "descarte") bucket = "caiu";
        else if (stageTipo === "pos_visita") bucket = "pos_visita";
        else if (stageTipo === "proposta" || stageTipo === "contrato_gerado" || stageTipo === "venda" || negFase) bucket = "avancou";
        else bucket = "regrediu"; // voltou para qualif/aquec/visita, etc.

        return {
          id: v.id,
          data_visita: v.data_visita,
          hora_visita: v.hora_visita,
          status: v.status,
          nome_cliente: v.nome_cliente,
          empreendimento: v.empreendimento,
          corretor_id: v.corretor_id,
          corretor_nome: nameMap.get(v.corretor_id) || "—",
          pipeline_lead_id: v.pipeline_lead_id,
          lead_stage_tipo: stageTipo,
          lead_stage_nome: stageNome,
          lead_status: leadStatus,
          negocio_fase: negFase,
          bucket,
        };
      });

      setRows(out);
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => { load(); }, [load]);

  const totais = useMemo(() => ({
    total: rows.length,
    pos_visita: rows.filter(r => r.bucket === "pos_visita").length,
    avancou: rows.filter(r => r.bucket === "avancou").length,
    regrediu: rows.filter(r => r.bucket === "regrediu").length,
    caiu: rows.filter(r => r.bucket === "caiu").length,
    sem_lead: rows.filter(r => r.bucket === "sem_lead").length,
  }), [rows]);

  return { rows, loading, totais, reload: load };
}
