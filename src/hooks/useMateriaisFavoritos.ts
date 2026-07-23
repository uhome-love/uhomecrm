/**
 * Favoritos por EMPREENDIMENTO (não mais por material individual) + Recentes.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { MaterialLink } from "@/hooks/useMateriais";
import { toast } from "@/hooks/use-toast";

export interface MaterialComEmp extends MaterialLink {
  materiais_empreendimentos?: { id: string; nome: string; logo_url: string | null } | null;
}

const MAT_COLS =
  "id, empreendimento_id, categoria, tipo, titulo, descricao, url, storage_path, mime_type, file_size, origem, tags, resumo_ia, ingest_status, ingest_error, created_at, updated_at, ordem, materiais_empreendimentos(id,nome,logo_url)";

/** IDs de empreendimentos favoritos do usuário. */
export function useEmpreendimentoFavoritoIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["empreendimentos-favoritos-ids", user?.id],
    queryFn: async () => {
      if (!user?.id) return new Set<string>();
      const { data, error } = await (supabase as any)
        .from("empreendimentos_favoritos")
        .select("empreendimento_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return new Set<string>(((data ?? []) as any[]).map((r) => r.empreendimento_id));
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

/** Toggle favorito de um empreendimento inteiro. */
export function useToggleEmpreendimentoFavorito() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ empreendimentoId, isFav }: { empreendimentoId: string; isFav: boolean }) => {
      if (!user?.id) throw new Error("Sem usuário");
      if (isFav) {
        const { error } = await (supabase as any)
          .from("empreendimentos_favoritos")
          .delete()
          .eq("user_id", user.id)
          .eq("empreendimento_id", empreendimentoId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("empreendimentos_favoritos")
          .insert({ user_id: user.id, empreendimento_id: empreendimentoId });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["empreendimentos-favoritos-ids"] });
      toast({ title: vars.isFav ? "Removido dos favoritos" : "Empreendimento favoritado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useMaterialRecentes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["materiais-recentes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as MaterialComEmp[];
      const { data, error } = await (supabase as any)
        .from("materiais_recentes")
        .select(`material_id, last_at, count, materiais_links!inner(${MAT_COLS})`)
        .eq("user_id", user.id)
        .order("last_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => r.materiais_links as MaterialComEmp);
    },
    enabled: !!user?.id,
    staleTime: 15_000,
  });
}

export async function registrarMaterialRecente(materialId: string, acao = "abrir") {
  try {
    await (supabase as any).rpc("registrar_material_recente", {
      _material_id: materialId,
      _acao: acao,
    });
  } catch (e) {
    console.warn("[registrarMaterialRecente]", e);
  }
}
