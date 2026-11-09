/** Mutirão stores profile IDs; ordinary Oferta Ativa stores auth IDs. */
export interface OATentativaEvento {
  id: string;
  lead_id: string | null;
  corretor_id: string | null;
  canal: string | null;
  resultado: string | null;
  pontos: number | null;
  empreendimento: string | null;
  created_at: string;
}

export interface MutiraoEvento {
  id: string;
  pipeline_lead_id: string | null;
  corretor_id: string;
  resultado: string;
  origem: string | null;
  pontos: number;
  created_at: string;
}

export function normalizarLigacoesMutirao(rows: MutiraoEvento[], authPorPerfil: Map<string, string>): OATentativaEvento[] {
  return rows.flatMap((row) => {
    const authId = authPorPerfil.get(row.corretor_id);
    if (!authId || (row.origem ?? "mutirao") !== "mutirao" ||
      !["nao_atendeu", "sem_interesse", "aproveitado", "visita_agendada"].includes(row.resultado)) return [];
    return [{
      id: row.id, lead_id: row.pipeline_lead_id, corretor_id: authId,
      canal: "ligacao", resultado: ["aproveitado", "visita_agendada"].includes(row.resultado) ? "com_interesse" : row.resultado,
      pontos: row.pontos, empreendimento: null, created_at: row.created_at,
    }];
  });
}