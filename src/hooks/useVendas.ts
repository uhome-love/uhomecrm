import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * useVendas — detalhe de VENDAS: VGV assinado com rateio de parceria (sem dobrar),
 * por corretor e por time. Fonte única `v_fato_venda`. Escopo por RLS. Só leitura.
 */

export interface VendaCorretor { user_id: string; nome: string; vendas: number; vgv: number; }
export interface VendaTime { equipe: string; corretores: VendaCorretor[]; total: { vendas: number; vgv: number }; }
export interface RelVendas { times: VendaTime[]; total: { vendas: number; vgv: number }; ticketMedio: number; }

export function useVendas(periodo: { start: string; end: string }) {
  return useQuery({
    queryKey: ["rel-vendas", periodo.start, periodo.end],
    staleTime: 60_000,
    queryFn: async (): Promise<RelVendas> => {
      const { data } = await supabase
        .from("v_fato_venda")
        .select("corretor_auth_id, corretor_nome, equipe, vgv_rateado")
        .eq("conta_como_venda", true)
        .gte("data_assinatura", periodo.start)
        .lt("data_assinatura", periodo.end)
        .limit(5000);
      const rows = (data ?? []) as { corretor_auth_id: string | null; corretor_nome: string | null; equipe: string | null; vgv_rateado: number | null }[];

      const porTime = new Map<string, Map<string, VendaCorretor>>();
      for (const r of rows) {
        const equipe = r.equipe || "Sem equipe";
        const cid = r.corretor_auth_id || "?";
        if (!porTime.has(equipe)) porTime.set(equipe, new Map());
        const m = porTime.get(equipe)!;
        if (!m.has(cid)) m.set(cid, { user_id: cid, nome: r.corretor_nome || "Corretor", vendas: 0, vgv: 0 });
        const c = m.get(cid)!;
        c.vendas += 1;
        c.vgv += Number(r.vgv_rateado || 0);
      }

      const times: VendaTime[] = [];
      let tv = 0, tvgv = 0;
      for (const [equipe, m] of porTime) {
        const corretores = [...m.values()].sort((a, b) => b.vgv - a.vgv);
        const total = corretores.reduce((a, c) => ({ vendas: a.vendas + c.vendas, vgv: a.vgv + c.vgv }), { vendas: 0, vgv: 0 });
        tv += total.vendas; tvgv += total.vgv;
        times.push({ equipe, corretores, total });
      }
      times.sort((a, b) => b.total.vgv - a.total.vgv);
      return { times, total: { vendas: tv, vgv: tvgv }, ticketMedio: tv ? Math.round(tvgv / tv) : 0 };
    },
  });
}
