import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useMetaAdsSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const syncNow = useCallback(async (since?: string, until?: string) => {
    setSyncing(true);
    try {
      const { data: session } = await (supabase.auth as any).getSession();
      const { data, error } = await supabase.functions.invoke("meta-ads-sync", {
        body: { mode: "sync", since, until },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setLastResult(data);
      toast.success(
        `Meta Ads sincronizado: ${data.new_entries_inserted} novas entradas, ${data.skipped_existing} já existentes`
      );
      return data;
    } catch (e: any) {
      toast.error(e.message || "Erro ao sincronizar Meta Ads");
      return null;
    } finally {
      setSyncing(false);
    }
  }, []);

  return { syncing, lastResult, syncNow };
}
