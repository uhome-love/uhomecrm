import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AgendaEntrevistas from "@/components/rh/AgendaEntrevistas";

interface Candidato {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  observacoes: string | null;
  etapa: string;
  created_at: string;
}

export default function RhEntrevistas() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);

  const fetchCandidatos = async () => {
    const { data } = await supabase.from("rh_candidatos" as any).select("*").order("created_at", { ascending: false });
    if (data) setCandidatos(data as any);
  };

  useEffect(() => { fetchCandidatos(); }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">📅 Agenda de Entrevistas</h1>
      <AgendaEntrevistas candidatos={candidatos} onKanbanUpdate={fetchCandidatos} />
    </div>
  );
}
