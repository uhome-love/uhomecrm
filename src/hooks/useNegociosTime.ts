import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { getManagedTeamUserIds } from "@/hooks/useAuthUser";

/**
 * useNegociosTime — "Negócios pra acompanhar" da Agenda do gestor/diretora/CEO.
 * Lê o pipeline do TIME (não só a carteira do próprio) nas etapas avançadas
 * (Em Negociação = tipo `proposta`, Contrato = tipo `contrato_gerado`), pra o
 * gestor vigiar os deals que estão perto de fechar e cobrar o time.
 *
 * Escopo: gestor vê o próprio time (team_members) + a própria carteira;
 * admin/diretora veem a empresa toda. Limitado aos maiores por valor.
 */

export interface NegocioTime {
  id: string;                 // pipeline_lead id
  nome: string;
  corretor_id: string | null;
  corretor_nome: string;
  empreendimento: string | null;
  valor: number | null;
  etapa: "Em Negociação" | "Contrato";
  etapaTipo: "proposta" | "contrato_gerado";
}

const STAGES_AVANCADAS = ["proposta", "contrato_gerado"];
const LIMITE = 30;

export function useNegociosTime(enabled: boolean) {
  const { user } = useAuth();
  const { isAdmin, isDiretor } = useUserRole();

  return useQuery({
    queryKey: ["negocios-time", user?.id],
    enabled: enabled && !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<NegocioTime[]> => {
      if (!user) return [];

      // 1) Etapas avançadas (Em Negociação / Contrato).
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id, nome, tipo")
        .in("tipo", STAGES_AVANCADAS);
      const stageTipo = new Map<string, string>();
      for (const s of stages ?? []) stageTipo.set(s.id as string, s.tipo as string);
      const stageIds = [...stageTipo.keys()];
      if (stageIds.length === 0) return [];

      // 2) Escopo de corretores. Admin/diretora = empresa toda (sem filtro).
      //    Gestor = time dele + a própria carteira.
      const veTudo = isAdmin || isDiretor;
      let corretorIds: string[] | null = null;
      if (!veTudo) {
        const team = await getManagedTeamUserIds(user.id);
        corretorIds = [...new Set([...team, user.id])];
        if (corretorIds.length === 0) return [];
      }

      // 3) Leads nas etapas avançadas, maiores primeiro.
      let q = supabase
        .from("pipeline_leads")
        .select("id, nome, corretor_id, empreendimento, valor_estimado, stage_id")
        .eq("arquivado", false)
        .in("stage_id", stageIds)
        .order("valor_estimado", { ascending: false, nullsFirst: false })
        .limit(LIMITE);
      if (corretorIds) q = q.in("corretor_id", corretorIds);
      const { data: leads } = await q;
      if (!leads || leads.length === 0) return [];

      // 4) Resolve nome do corretor.
      const cids = [...new Set(leads.map((l) => l.corretor_id).filter(Boolean) as string[])];
      const nomeDe = new Map<string, string>();
      if (cids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", cids);
        for (const p of profs ?? []) nomeDe.set(p.user_id as string, (p.nome as string) ?? "Corretor");
      }

      return leads.map((l) => {
        const tipo = stageTipo.get(l.stage_id as string);
        return {
          id: l.id as string,
          nome: (l.nome as string) ?? "Lead",
          corretor_id: (l.corretor_id as string) ?? null,
          corretor_nome: l.corretor_id ? (nomeDe.get(l.corretor_id as string) ?? "Corretor") : "Sem dono",
          empreendimento: (l.empreendimento as string) ?? null,
          valor: (l.valor_estimado as number) ?? null,
          etapa: tipo === "contrato_gerado" ? "Contrato" : "Em Negociação",
          etapaTipo: (tipo === "contrato_gerado" ? "contrato_gerado" : "proposta"),
        } as NegocioTime;
      });
    },
  });
}
