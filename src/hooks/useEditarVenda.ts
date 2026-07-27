import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface EditarVendaPayload {
  id: string;
  nome_cliente: string;
  empreendimento: string | null;
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
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (p: EditarVendaPayload) => {
      const updates: Record<string, unknown> = {
        nome_cliente: p.nome_cliente.trim(),
        empreendimento: p.empreendimento?.trim() || null,
        unidade: p.unidade?.trim() || null,
        vgv_final: p.vgv_final,
        data_assinatura: p.data_assinatura,
        observacoes: p.observacoes?.trim() || null,
        updated_at: new Date().toISOString(),
      };
      // Se vgv_estimado estiver vazio, espelha o final para não deixar buraco em relatórios antigos
      if (!p.before.vgv_estimado || p.before.vgv_estimado <= 0) {
        updates.vgv_estimado = p.vgv_final;
      }

      const { error } = await supabase
        .from("negocios")
        .update(updates as never)
        .eq("id", p.id);
      if (error) throw error;

      // Trilha de auditoria (best-effort — se falhar, não bloqueia o salvamento)
      try {
        const changes: string[] = [];
        const diff = (label: string, a: unknown, b: unknown) => {
          const av = a == null || a === "" ? "—" : String(a);
          const bv = b == null || b === "" ? "—" : String(b);
          if (av !== bv) changes.push(`${label}: ${av} → ${bv}`);
        };
        diff("Cliente", p.before.nome_cliente, updates.nome_cliente);
        diff("Empreendimento", p.before.empreendimento, updates.empreendimento);
        diff("Unidade", p.before.unidade, updates.unidade);
        diff("VGV final", p.before.vgv_final, updates.vgv_final);
        diff("Data assinatura", p.before.data_assinatura, updates.data_assinatura);
        diff("Observação", p.before.observacoes, updates.observacoes);

        if (changes.length > 0) {
          await supabase.from("negocios_atividades").insert({
            negocio_id: p.id,
            created_by: user?.id ?? null,
            tipo: "edicao_manual",
            titulo: "Edição em Vendas Realizadas",
            descricao: changes.join(" | "),
          } as never);
        }
      } catch (e) {
        console.warn("[useEditarVenda] auditoria falhou:", e);
      }
    },
    onSuccess: () => {
      toast.success("Venda atualizada");
      qc.invalidateQueries({ queryKey: ["vendas-realizadas"] });
      qc.invalidateQueries({ queryKey: ["pdn"] });
      qc.invalidateQueries({ queryKey: ["pdn-live"] });
      qc.invalidateQueries({ queryKey: ["pipeline-leads"] });
      qc.invalidateQueries({ queryKey: ["negocios"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Não foi possível salvar: ${msg}`);
    },
  });
}
