/**
 * import-brevo-contacts — Imports Brevo CSV contact base into brevo_contacts table
 * 
 * POST body: { contacts: Array<{ brevo_id, nome, sobrenome, telefone, email, conversao_recente, primeira_conversao, data_conversao_recente, data_criacao }> }
 * Or: { csv_rows: Array<string[]> } with header mapping
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Remove all non-digit characters (handles +, spaces, dashes, unicode chars)
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2);
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { contacts } = body;

    if (!contacts || !Array.isArray(contacts)) {
      return errorResponse("contacts array required", 400);
    }

    const BATCH_SIZE = 500;
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE).map((c: Record<string, string>) => {
        const nome = c.nome || "";
        const sobrenome = c.sobrenome || "";
        const nomeCompleto = [nome, sobrenome].filter(Boolean).join(" ").trim();

        return {
          brevo_id: c.brevo_id || null,
          nome: nome || null,
          sobrenome: sobrenome || null,
          nome_completo: nomeCompleto || null,
          telefone: c.telefone || null,
          telefone_normalizado: normalizePhone(c.telefone),
          email: c.email ? c.email.toLowerCase().trim() : null,
          conversao_recente: c.conversao_recente || null,
          primeira_conversao: c.primeira_conversao || null,
          data_conversao_recente: c.data_conversao_recente || null,
          data_criacao: c.data_criacao || null,
        };
      }).filter((c: Record<string, unknown>) => c.telefone_normalizado || c.email);

      if (batch.length === 0) {
        skipped += contacts.slice(i, i + BATCH_SIZE).length;
        continue;
      }

      const { error } = await supabase.from("brevo_contacts").insert(batch);
      if (error) {
        console.error("Batch insert error:", error.message, "batch index:", i);
        skipped += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    return jsonResponse({ success: true, inserted, skipped, total: contacts.length });
  } catch (err) {
    console.error("Import error:", err);
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500);
  }
});
