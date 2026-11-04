import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { limparNomeEmpreendimento, normalizarNomeProduto, selecionarFichaProduto, type WhatsAppProduto } from "@/lib/whatsappMensagens";

/** Só leitura: dados de produto nunca alteram o cadastro ou a atribuição do cliente. */
export function useWhatsAppProduto(open: boolean, leadId: string, empreendimento?: string | null) {
  return useQuery({
    queryKey: ["whatsapp-produto", leadId, empreendimento],
    enabled: open,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: lead, error: leadError } = await supabase.from("pipeline_leads")
        .select("empreendimento_canonico_id, flag_status").eq("id", leadId).maybeSingle();
      if (leadError) throw leadError;
      let canonicoId = lead?.empreendimento_canonico_id;
      if (!canonicoId && empreendimento) {
        const { data: aliases, error } = await supabase.from("empreendimento_aliases")
          .select("empreendimento_id").eq("alias_norm", normalizarNomeProduto(empreendimento));
        if (error) throw error;
        const ids = [...new Set(aliases?.map(a => a.empreendimento_id))];
        if (ids.length === 1) canonicoId = ids[0];
      }
      const fallback: WhatsAppProduto = { nome: limparNomeEmpreendimento(empreendimento) };
      if (!canonicoId) return { produto: fallback, flagStatus: lead?.flag_status };
      const [canonico, aliases, fichas] = await Promise.all([
        supabase.from("empreendimentos_canonicos").select("nome").eq("id", canonicoId).maybeSingle(),
        supabase.from("empreendimento_aliases").select("alias_raw").eq("empreendimento_id", canonicoId),
        supabase.from("empreendimento_overrides").select("nome, valor_min, diferenciais, argumentos_venda"),
      ]);
      if (canonico.error) throw canonico.error;
      if (!canonico.data) return { produto: fallback, flagStatus: lead?.flag_status };
      const nome = canonico.data.nome;
      // Falha na ficha mantém o nome oficial, mas nunca inventa preço/condição.
      const ficha = !fichas.error && !aliases.error
        ? selecionarFichaProduto(fichas.data ?? [], nome, aliases.data?.map(a => a.alias_raw)) : undefined;
      const produto: WhatsAppProduto = {
        nome, valorMin: ficha?.valor_min, diferenciais: ficha?.diferenciais, argumentosVenda: ficha?.argumentos_venda,
      };
      return { produto, flagStatus: lead?.flag_status };
    },
  });
}