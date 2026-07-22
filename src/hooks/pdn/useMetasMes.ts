import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Metas do mês (empresa + por corretor) para a aba "Meta" do PDN.
 *
 * Backend:
 * - `empresa_metas_mensais(mes, meta_vgv)`
 * - `corretor_metas_mensais(user_id, mes, meta_vgv)`
 *
 * RLS já protege: se um usuário sem permissão tentar upsert, o erro sobe
 * como toast; a UI mostra os campos igual para todos e falha visível.
 */
export function useMetasMes(mes: string) {
  const [empresaMeta, setEmpresaMeta] = useState<number | null>(null);
  const [corretorMetas, setCorretorMetas] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: emp }, { data: cor }] = await Promise.all([
        supabase.from("empresa_metas_mensais").select("meta_vgv").eq("mes", mes).maybeSingle(),
        supabase.from("corretor_metas_mensais").select("user_id, meta_vgv").eq("mes", mes),
      ]);
      setEmpresaMeta(emp?.meta_vgv ? Number(emp.meta_vgv) : null);
      const map: Record<string, number> = {};
      for (const r of cor || []) {
        if ((r as any).user_id) map[(r as any).user_id] = Number((r as any).meta_vgv || 0);
      }
      setCorretorMetas(map);
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => { load(); }, [load]);

  const upsertEmpresa = useCallback(async (valor: number) => {
    const { error } = await supabase
      .from("empresa_metas_mensais")
      .upsert({ mes, meta_vgv: valor }, { onConflict: "mes" });
    if (error) { toast.error("Falha ao salvar meta da empresa"); return false; }
    setEmpresaMeta(valor);
    toast.success("Meta da empresa salva");
    return true;
  }, [mes]);

  const upsertCorretor = useCallback(async (userId: string, valor: number) => {
    const { error } = await supabase
      .from("corretor_metas_mensais")
      .upsert({ user_id: userId, mes, meta_vgv: valor }, { onConflict: "user_id,mes" });
    if (error) { toast.error("Falha ao salvar meta do corretor"); return false; }
    setCorretorMetas(prev => ({ ...prev, [userId]: valor }));
    toast.success("Meta salva");
    return true;
  }, [mes]);

  return { empresaMeta, corretorMetas, loading, upsertEmpresa, upsertCorretor, refresh: load };
}
