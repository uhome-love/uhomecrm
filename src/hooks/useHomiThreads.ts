import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Message } from "@/contexts/HomiContext";

export interface HomiThread {
  id: string;
  titulo: string | null;
  pinned: boolean;
  arquivada: boolean;
  updated_at: string;
}

/** Lista/gerencia as conversas do HOMI do usuário logado. */
export function useHomiThreads() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<HomiThread[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("homi_conversations")
      .select("id, titulo, pinned, arquivada, updated_at")
      .eq("user_id", user.id)
      .eq("tipo", "chat")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) console.error("[useHomiThreads] load error:", error);
    setThreads((data as HomiThread[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const fetchMessages = useCallback(async (id: string): Promise<Message[]> => {
    const { data, error } = await supabase
      .from("homi_conversations")
      .select("mensagens")
      .eq("id", id)
      .maybeSingle();
    if (error) console.error("[useHomiThreads] fetchMessages error:", error);
    const msgs = (data?.mensagens as unknown as Message[]) || [];
    return Array.isArray(msgs) ? msgs : [];
  }, []);

  const update = useCallback(async (id: string, patch: Partial<HomiThread>) => {
    setThreads(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
    const { error } = await supabase.from("homi_conversations").update(patch as any).eq("id", id);
    if (error) { console.error("[useHomiThreads] update error:", error); load(); }
  }, [load]);

  const remove = useCallback(async (id: string) => {
    setThreads(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from("homi_conversations").delete().eq("id", id);
    if (error) { console.error("[useHomiThreads] delete error:", error); load(); }
  }, [load]);

  return { threads, loading, reload: load, fetchMessages, update, remove };
}
