/**
 * ImportBrevoContacts — One-time utility to import Brevo CSV into brevo_contacts table
 * Access at /import-brevo-contacts
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2);
  return digits;
}

export default function ImportBrevoContacts() {
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState({ inserted: 0, total: 0 });

  const handleImport = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/data/brevo-contacts.csv");
      const text = await res.text();
      const lines = text.split("\n").filter(l => l.trim());
      const headers = lines[0].split(";").map(h => h.replace(/"/g, "").trim());
      
      console.log("Headers:", headers);
      
      // Map header indices
      const idIdx = headers.findIndex(h => h.includes("ID"));
      const nomeIdx = headers.findIndex(h => h === "Nome");
      const sobrenomeIdx = headers.findIndex(h => h === "Sobrenome");
      const phoneIdx = headers.findIndex(h => h.includes("telefone") || h.includes("Número"));
      const emailIdx = headers.findIndex(h => h.includes("mail"));
      const conversaoIdx = headers.findIndex(h => h.includes("Conversão recente"));
      const primeiraIdx = headers.findIndex(h => h.includes("Primeira conversão"));
      const dataConvIdx = headers.findIndex(h => h.includes("Data de conversão"));
      const dataCriacaoIdx = headers.findIndex(h => h.includes("Data de criação"));

      console.log("Indices:", { idIdx, nomeIdx, sobrenomeIdx, phoneIdx, emailIdx, conversaoIdx });

      const rows = lines.slice(1);
      setProgress({ inserted: 0, total: rows.length });

      const BATCH = 500;
      let inserted = 0;

      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH).map(line => {
          const cols = line.split(";").map(c => c.replace(/^"|"$/g, "").trim());
          const nome = cols[nomeIdx] || "";
          const sobrenome = cols[sobrenomeIdx] || "";
          const telefone = cols[phoneIdx] || "";
          const email = cols[emailIdx] || "";

          return {
            brevo_id: cols[idIdx] || null,
            nome: nome || null,
            sobrenome: sobrenome || null,
            nome_completo: [nome, sobrenome].filter(Boolean).join(" ").trim() || null,
            telefone: telefone || null,
            telefone_normalizado: normalizePhone(telefone),
            email: email ? email.toLowerCase().trim() : null,
            conversao_recente: cols[conversaoIdx] || null,
            primeira_conversao: cols[primeiraIdx] || null,
            data_conversao_recente: cols[dataConvIdx] || null,
            data_criacao: cols[dataCriacaoIdx] || null,
          };
        }).filter(c => c.telefone_normalizado || c.email);

        const { error } = await supabase.from("brevo_contacts" as any).insert(batch as any);
        if (error) {
          console.error("Batch error:", error.message, "at index", i);
        } else {
          inserted += batch.length;
        }
        setProgress({ inserted, total: rows.length });
      }

      setStatus("done");
      setProgress(p => ({ ...p, inserted }));
    } catch (err) {
      console.error("Import error:", err);
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-background p-8 flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Importar Base Brevo</h1>
      <p className="text-muted-foreground">
        {status === "idle" && "Clique para importar a base de contatos Brevo para cruzamento futuro."}
        {status === "loading" && `Importando... ${progress.inserted}/${progress.total}`}
        {status === "done" && `✅ Importação concluída! ${progress.inserted} contatos importados.`}
        {status === "error" && "❌ Erro na importação. Verifique o console."}
      </p>
      <Button onClick={handleImport} disabled={status === "loading" || status === "done"}>
        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {status === "done" ? "Importado ✓" : "Importar Base"}
      </Button>
    </div>
  );
}
