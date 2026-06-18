/**
 * useGestoresPipeline — lista dinâmica de gestores (gerentes) para o filtro do CEO.
 *
 * Substitui a constante hardcoded GERENTES_REAIS: busca os `gerente_id` distintos
 * em `team_members` e resolve os nomes via `profiles.user_id = gerente_id`
 * (mapeamento canônico: gerente_id referencia auth.users.id / profiles.user_id).
 *
 * Ordena por número de membros (maior time primeiro). Faz fallback para a lista
 * estática caso a query falhe — nunca deixa o filtro vazio para o CEO.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GERENTES_REAIS } from "@/components/pipeline/header/PipelineGestorSelect";

export interface GestorOption {
  id: string;
  nome: string;
  apelido: string;
}

const FALLBACK: GestorOption[] = GERENTES_REAIS.map((g) => ({
  id: g.id,
  nome: g.nome,
  apelido: g.apelido,
}));

function firstName(nome: string): string {
  return (nome || "").trim().split(/\s+/)[0] || nome;
}

export function useGestoresPipeline(enabled = true) {
  return useQuery({
    queryKey: ["pipeline-gestores-lista"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<GestorOption[]> => {
      const { data: tm, error: tmErr } = await supabase
        .from("team_members")
        .select("gerente_id");
      if (tmErr || !tm) return FALLBACK;

      // Conta membros por gerente para ordenar.
      const counts = new Map<string, number>();
      for (const row of tm) {
        const id = row.gerente_id as string | null;
        if (!id) continue;
        counts.set(id, (counts.get(id) || 0) + 1);
      }
      const ids = [...counts.keys()];
      if (ids.length === 0) return FALLBACK;

      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", ids);
      const nomeById = new Map<string, string>();
      for (const p of profs || []) {
        if (p.user_id) nomeById.set(p.user_id as string, (p.nome as string) || "");
      }

      const staticById = new Map(FALLBACK.map((g) => [g.id, g]));

      const list: GestorOption[] = ids.map((id) => {
        const nome = nomeById.get(id) || staticById.get(id)?.nome || "Gestor";
        return { id, nome, apelido: staticById.get(id)?.apelido || firstName(nome) };
      });

      list.sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0));
      return list.length > 0 ? list : FALLBACK;
    },
  });
}
