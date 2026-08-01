/**
 * useMutiraoAtivo — indica se existe uma sessão de "Mutirão ao vivo" acontecendo agora.
 * Usado para exibir o item no menu lateral apenas durante o evento.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMutiraoAtivo() {
  const { data } = useQuery({
    queryKey: ["mutirao-ativo-menu"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("oferta_ativa_sessoes")
        .select("id")
        .eq("status", "ao_vivo")
        .lte("inicio_at", nowIso)
        .gte("fim_at", nowIso)
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data?.id ?? null;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return { mutiraoAtivo: !!data, sessaoId: data ?? null };
}
