/**
 * import-brevo-csv — Bulk import Brevo CSV contacts
 * Accepts raw CSV text in POST body, parses and inserts into brevo_contacts
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2);
  return digits;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { csv_lines } = body;

    if (!csv_lines || !Array.isArray(csv_lines)) {
      return errorResponse("csv_lines array required", 400);
    }

    const BATCH_SIZE = 500;
    let inserted = 0;
    let skipped = 0;

    // Parse CSV lines (skip header if present)
    const contacts = csv_lines
      .map((line: string) => {
        const cols = parseCSVLine(line);
        if (cols.length < 10) return null;
        const nome = cols[1] || "";
        const sobrenome = cols[2] || "";
        const nomeCompleto = [nome, sobrenome].filter(Boolean).join(" ").trim();
        const telefone = cols[4] || "";
        const email = cols[6] || "";

        return {
          brevo_id: cols[0] || null,
          nome: nome || null,
          sobrenome: sobrenome || null,
          nome_completo: nomeCompleto || null,
          telefone: telefone || null,
          telefone_normalizado: normalizePhone(telefone),
          email: email ? email.toLowerCase().trim() : null,
          conversao_recente: cols[5] || null,
          primeira_conversao: cols[9] || null,
          data_conversao_recente: cols[7] || null,
          data_criacao: cols[8] || null,
        };
      })
      .filter((c: any) => c && (c.telefone_normalizado || c.email));

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("brevo_contacts").upsert(batch, {
        onConflict: "brevo_id",
        ignoreDuplicates: true,
      });
      if (error) {
        // Fallback: try insert ignoring duplicates
        const { error: err2 } = await supabase.from("brevo_contacts").insert(batch);
        if (err2) {
          console.error("Batch error:", err2.message, "index:", i);
          skipped += batch.length;
          continue;
        }
      }
      inserted += batch.length;
    }

    return jsonResponse({ success: true, inserted, skipped, total: csv_lines.length });
  } catch (err) {
    console.error("Import error:", err);
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500);
  }
});
