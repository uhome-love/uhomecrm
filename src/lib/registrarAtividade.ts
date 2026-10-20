import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type AtividadeInsert = Database["public"]["Tables"]["pipeline_atividades"]["Insert"];

/**
 * Grava uma atividade no lead e NUNCA falha em silêncio:
 * se der erro, deixa rastro em ops_events e lança o erro para a tela avisar.
 */
export async function registrarAtividade(row: AtividadeInsert): Promise<void> {
  const { error } = await supabase.from("pipeline_atividades").insert(row);
  if (!error) return;
  try {
    await supabase.from("ops_events").insert({
      fn: "registro_atividade",
      level: "error",
      category: "crm",
      message: "Falha ao registrar atividade no lead",
      error_detail: error.message,
      ctx: {
        pipeline_lead_id: row.pipeline_lead_id,
        tipo: row.tipo ?? null,
        created_by: row.created_by ?? null,
        online: typeof navigator !== "undefined" ? navigator.onLine : null,
      },
    });
  } catch {
    /* rastro é best-effort */
  }
  throw error;
}

/** Versão para fluxos "dispara e segue": avisa o corretor se não salvou. */
export function registrarAtividadeComAviso(row: AtividadeInsert): Promise<void> {
  return registrarAtividade(row).catch(() => {
    toast.error("Não foi possível registrar a atividade. Tenta de novo.");
  });
}
