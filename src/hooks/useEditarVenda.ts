import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EditarVendaPayload {
  id: string;
  nome_cliente: string;
  empreendimento: string | null;
  empreendimento_canonico_id: string;
  unidade: string | null;
  vgv_final: number;
  data_assinatura: string; // yyyy-mm-dd
  observacoes: string | null;
  // Snapshot antes das mudanças (para trilha de auditoria)
  before: {
    nome_cliente: string | null;
    empreendimento: string | null;
    unidade: string | null;
    vgv_final: number | null;
    vgv_estimado: number | null;
    data_assinatura: string | null;
    observacoes: string | null;
  };
}

export function useEditarVenda() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (p: EditarVendaPayload) => {
      const { error } = await supabase.rpc("editar_venda", {
        p_id:p.id,p_nome:p.nome_cliente.trim(),p_empreendimento:p.empreendimento_canonico_id,
        p_unidade:p.unidade?.trim() ?? "",p_vgv:p.vgv_final,p_data:p.data_assinatura,p_observacoes:p.observacoes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda atualizada");
      qc.invalidateQueries({ queryKey: ["vendas-realizadas"] });
      qc.invalidateQueries({ queryKey: ["pdn"] });
      qc.invalidateQueries({ queryKey: ["pdn-live"] });
      qc.invalidateQueries({ queryKey: ["pipeline-leads"] });
      qc.invalidateQueries({ queryKey: ["negocios"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["vendas-pendencias-documentos"] });
      window.dispatchEvent(new CustomEvent("pipeline-reload"));
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Não foi possível salvar: ${msg}`);
    },
  });
}
