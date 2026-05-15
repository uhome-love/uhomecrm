import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface PulseEvent {
  id: string;
  tipo: string;
  prioridade: string;
  corretor_id: string;
  gerente_id: string | null;
  titulo: string;
  descricao: string | null;
  metadata: Record<string, any>;
  desafio_id: string | null;
  agrupamento_key: string | null;
  created_at: string;
  corretor_nome?: string;
  corretor_avatar?: string | null;
  reactions?: Record<string, { count: number; users: string[]; myReaction: boolean }>;
}

export interface PulseDesafio {
  id: string;
  titulo: string;
  descricao: string | null;
  metrica: string;
  meta: number;
  progresso_atual: number;
  tipo: string;
  criado_por: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  recompensa_badge: string | null;
  created_at: string;
  top_contributors?: { nome: string; quantidade: number }[];
}

const EMOJIS = ["fire", "clap", "strong", "rocket"] as const;
export type EmojiType = typeof EMOJIS[number];

const EMOJI_MAP: Record<EmojiType, string> = {
  fire: "🔥",
  clap: "👏",
  strong: "💪",
  rocket: "🚀",
};

export const getEmojiChar = (e: EmojiType) => EMOJI_MAP[e] || e;
export const REACTION_EMOJIS = EMOJIS;

export const EVENT_CONFIG: Record<string, { icon: string; borderColor: string }> = {
  negocio_fechado: { icon: "🎉", borderColor: "border-amber-400" },
  badge_desbloqueado: { icon: "💎", borderColor: "border-purple-400" },
  visita_convertida: { icon: "🎯", borderColor: "border-green-400" },
  ultrapassou_ranking: { icon: "👑", borderColor: "border-blue-400" },
  streak_ligacoes: { icon: "🔥", borderColor: "border-orange-400" },
  visita_agendada: { icon: "🏠", borderColor: "border-amber-300" },
  meta_batida: { icon: "⭐", borderColor: "border-green-400" },
  desafio_completado: { icon: "🏆", borderColor: "border-purple-400" },
};

export function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 30) return "agora";
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export function usePulse(filter: string = "todos") {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());

  // Fetch events
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["pulse-events", filter],
    queryFn: async () => {
      let query = supabase
        .from("pulse_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (filter === "conquistas") {
        query = query.in("tipo", ["badge_desbloqueado", "meta_batida", "desafio_completado"]);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch profiles for corretor names
      const corretorIds = [...new Set((data || []).map((e: any) => e.corretor_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .in("id", corretorIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

      // Fetch reactions for all events
      const eventIds = (data || []).map((e: any) => e.id);
      const { data: reactions } = await supabase
        .from("pulse_reactions")
        .select("*")
        .in("event_id", eventIds);

      const reactionMap: Record<string, Record<string, { count: number; users: string[]; myReaction: boolean }>> = {};
      (reactions || []).forEach((r: any) => {
        if (!reactionMap[r.event_id]) {
          reactionMap[r.event_id] = {};
          EMOJIS.forEach(e => { reactionMap[r.event_id][e] = { count: 0, users: [], myReaction: false }; });
        }
        if (reactionMap[r.event_id][r.emoji]) {
          reactionMap[r.event_id][r.emoji].count++;
          reactionMap[r.event_id][r.emoji].users.push(r.user_id);
          if (r.user_id === user?.id) reactionMap[r.event_id][r.emoji].myReaction = true;
        }
      });

      return (data || []).map((e: any): PulseEvent => ({
        ...e,
        metadata: e.metadata || {},
        corretor_nome: profileMap[e.corretor_id]?.nome || "Corretor",
        corretor_avatar: profileMap[e.corretor_id]?.avatar_url || null,
        reactions: reactionMap[e.id] || EMOJIS.reduce((acc, em) => ({ ...acc, [em]: { count: 0, users: [], myReaction: false } }), {}),
      }));
    },
    staleTime: 15_000,
  });

  // Fetch active desafio
  const { data: activeDesafio } = useQuery<PulseDesafio | null>({
    queryKey: ["pulse-desafio-ativo"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pulse_desafios")
        .select("*")
        .eq("status", "ativo")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!data) return null;

      // Get top contributors
      const { data: contribs } = await supabase
        .from("pulse_desafio_contribuicoes")
        .select("corretor_id, quantidade")
        .eq("desafio_id", data.id);

      const byCorretor: Record<string, number> = {};
      (contribs || []).forEach((c: any) => {
        byCorretor[c.corretor_id] = (byCorretor[c.corretor_id] || 0) + c.quantidade;
      });

      const corretorIds = Object.keys(byCorretor);
      const { data: profiles } = corretorIds.length > 0
        ? await supabase.from("profiles").select("id, nome").in("id", corretorIds)
        : { data: [] };

      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p.nome; });

      const top = Object.entries(byCorretor)
        .map(([id, qty]) => ({ nome: profileMap[id] || "Corretor", quantidade: qty }))
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 3);

      return { ...data, top_contributors: top } as PulseDesafio;
    },
    staleTime: 30_000,
  });

  // React to event
  const reactMutation = useMutation({
    mutationFn: async ({ eventId, emoji }: { eventId: string; emoji: EmojiType }) => {
      if (!user) throw new Error("Not authenticated");

      // Check if already reacted
      const { data: existing } = await supabase
        .from("pulse_reactions")
        .select("id, emoji")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        if (existing.emoji === emoji) {
          // Remove reaction
          await supabase.from("pulse_reactions").delete().eq("id", existing.id);
        } else {
          // Update to new emoji
          await supabase.from("pulse_reactions").update({ emoji }).eq("id", existing.id);
        }
      } else {
        // New reaction
        await supabase.from("pulse_reactions").insert({ event_id: eventId, user_id: user.id, emoji });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pulse-events"] });
    },
  });

  // Create desafio
  const createDesafioMutation = useMutation({
    mutationFn: async (desafio: Omit<PulseDesafio, "id" | "created_at" | "progresso_atual" | "status" | "top_contributors">) => {
      const { error } = await supabase.from("pulse_desafios").insert({
        ...desafio,
        progresso_atual: 0,
        status: "ativo",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pulse-desafio-ativo"] });
      toast.success("🏆 Desafio lançado!");
    },
  });

  // Create pulse event helper
  const createEvent = useCallback(async (
    tipo: string,
    titulo: string,
    descricao?: string,
    metadata?: Record<string, any>,
    prioridade: string = "media"
  ) => {
    if (!user) return;
    await supabase.rpc("criar_pulse_event", {
      p_tipo: tipo,
      p_corretor_id: user.id,
      p_titulo: titulo,
      p_descricao: descricao || null,
      p_metadata: metadata || {},
      p_prioridade: prioridade,
    });
  }, [user]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("pulse-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pulse_events" }, (payload) => {
        setNewEventIds(prev => new Set([...prev, payload.new.id]));
        queryClient.invalidateQueries({ queryKey: ["pulse-events"] });

        // Toast if reaction to my event
        if (payload.new.corretor_id !== user?.id) {
          // just refresh
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pulse_reactions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["pulse-events"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pulse_desafios" }, () => {
        queryClient.invalidateQueries({ queryKey: ["pulse-desafio-ativo"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, user?.id]);

  // Clear "new" status after 30s
  useEffect(() => {
    if (newEventIds.size === 0) return;
    const timer = setTimeout(() => setNewEventIds(new Set()), 30000);
    return () => clearTimeout(timer);
  }, [newEventIds]);

  return {
    events,
    eventsLoading,
    activeDesafio,
    newEventIds,
    react: reactMutation.mutate,
    createDesafio: createDesafioMutation.mutate,
    createEvent,
    isCreatingDesafio: createDesafioMutation.isPending,
  };
}
