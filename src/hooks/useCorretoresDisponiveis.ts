// preparado para ativação no Prompt 7 (filtro por corretor)
/**
 * useCorretoresDisponiveis — lista de corretores para o futuro filtro por
 * corretor na Central v2. CRIADO mas ainda NÃO consumido pela UI (o dropdown
 * Corretor está escondido até o backend suportar p_corretor_id — Prompt 7).
 *
 * Quando equipeId é informado, filtra os corretores daquela equipe (gerente_id);
 * sem equipeId, lista todos os corretores ativos (admin) ou os da própria
 * equipe (gestor). Mesma fonte canônica: team_members.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

const STALE_MS = 30 * 60 * 1000; // 30min
const GC_MS = 60 * 60 * 1000;

export interface CorretorOption {
  id: string;        // user_id do corretor (auth.users.id)
  nome: string;
  avatarUrl: string | null;
}

interface ProfileEmbed {
  nome: string | null;
  avatar_url: string | null;
}

async function fetchCorretores(
  equipeId: string | undefined,
  gestorId: string | undefined,
  isAdmin: boolean
): Promise<CorretorOption[]> {
  let q = supabase
    .from("team_members")
    .select("user_id, profiles:user_id(nome, avatar_url)")
    .eq("status", "ativo")
    .not("user_id", "is", null);

  // escopo por equipe: admin pode escolher; gestor é travado na própria equipe
  const scopeGerente = equipeId ?? (isAdmin ? undefined : gestorId);
  if (scopeGerente) q = q.eq("gerente_id", scopeGerente);

  const embed = await q;

  if (!embed.error && embed.data) {
    const map = new Map<string, CorretorOption>();
    for (const row of embed.data as Array<{
      user_id: string | null;
      profiles: ProfileEmbed | ProfileEmbed[] | null;
    }>) {
      const uid = row.user_id;
      if (!uid || map.has(uid)) continue;
      const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      if (prof?.nome) {
        map.set(uid, { id: uid, nome: prof.nome, avatarUrl: prof.avatar_url ?? null });
      }
    }
    if (map.size > 0) {
      return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    }
  }

  // fallback: 2 queries
  let tmQ = supabase
    .from("team_members")
    .select("user_id")
    .eq("status", "ativo")
    .not("user_id", "is", null);
  if (scopeGerente) tmQ = tmQ.eq("gerente_id", scopeGerente);
  const tm = await tmQ;
  if (tm.error) throw tm.error;

  const ids = [...new Set((tm.data ?? []).map((r) => r.user_id as string).filter(Boolean))];
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

export function useCorretoresDisponiveis(equipeId?: string) {
  const { user } = useAuth();
  const { isAdmin, isGestor } = useUserRole();

  return useQuery({
    queryKey: ["central", "corretores-disponiveis", equipeId ?? "ALL"],
    queryFn: () => fetchCorretores(equipeId, user?.id, isAdmin),
    enabled: isAdmin || isGestor,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    retry: 1,
  });
}
