import { useMemo } from "react";
import { useLiaEstados, useLiaFollowups } from "./useLiaHub";

/** Contadores dos botões da área Conversas (mesmos dados das telas). */
export function useConversasContagem(): Record<string, number | undefined> {
  const { data: estados } = useLiaEstados();
  const { data: followups } = useLiaFollowups();
  return useMemo(() => {
    const pend = (followups ?? []).filter(
      (f) => (f.status === "aprovado" || f.status === "pendente") && !f.enviado_em,
    ).length;
    return {
      leads: estados?.length,
      kanban: estados?.length,
      followups: followups ? pend : undefined,
    };
  }, [estados, followups]);
}
