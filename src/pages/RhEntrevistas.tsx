import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AgendaEntrevistas from "@/components/rh/AgendaEntrevistas";
import { PageHeader } from "@/components/ui/PageHeader";
import { Briefcase } from "lucide-react";

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
    <div className="bg-[#f0f0f5] dark:bg-[#0e1525] p-6 -m-6 min-h-full space-y-4">
      <PageHeader
        title="Entrevistas"
        subtitle="Agendamento e acompanhamento"
        icon={<Briefcase size={18} strokeWidth={1.5} />}
      />
      <AgendaEntrevistas candidatos={candidatos} onKanbanUpdate={fetchCandidatos} />
    </div>
  );
}
