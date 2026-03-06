import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Visita } from "@/hooks/useVisitas";

/**
 * Hook to convert a realized Visita into a PDN business entry.
 * Anti-duplication: checks linked_pdn_id before creating.
 */
export function useVisitaToPdn() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const convertToPdn = useCallback(async (visita: Visita) => {
    if (!user) return null;

    // Anti-duplication: check if already converted
    if ((visita as any).linked_pdn_id) {
      toast.info("Esta visita já foi convertida em negócio no PDN.");
      return null;
    }

    // Double-check in DB
    const { data: existing } = await supabase
      .from("pdn_entries")
      .select("id")
      .eq("linked_visit_id", visita.id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Link it back if not linked yet
      await supabase.from("visitas").update({
        linked_pdn_id: existing.id,
        converted_to_pdn_at: new Date().toISOString(),
        converted_to_pdn_by: user.id,
      } as any).eq("id", visita.id);

      toast.info("Esta visita já possui negócio no PDN.");
      queryClient.invalidateQueries({ queryKey: ["visitas"] });
      return existing.id;
    }

    const currentMes = format(new Date(), "yyyy-MM");

    // Create PDN entry
    const { data: pdnEntry, error: pdnError } = await supabase
      .from("pdn_entries")
      .insert({
        gerente_id: visita.gerente_id,
        mes: currentMes,
        nome: visita.nome_cliente,
        und: "",
        empreendimento: visita.empreendimento || "",
        docs_status: "sem_docs",
        temperatura: "morno",
        corretor: "",
        equipe: "",
        ultimo_contato: visita.observacoes || "",
        data_visita: visita.data_visita,
        tipo_visita: "1a_visita",
        proxima_acao: "",
        observacoes: `Originado da visita realizada em ${visita.data_visita}`,
        situacao: "visita",
        vgv: null,
        quando_assina: null,
        status_pagamento: null,
        linked_visit_id: visita.id,
        created_from_visit: true,
      } as any)
      .select()
      .single();

    if (pdnError) {
      console.error("Erro ao criar negócio no PDN:", pdnError);
      toast.error("Erro ao enviar para o PDN");
      return null;
    }

    // Update visita with linkage
    await supabase.from("visitas").update({
      linked_pdn_id: pdnEntry.id,
      converted_to_pdn_at: new Date().toISOString(),
      converted_to_pdn_by: user.id,
    } as any).eq("id", visita.id);

    queryClient.invalidateQueries({ queryKey: ["visitas"] });
    toast.success("✅ Negócio criado no PDN com sucesso!");
    return pdnEntry.id;
  }, [user, queryClient]);

  return { convertToPdn };
}
