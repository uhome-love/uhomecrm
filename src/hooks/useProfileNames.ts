/**
 * useProfileNames — mapa global user_id → nome, carregado UMA vez por sessão.
 *
 * Antes, cada abertura do modal do lead buscava `profiles` só DEPOIS que as
 * atividades chegavam (onda 2), o que fazia os nomes "pularem" na Narrativa.
 * Agora o mapa é compartilhado por todo o CRM e fica quente no cache.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const EMPTY: Record<string, string> = {};

export function useProfileNames() {
  const { data } = useQuery({
    queryKey: ["profile-names-map"],
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, nome");
      const map: Record<string, string> = {};
      for (const p of (data ?? []) as Array<{ user_id: string | null; nome: string | null }>) {
        if (p.user_id && p.nome) map[p.user_id] = p.nome;
      }
      return map;
    },
  });
  return data ?? EMPTY;
}
