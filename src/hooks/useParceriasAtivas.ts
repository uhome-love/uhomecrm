import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ParceriaAtiva { principalId: string; parceiroId: string; principal: string; parceiro: string }

/** Mapa leadId → parcerias ativas (fonte: pipeline_parcerias status 'ativa'). Uma consulta compartilhada por todas as telas. */
export function useParceriasAtivas() {
  return useQuery({
    queryKey: ["parcerias-ativas-mapa"],
    staleTime: 60_000,
    queryFn: async () => {
      const rows: { pipeline_lead_id: string; corretor_principal_id: string; corretor_parceiro_id: string }[] = [];
      for (let from = 0; ; from += 1000) {
        const r = await supabase.from("pipeline_parcerias").select("pipeline_lead_id,corretor_principal_id,corretor_parceiro_id")
          .eq("status", "ativa").range(from, from + 999);
        if (r.error) throw r.error;
        rows.push(...(r.data ?? []));
        if ((r.data ?? []).length < 1000) break;
      }
      const ids = [...new Set(rows.flatMap(r => [r.corretor_principal_id, r.corretor_parceiro_id]))];
      const nomes = new Map<string, string>();
      if (ids.length) {
        const p = await supabase.from("profiles").select("user_id,nome").in("user_id", ids);
        if (p.error) throw p.error;
        for (const x of p.data ?? []) if (x.user_id) nomes.set(x.user_id, x.nome ?? "Corretor");
      }
      const mapa = new Map<string, ParceriaAtiva[]>();
      for (const r of rows) {
        if (r.corretor_principal_id === r.corretor_parceiro_id) continue; // não conta como parceria
        const lista = mapa.get(r.pipeline_lead_id) ?? [];
        lista.push({ principalId: r.corretor_principal_id, parceiroId: r.corretor_parceiro_id, principal: nomes.get(r.corretor_principal_id) ?? "Corretor", parceiro: nomes.get(r.corretor_parceiro_id) ?? "Corretor" });
        mapa.set(r.pipeline_lead_id, lista);
      }
      return mapa;
    },
  });
}

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] ?? n;

/** Texto do selo: "Parceria Larissa + Matheus". */
export function textoParceria(lista: ParceriaAtiva[] | undefined): string | null {
  if (!lista?.length) return null;
  const nomes = [...new Set(lista.flatMap(p => [primeiroNome(p.principal), primeiroNome(p.parceiro)]))];
  return `Parceria ${nomes.join(" + ")}`;
}
