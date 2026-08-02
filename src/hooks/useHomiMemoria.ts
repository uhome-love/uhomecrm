import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface HomiMemoria {
  id: string;
  categoria: string;
  chave: string;
  valor: string;
  updated_at: string;
}

/** O que o HOMI lembra sobre o usuário logado. */
export function useHomiMemoria() {
  const { user } = useAuth();
  const [memorias, setMemorias] = useState<HomiMemoria[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("homi_memoria_usuario")
      .select("id, categoria, chave, valor, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) console.error("[useHomiMemoria] load error:", error);
    setMemorias((data as HomiMemoria[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const esquecer = useCallback(async (id: string) => {
    setMemorias(prev => prev.filter(m => m.id !== id));
    const { error } = await supabase.from("homi_memoria_usuario").delete().eq("id", id);
    if (error) { console.error("[useHomiMemoria] delete error:", error); load(); }
  }, [load]);

  return { memorias, loading, reload: load, esquecer };
}
