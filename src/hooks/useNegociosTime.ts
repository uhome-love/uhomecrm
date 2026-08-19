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

      // 3) Leads nas etapas avançadas. Ordenação real é por valor do negócio
      //    (tabela negocios), então buscamos um teto e ordenamos no cliente.
      let q = supabase
        .from("pipeline_leads")
        .select("id, nome, corretor_id, empreendimento, valor_estimado, stage_id")
        .eq("arquivado", false)
        .in("stage_id", stageIds)
        .limit(120);
      if (corretorIds) q = q.in("corretor_id", corretorIds);
      const { data: leads } = await q;
      if (!leads || leads.length === 0) return [];
      const leadIds = leads.map((l) => l.id as string);

      // 4) Valor real do negócio (proposta, senão VGV). Vem da tabela `negocios`,
      //    ligada por pipeline_lead_id. Um lead pode ter mais de um negócio → maior.
      const valorDe = new Map<string, number>();
      const { data: negs } = await supabase
        .from("negocios")
        .select("pipeline_lead_id, proposta_valor, vgv_final, vgv_estimado")
        .in("pipeline_lead_id", leadIds);
      for (const n of negs ?? []) {
        const lid = n.pipeline_lead_id as string | null;
        if (!lid) continue;
        const v = (n.proposta_valor as number) || (n.vgv_final as number) || (n.vgv_estimado as number) || 0;
        if (v > 0 && v > (valorDe.get(lid) ?? 0)) valorDe.set(lid, v);
      }

      // 5) Resolve nome do corretor.
      const cids = [...new Set(leads.map((l) => l.corretor_id).filter(Boolean) as string[])];
      const nomeDe = new Map<string, string>();
      if (cids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", cids);
        for (const p of profs ?? []) nomeDe.set(p.user_id as string, (p.nome as string) ?? "Corretor");
      }

      const lista: NegocioTime[] = leads.map((l) => {
        const tipo = stageTipo.get(l.stage_id as string);
        const valor = valorDe.get(l.id as string) ?? (l.valor_estimado as number) ?? null;
        return {
          id: l.id as string,
          nome: (l.nome as string) ?? "Lead",
          corretor_id: (l.corretor_id as string) ?? null,
          corretor_nome: l.corretor_id ? (nomeDe.get(l.corretor_id as string) ?? "Corretor") : "Sem dono",
          empreendimento: (l.empreendimento as string) ?? null,
          valor: valor && valor > 0 ? valor : null,
          etapa: tipo === "contrato_gerado" ? "Contrato" : "Em Negociação",
          etapaTipo: (tipo === "contrato_gerado" ? "contrato_gerado" : "proposta"),
        } as NegocioTime;
      });

      // Contrato antes de Em Negociação; dentro, maior valor primeiro.
      lista.sort((a, b) => {
        if (a.etapaTipo !== b.etapaTipo) return a.etapaTipo === "contrato_gerado" ? -1 : 1;
        return (b.valor ?? 0) - (a.valor ?? 0);
      });
      return lista.slice(0, LIMITE);
    },
  });
}
