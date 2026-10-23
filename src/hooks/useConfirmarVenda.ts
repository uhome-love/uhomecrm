import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EmpreendimentoVenda { id: string; nome: string; construtora: string | null }
export interface IntermediacaoVenda { id: string; comprador_nome: string; empreendimento: string | null; unidade: string | null; vgv: number | null; filename: string | null }
export interface NegocioVenda { id: string; empreendimento_canonico_id: string | null; unidade: string | null; vgv_final: number | null; proposta_valor: number | null; vgv_estimado: number | null; data_assinatura: string | null; intermediacao_id: string | null; comprovante_ato_path: string | null }

export function useConfirmarVenda(leadId: string) {
  const [empreendimentos, setEmpreendimentos] = useState<EmpreendimentoVenda[]>([]);
  const [intermediacoes, setIntermediacoes] = useState<IntermediacaoVenda[]>([]);
  const [negocio, setNegocio] = useState<NegocioVenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setLoading(true); setError(null);
      try {
        const [emps, ints, lead] = await Promise.all([
          supabase.from("empreendimentos_canonicos").select("id,nome,construtora").eq("ativo", true).order("nome"),
          supabase.rpc("venda_intermediacoes", { p_lead_id: leadId }),
          supabase.from("pipeline_leads").select("negocio_id").eq("id", leadId).single(),
        ]);
        if (emps.error) throw emps.error;
        if (ints.error) throw ints.error;
        if (lead.error) throw lead.error;
        let query = supabase.from("negocios").select("id,empreendimento_canonico_id,unidade,vgv_final,proposta_valor,vgv_estimado,data_assinatura,intermediacao_id,comprovante_ato_path")
          .eq("pipeline_lead_id", leadId).eq("status", "ativo");
        query = lead.data.negocio_id ? query.eq("id", lead.data.negocio_id) : query.neq("fase", "ganho");
        const negs = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (negs.error) throw negs.error;
        if (!ativo) return;
        setEmpreendimentos(emps.data ?? []); setIntermediacoes(ints.data ?? []); setNegocio(negs.data);
      } catch (e) { if (ativo) setError(e instanceof Error ? e.message : String((e as { message?: string }).message ?? "Não foi possível carregar os dados.")); }
      finally { if (ativo) setLoading(false); }
    }
    void carregar();
    return () => { ativo = false; };
  }, [leadId, revision]);
  return { empreendimentos, intermediacoes, negocio, loading, error, recarregar: () => setRevision(v => v + 1) };
}