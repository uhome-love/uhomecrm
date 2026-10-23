import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { resolveFormName } from "@/lib/metaFormIdMap";
import type { RateioVenda, VendaRelatorio } from "@/lib/vendasRelatorio";

export function useVendasRelatorio(start: string, end: string) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["vendas-realizadas", "relatorio", user?.id, start, end], enabled: !!user, staleTime: 30000,
    queryFn: async (): Promise<VendaRelatorio[]> => {
      const vendas = [];
      for (let offset = 0; ; offset += 500) {
        const r = await supabase.from("negocios").select("id,nome_cliente,empreendimento,empreendimento_canonico_id,construtora,unidade,vgv_final,vgv_estimado,data_assinatura,corretor_id,gerente_id,pipeline_lead_id,observacoes,intermediacao_id,comprovante_ato_path")
          .eq("fase", "ganho").eq("status", "ativo").gte("data_assinatura", start).lte("data_assinatura", end).order("data_assinatura", { ascending: false }).order("id").range(offset, offset + 499);
        if (r.error) throw r.error;
        vendas.push(...(r.data ?? [])); if ((r.data?.length ?? 0) < 500) break;
      }
      if (!vendas.length) return [];
      const rateios: RateioVenda[] = [];
      const origens = new Map<string, { origem: string | null; origem_detalhe: string | null }>();
      for (let i = 0; i < vendas.length; i += 100) {
        const lote = vendas.slice(i, i + 100);
        const ids = lote.map(v => v.id); const leads = lote.flatMap(v => v.pipeline_lead_id ? [v.pipeline_lead_id] : []);
        const [fatos, entradas] = await Promise.all([
          supabase.from("v_fato_venda").select("negocio_id,corretor_auth_id,corretor_nome,equipe,gerente_auth_id,vgv_rateado,participacao,em_parceria").in("negocio_id", ids),
          leads.length ? supabase.from("pipeline_leads").select("id,origem,origem_detalhe").in("id", leads) : Promise.resolve({ data: [], error: null }),
        ]);
        if (fatos.error) throw fatos.error; if (entradas.error) throw entradas.error;
        rateios.push(...(fatos.data ?? [])); entradas.data?.forEach(l => origens.set(l.id, l));
      }
      return vendas.map(v => {
        const o = v.pipeline_lead_id ? origens.get(v.pipeline_lead_id) : null;
        const detalhe = o?.origem_detalhe;
        const nome = detalhe ? resolveFormName(detalhe) : null;
        return { ...v, origem: o?.origem || "Não identificada", campanha: nome === "Formulário Meta" ? `Meta #${detalhe}` : nome, rateios: rateios.filter(r => r.negocio_id === v.id) };
      });
    },
  });
}