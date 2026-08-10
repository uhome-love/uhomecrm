import RecrutamentoKanban from "@/components/rh/RecrutamentoKanban";

/** Meus Candidatos — kanban de recrutamento filtrado ao gerente logado. */
export default function GerenteCandidatos() {
  return (
    <RecrutamentoKanban
      scope="gerente"
      title="Meus Candidatos"
      subtitle="Candidatos de recrutamento atribuídos a você"
    />
  );
}
