import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useJornadaNegocio(leadId: string) {
  return useQuery({
    queryKey: ["jornada-negocio", leadId],
    staleTime: 0,
    queryFn: async () => {
      const [lead, empreendimentos] = await Promise.all([
        supabase.from("pipeline_leads").select("id,nome,negocio_id,empreendimento,empreendimento_canonico_id,stage_id,flag_status,valor_estimado").eq("id", leadId).single(),
        supabase.from("empreendimentos_canonicos").select("id,nome,construtora").eq("ativo", true).order("nome"),
      ]);
      if (lead.error) throw lead.error;
      if (empreendimentos.error) throw empreendimentos.error;
      let query = supabase.from("negocios").select("id,empreendimento_canonico_id,empreendimento,construtora,unidade,vgv_final,vgv_estimado,proposta_valor,observacoes,fase,jornada").eq("pipeline_lead_id", leadId).eq("status", "ativo");
      query = lead.data.negocio_id ? query.eq("id", lead.data.negocio_id) : query.neq("fase", "ganho");
      const negocio = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (negocio.error) throw negocio.error;
      return { lead: lead.data, negocio: negocio.data, empreendimentos: empreendimentos.data ?? [] };
    },
    enabled: !!leadId,
  });
}