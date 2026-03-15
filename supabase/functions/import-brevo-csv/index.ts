/**
 * import-brevo-csv — Bulk import Brevo CSV contacts from a URL
 * POST body: { csv_url: string } — fetches CSV and imports into brevo_contacts
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
    const { csv_url, csv_text } = body;

    let csvContent = csv_text || "";
    
    if (csv_url && !csvContent) {
      console.log("Fetching CSV from:", csv_url);
      const resp = await fetch(csv_url);
      if (!resp.ok) return errorResponse(`Failed to fetch CSV: ${resp.status}`, 400);
      csvContent = await resp.text();
    }

    if (!csvContent) {
      return errorResponse("csv_url or csv_text required", 400);
    }

    const lines = csvContent.split("\n").filter((l: string) => l.trim().length > 0);
    console.log(`Total CSV lines: ${lines.length}`);

    // Skip header
    const dataLines = lines.slice(1);
    
    const BATCH_SIZE = 500;
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < dataLines.length; i += BATCH_SIZE) {
      const batchLines = dataLines.slice(i, i + BATCH_SIZE);
      const contacts = batchLines
        .map((line: string) => {
          try {
            const cols = parseCSVLine(line);
            if (cols.length < 7) return null;
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
              primeira_conversao: cols.length > 9 ? (cols[9] || null) : null,
              data_conversao_recente: cols[7] || null,
              data_criacao: cols[8] || null,
            };
          } catch {
            return null;
          }
        })
        .filter((c: any) => c && (c.telefone_normalizado || c.email));

      if (contacts.length === 0) {
        skipped += batchLines.length;
        continue;
      }

      const { error } = await supabase.from("brevo_contacts").insert(contacts);
      if (error) {
        console.error(`Batch ${i} error:`, error.message);
        errors += contacts.length;
      } else {
        inserted += contacts.length;
      }
      
      console.log(`Batch ${i}-${i + BATCH_SIZE}: inserted=${contacts.length}, total_so_far=${inserted}`);
    }

    console.log(`Import complete: inserted=${inserted}, skipped=${skipped}, errors=${errors}`);
    return jsonResponse({ success: true, inserted, skipped, errors, total_lines: dataLines.length });
  } catch (err) {
    console.error("Import error:", err);
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500);
  }
});
