import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface BriefingItem {
  chave: "atrasadas" | "hoje" | "visitas" | "esfriando";
  label: string;
  valor: number;
  prompt: string;
}

/** Data de hoje em BRT (YYYY-MM-DD) */
function hojeBRT() {
  const agora = new Date();
  const brt = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(0, 10);
}

/**
 * Briefing proativo do HOMI: o que importa hoje para o usuário logado.
 * Só conta — os detalhes o HOMI traz quando o usuário clica no cartão.
 */
export function useHomiBriefing() {
  const { user } = useAuth();
  const [itens, setItens] = useState<BriefingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const hoje = hojeBRT();
    const seteDiasAtras = new Date(Date.now() - 7 * 86400000).toISOString();

    const tarefasBase = () =>
      supabase
        .from("pipeline_tarefas")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente")
        .eq("responsavel_id", user.id);

    const [atrasadas, hojeCount, visitas, esfriando] = await Promise.all([
      tarefasBase().lt("vence_em", hoje),
      tarefasBase().eq("vence_em", hoje),
      tarefasBase().eq("subtipo", "confirmar_visita"),
      supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .eq("corretor_id", user.id)
        .eq("arquivado", false)
        .lt("ultima_acao_at", seteDiasAtras),
    ]);

    setItens([
      {
        chave: "atrasadas",
        label: "Atrasadas",
        valor: atrasadas.count ?? 0,
        prompt: "O que eu tenho de atrasado agora? Lista curta, por prioridade.",
      },
      {
        chave: "hoje",
        label: "Para hoje",
        valor: hojeCount.count ?? 0,
        prompt: "O que eu tenho para hoje? Lista curta, na ordem que devo executar.",
      },
      {
        chave: "visitas",
        label: "Visitas a confirmar",
        valor: visitas.count ?? 0,
        prompt: "Quais visitas eu tenho que confirmar? Me dá a mensagem pronta de cada uma.",
      },
      {
        chave: "esfriando",
        label: "Leads esfriando",
        valor: esfriando.count ?? 0,
        prompt: "Quais leads estão esfriando? Me sugere o próximo passo de cada um.",
      },
    ]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  return { itens, loading, reload: load };
}
