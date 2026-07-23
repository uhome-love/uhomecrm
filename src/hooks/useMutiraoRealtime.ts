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

export function useMutiraoRanking(sessao_id: string | null, paused: boolean = false) {
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
    refetchInterval: paused ? false : 15_000,
  });

  useEffect(() => {
    if (!sessao_id || paused) return;
    const ch = supabase
      .channel(`mutirao-part-${sessao_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "oferta_ativa_participantes", filter: `sessao_id=eq.${sessao_id}` },
        () => qc.invalidateQueries({ queryKey: ["mutirao", "ranking", sessao_id] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "oferta_ativa_ligacoes", filter: `sessao_id=eq.${sessao_id}` },
        () => qc.invalidateQueries({ queryKey: ["mutirao", "ranking", sessao_id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessao_id, qc, paused]);

  return q;
}

export function useMutiraoParticipantes(sessao_id: string | null) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["mutirao", "participantes", sessao_id],
    enabled: !!sessao_id,
    queryFn: async () => {
      // Query direta (RLS já permite leitura escopada)
      const { data, error } = await supabase
        .from("oferta_ativa_participantes")
        .select("corretor_id, gerente_id, equipe_text, status_online, ultima_acao_at, ultimo_heartbeat_at, ligacoes_count, aproveitamentos_count, visitas_count, pontos, profiles:corretor_id(nome, avatar_url)")
        .eq("sessao_id", sessao_id!);
      if (error) throw error;
      const now = Date.now();
      const enriched: Participante[] = (data ?? []).map((p: any) => {
        const lastHb = p.ultimo_heartbeat_at ? new Date(p.ultimo_heartbeat_at).getTime() : 0;
        const lastAct = p.ultima_acao_at ? new Date(p.ultima_acao_at).getTime() : 0;
        const minHb = lastHb ? (now - lastHb) / 60000 : Infinity;
        const minAct = lastAct ? (now - lastAct) / 60000 : Infinity;
        let status = "offline";
        if (minHb <= 2 && minAct <= 10) status = "online";
        else if (minHb <= 2) status = "ocioso";
        return {
          corretor_id: p.corretor_id,
          nome: p.profiles?.nome ?? "—",
          foto_url: p.profiles?.avatar_url ?? null,
          gerente_id: p.gerente_id,
          equipe: p.equipe_text,
          status_online: status,
          ultima_acao_at: p.ultima_acao_at,
          ultimo_heartbeat_at: p.ultimo_heartbeat_at,
          ligacoes: p.ligacoes_count ?? 0,
          aproveitamentos: p.aproveitamentos_count ?? 0,
          visitas: p.visitas_count ?? 0,
          pontos: p.pontos ?? 0,
        };
      });
      return { ok: true, participantes: enriched };
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
