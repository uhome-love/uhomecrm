import { supabase } from "@/integrations/supabase/client";
import { normalizarLigacoesMutirao, type MutiraoEvento, type OATentativaEvento } from "./oaEventos";

/** Read both authorized ledgers with deterministic pagination; never return partial totals on failure. */
export async function consultarEventosOA(inicio: string, fim: string, authId?: string): Promise<OATentativaEvento[]> {
  const { data: perfis, error: perfilError } = await supabase.from("profiles").select("id,user_id");
  if (perfilError) throw perfilError;
  const ids = new Map((perfis ?? []).map((p) => [p.id, p.user_id]));
  const profileId = authId ? (perfis ?? []).find((p) => p.user_id === authId)?.id : undefined;
  const tentativas: OATentativaEvento[] = [];
  const mutirao: MutiraoEvento[] = [];
  await Promise.all([
    (async () => {
      for (let offset = 0; ; offset += 500) {
        let query = supabase.from("oferta_ativa_tentativas")
          .select("id,lead_id,corretor_id,canal,resultado,pontos,empreendimento,created_at")
          .gte("created_at", inicio).lte("created_at", fim).order("created_at").order("id");
        if (authId) query = query.eq("corretor_id", authId);
        const { data, error } = await query.range(offset, offset + 499);
        if (error) throw error;
        tentativas.push(...(data ?? []));
        if ((data?.length ?? 0) < 500) break;
      }
    })(),
    (async () => {
      if (authId && !profileId) return;
      for (let offset = 0; ; offset += 500) {
        let query = supabase.from("oferta_ativa_ligacoes")
          .select("id,pipeline_lead_id,corretor_id,resultado,origem,pontos,created_at")
          .gte("created_at", inicio).lte("created_at", fim).eq("origem", "mutirao")
          .in("resultado", ["nao_atendeu", "sem_interesse", "aproveitado", "visita_agendada"])
          .order("created_at").order("id");
        if (profileId) query = query.eq("corretor_id", profileId);
        const { data, error } = await query.range(offset, offset + 499);
        if (error) throw error;
        mutirao.push(...(data ?? []));
        if ((data?.length ?? 0) < 500) break;
      }
    })(),
  ]);
  return [...tentativas, ...normalizarLigacoesMutirao(mutirao, ids)];
}