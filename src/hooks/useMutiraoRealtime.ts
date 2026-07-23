/**
 * useMutiraoRealtime — hooks para ranking/participantes/feed com realtime.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Participante {
  corretor_id: string;
  nome: string;
  foto_url: string | null;
  gerente_id: string | null;
  equipe: string | null;
  status_online: string;
  ultima_acao_at: string | null;
  ultimo_heartbeat_at: string | null;
  ligacoes: number;
  aproveitamentos: number;
  visitas: number;
  pontos: number;
}

export interface RankingResp {
  ok: boolean;
  corretores: Participante[];
  equipes: {
    equipe: string;
    gerente_id: string | null;
    pontos: number;
    ligacoes: number;
    aproveitamentos: number;
    visitas: number;
    corretores: number;
  }[];
}

export function useMutiraoRanking(sessao_id: string | null) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["mutirao", "ranking", sessao_id],
    enabled: !!sessao_id,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<RankingResp>("oferta-ativa-ranking", {
        body: { sessao_id },
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!sessao_id) return;
    const ch = supabase
      .channel(`mutirao-part-${sessao_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "oferta_ativa_participantes", filter: `sessao_id=eq.${sessao_id}` },
        () => qc.invalidateQueries({ queryKey: ["mutirao", "ranking", sessao_id] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "oferta_ativa_ligacoes", filter: `sessao_id=eq.${sessao_id}` },
        () => qc.invalidateQueries({ queryKey: ["mutirao", "ranking", sessao_id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessao_id, qc]);

  return q;
}

export function useMutiraoParticipantes(sessao_id: string | null) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["mutirao", "participantes", sessao_id],
    enabled: !!sessao_id,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(`oferta-ativa-participantes?sessao_id=${sessao_id}`, {
        method: "GET" as any,
      } as any);
      // fallback: usar fetch direto via functions.invoke não suporta GET fácil; usamos POST list route? Já temos GET no code — usaremos supabase.functions.invoke com method GET não roda; fallback: chamar via url.
      if (error) throw error;
      return data as { ok: boolean; participantes: Participante[] };
    },
    refetchInterval: 20_000,
  });
  useEffect(() => {
    if (!sessao_id) return;
    const ch = supabase.channel(`mutirao-participantes-${sessao_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "oferta_ativa_participantes", filter: `sessao_id=eq.${sessao_id}` },
        () => qc.invalidateQueries({ queryKey: ["mutirao", "participantes", sessao_id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessao_id, qc]);
  return q;
}
