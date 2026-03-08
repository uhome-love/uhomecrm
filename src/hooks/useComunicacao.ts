import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ComunicacaoTemplate {
  id: string;
  titulo: string;
  tipo: string;
  canal: string;
  empreendimento: string | null;
  campanha: string | null;
  conteudo: string;
  variaveis: string[];
  criado_por: string | null;
  visivel_para: string;
  ativo: boolean;
  uso_count: number;
  created_at: string;
}

export interface LeadContext {
  nome: string;
  empreendimento?: string;
  score?: number;
  ultima_interacao?: string;
  fase?: string;
}

const TIPO_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  contato_inicial: { label: "Contato Inicial", color: "#3B82F6", emoji: "📞" },
  follow_up_ligacao: { label: "Follow Up", color: "#F59E0B", emoji: "📲" },
  follow_up_visita: { label: "Follow Up Visita", color: "#F59E0B", emoji: "🏠" },
  proposta: { label: "Proposta", color: "#22C55E", emoji: "📋" },
  campanha: { label: "Campanha", color: "#EC4899", emoji: "🎉" },
  reengajamento: { label: "Reengajamento", color: "#8B5CF6", emoji: "🔄" },
  pos_venda: { label: "Pós-Venda", color: "#06B6D4", emoji: "💙" },
};

export { TIPO_CONFIG };

export function useComunicacaoTemplates(canal?: string, tipo?: string) {
  return useQuery({
    queryKey: ["comunicacao-templates", canal, tipo],
    queryFn: async () => {
      let query = supabase
        .from("comunicacao_templates")
        .select("*")
        .eq("ativo", true)
        .order("uso_count", { ascending: false });

      if (canal) query = query.eq("canal", canal);
      if (tipo && tipo !== "todos") query = query.eq("tipo", tipo);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as ComunicacaoTemplate[];
    },
    staleTime: 60_000 * 5,
  });
}

export function useAllComunicacaoTemplates() {
  return useQuery({
    queryKey: ["comunicacao-templates-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comunicacao_templates")
        .select("*")
        .order("tipo")
        .order("uso_count", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ComunicacaoTemplate[];
    },
    staleTime: 60_000 * 2,
  });
}

export function useIncrementTemplateUsage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      templateId,
      leadId,
      canal,
      mensagem,
      personalizado,
    }: {
      templateId: string;
      leadId?: string;
      canal: string;
      mensagem: string;
      personalizado?: boolean;
    }) => {
      // Increment uso_count directly
      await supabase
        .from("comunicacao_templates")
        .update({ uso_count: (undefined as any) } as any)
        .eq("id", templateId);
      // Use raw update instead of RPC to avoid type issues
      await (supabase.rpc as any)("increment_comunicacao_usage", { p_template_id: templateId });

      // Log history
      if (user) {
        await supabase.from("comunicacao_historico").insert({
          template_id: templateId,
          lead_id: leadId || null,
          corretor_id: user.id,
          canal,
          mensagem_enviada: mensagem,
          personalizado_homi: personalizado || false,
        } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comunicacao-templates"] });
    },
  });
}

export function substituirVariaveis(
  conteudo: string,
  lead: LeadContext,
  corretorNome: string
): string {
  return conteudo
    .replace(/\{\{nome\}\}/g, lead.nome || "Cliente")
    .replace(/\{\{empreendimento\}\}/g, lead.empreendimento || "[Empreendimento]")
    .replace(/\{\{corretor\}\}/g, corretorNome || "Corretor");
}

export async function personalizarComHomi(
  template: string,
  lead: LeadContext,
  corretorNome: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("homi-personalizar-mensagem", {
    body: { template, lead, corretor_nome: corretorNome },
  });

  if (error) {
    console.error("HOMI personalization error:", error);
    throw new Error("Erro ao personalizar mensagem");
  }

  return data?.mensagem || template;
}
