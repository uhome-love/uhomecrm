/**
 * useEquipesDisponiveis — lista de equipes (gestores) para o filtro da Central v2.
 *
 * Fonte canônica: team_members (relação gestor↔corretor). Cada "equipe" é um
 * gestor distinto (gerente_id) com status ativo. Só faz sentido para admin —
 * o gestor logado vê apenas a própria equipe (filtro escondido na UI).
 *
 * gerente_id = auth.users.id; profiles.user_id = auth.users.id.
 * Tenta embed profiles:gerente_id(nome, avatar_url); se o embed não resolver
 * (FK ausente / nomes nulos), cai para 2 queries (team_members → profiles).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

const STALE_MS = 30 * 60 * 1000; // 30min
const GC_MS = 60 * 60 * 1000;

export interface EquipeOption {
  id: string;        // gerente_id (auth.users.id)
  nome: string;
  avatarUrl: string | null;
}

interface ProfileEmbed {
  nome: string | null;
  avatar_url: string | null;
}

async function fetchEquipes(): Promise<EquipeOption[]> {
  // 1) tentativa com embed
  const embed = await supabase
    .from("team_members")
    .select("gerente_id, profiles:gerente_id(nome, avatar_url)")
    .eq("status", "ativo")
    .not("gerente_id", "is", null);

  if (!embed.error && embed.data) {
    const map = new Map<string, EquipeOption>();
    for (const row of embed.data as Array<{
      gerente_id: string | null;
      profiles: ProfileEmbed | ProfileEmbed[] | null;
    }>) {
      const gid = row.gerente_id;
      if (!gid || map.has(gid)) continue;
      const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      if (prof?.nome) {
        map.set(gid, { id: gid, nome: prof.nome, avatarUrl: prof.avatar_url ?? null });
      }
    }
    if (map.size > 0) {
      return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    }
    // embed resolveu mas sem nomes → fallback
  }

  // 2) fallback: 2 queries
  const tm = await supabase
    .from("team_members")
    .select("gerente_id")
    .eq("status", "ativo")
    .not("gerente_id", "is", null);
  if (tm.error) throw tm.error;

  const ids = [...new Set((tm.data ?? []).map((r) => r.gerente_id as string).filter(Boolean))];
  if (ids.length === 0) return [];

  const profs = await supabase
    .from("profiles")
    .select("user_id, nome, avatar_url")
    .in("user_id", ids);
  if (profs.error) throw profs.error;

  return (profs.data ?? [])
    .filter((p) => !!p.nome)
    .map((p) => ({
      id: p.user_id as string,
      nome: p.nome as string,
      avatarUrl: (p.avatar_url as string | null) ?? null,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function useEquipesDisponiveis() {
  const { isAdmin } = useUserRole();

  return useQuery({
    queryKey: ["central", "equipes-disponiveis"],
    queryFn: fetchEquipes,
    enabled: isAdmin,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    retry: 1,
  });
}
