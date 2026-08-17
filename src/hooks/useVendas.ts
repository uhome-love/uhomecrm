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
      // Régua VGV: empresa/equipe = venda INTEIRA (soma as 2 metades da parceria =
      // TODAS as linhas); corretor = a metade dele. Vendas ÚNICAS = conta_como_venda
      // (não dobra a parceria). NÃO filtra conta_como_venda no VGV, senão o total
      // subconta a parceria e o 2º parceiro some.
      const { data } = await supabase
        .from("v_fato_venda")
        .select("corretor_auth_id, corretor_nome, equipe, vgv_rateado, conta_como_venda")
        .gte("data_assinatura", periodo.start)
        .lt("data_assinatura", periodo.end)
        .limit(5000);
      const rows = (data ?? []) as { corretor_auth_id: string | null; corretor_nome: string | null; equipe: string | null; vgv_rateado: number | null; conta_como_venda: boolean | null }[];

      const porTime = new Map<string, { corretores: Map<string, VendaCorretor>; vendasUnicas: number }>();
      let tvgv = 0, tvUnicas = 0;
      for (const r of rows) {
        const equipe = r.equipe || "Sem equipe";
        const cid = r.corretor_auth_id || "?";
        if (!porTime.has(equipe)) porTime.set(equipe, { corretores: new Map(), vendasUnicas: 0 });
        const t = porTime.get(equipe)!;
        if (!t.corretores.has(cid)) t.corretores.set(cid, { user_id: cid, nome: r.corretor_nome || "Corretor", vendas: 0, vgv: 0 });
        const c = t.corretores.get(cid)!;
        c.vendas += 1;                        // participação do corretor (parceria = 1 pra cada)
        c.vgv += Number(r.vgv_rateado || 0);  // a metade dele
        tvgv += Number(r.vgv_rateado || 0);
        if (r.conta_como_venda) { t.vendasUnicas += 1; tvUnicas += 1; }
      }

      const times: VendaTime[] = [];
      for (const [equipe, t] of porTime) {
        const corretores = [...t.corretores.values()].sort((a, b) => b.vgv - a.vgv);
        const vgv = corretores.reduce((a, c) => a + c.vgv, 0);
        times.push({ equipe, corretores, total: { vendas: t.vendasUnicas, vgv } });
      }
      times.sort((a, b) => b.total.vgv - a.total.vgv);
      return { times, total: { vendas: tvUnicas, vgv: tvgv }, ticketMedio: tvUnicas ? Math.round(tvgv / tvUnicas) : 0 };
    },
  });
}
