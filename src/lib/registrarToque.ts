// ─────────────────────────────────────────────────────────────────
// registrarToque — carimba `ultimo_toque_at` no lead (TOQUE HUMANO do corretor).
//
// ADITIVO: chamado JUNTO das escritas de `ultima_acao_at` que já existem,
// nunca no lugar delas. IA/automação/campanha/reengajamento NÃO chamam este
// helper. Nesta onda o valor é apenas gravado — nenhuma régua lê a coluna.
// ─────────────────────────────────────────────────────────────────
import { supabase } from "@/integrations/supabase/client";

export async function registrarToque(leadId: string): Promise<void> {
  if (!leadId) return;
  try {
    await supabase
      .from("pipeline_leads")
      .update({ ultimo_toque_at: new Date().toISOString() } as never)
      .eq("id", leadId);
  } catch (e) {
    console.error("[registrarToque] erro ao registrar toque humano:", e);
  }
}
