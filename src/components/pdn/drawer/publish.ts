/**
 * PDN → Lead publishing helpers.
 *
 * Idempotência: cada texto publicado carrega um marker embutido
 * `[pdn:<leadId>:<field>:<hash>]` — republicar com o mesmo texto detecta
 * o marker existente em `pipeline_anotacoes.conteudo` e não duplica.
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PubField = "observacao" | "proxima_acao";

export const FIELD_LABEL: Record<PubField, string> = {
  observacao: "Observação",
  proxima_acao: "Próxima ação",
};

/** SHA-1 curto (10 chars hex) via Web Crypto. */
export async function sha1Short(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 10);
}

/**
 * Carrega os hashes já publicados para este lead (últimos 30 markers) — usado
 * para diferenciar "Publicado ✓" vs "Republicar" no botão.
 */
export async function loadPublishedHashes(pipelineLeadId: string): Promise<Record<PubField, string | null>> {
  const found: Record<PubField, string | null> = { observacao: null, proxima_acao: null };
  const { data } = await supabase
    .from("pipeline_anotacoes")
    .select("conteudo, created_at")
    .eq("pipeline_lead_id", pipelineLeadId)
    .ilike("conteudo", "%[pdn:%")
    .order("created_at", { ascending: false })
    .limit(30);
  for (const r of data || []) {
    const c = String((r as { conteudo?: string }).conteudo || "");
    for (const f of ["observacao", "proxima_acao"] as PubField[]) {
      if (found[f]) continue;
      const re = new RegExp(`\\[pdn:${pipelineLeadId}:${f}:([a-f0-9]{6,20})\\]`);
      const m = c.match(re);
      if (m) found[f] = m[1];
    }
  }
  return found;
}

/**
 * Publica uma nota `[Gestor · PDN]` no histórico do lead. Retorna o hash publicado
 * (novo ou pré-existente) ou `null` em caso de falha.
 */
export async function publicarNoLead(pipelineLeadId: string, field: PubField, texto: string): Promise<string | null> {
  const clean = texto.trim();
  if (!clean) {
    toast.info("Escreva algo antes de publicar");
    return null;
  }
  try {
    const hash = await sha1Short(clean);
    const marker = `[pdn:${pipelineLeadId}:${field}:${hash}]`;

    // Idempotência: se marker já existe, retorna hash sem duplicar.
    const { data: exists } = await supabase
      .from("pipeline_anotacoes")
      .select("id")
      .eq("pipeline_lead_id", pipelineLeadId)
      .ilike("conteudo", `%${marker}%`)
      .limit(1);
    if (exists && exists.length > 0) {
      toast.info("Este texto já foi publicado no lead");
      return hash;
    }

    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) {
      toast.error("Sessão expirada");
      return null;
    }

    let autorNome = "Gestor (PDN)";
    const { data: prof } = await supabase.from("profiles").select("nome").eq("user_id", uid).maybeSingle();
    if (prof && (prof as { nome?: string }).nome) autorNome = `${(prof as { nome: string }).nome} (Gestor · PDN)`;

    const conteudo = `[Gestor · PDN] ${FIELD_LABEL[field]}: ${clean}\n\n${marker}`;
    const { error } = await supabase.from("pipeline_anotacoes").insert({
      pipeline_lead_id: pipelineLeadId,
      conteudo,
      autor_id: uid,
      autor_nome: autorNome,
      fixada: false,
    });
    if (error) {
      toast.error("Erro ao publicar: " + error.message);
      return null;
    }
    toast.success("Publicado no histórico do lead ✓");
    return hash;
  } catch (e) {
    console.error(e);
    toast.error("Falha ao publicar no lead");
    return null;
  }
}
