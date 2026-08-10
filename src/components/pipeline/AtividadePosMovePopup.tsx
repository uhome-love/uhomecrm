import RegistrarAtividadeModal from "./RegistrarAtividadeModal";

/**
 * AtividadePosMovePopup — aparece leve DEPOIS de mover um lead (o move já
 * aconteceu). É só o RegistrarAtividadeModal com um subtítulo de contexto
 * ("movido para X"). A regra de ouro e o salvar vivem no modal reutilizável.
 */
interface Props {
  lead: { id: string; nome: string } | null;
  etapaNome?: string;
  onClose: () => void;
}

export default function AtividadePosMovePopup({ lead, etapaNome, onClose }: Props) {
  return (
    <RegistrarAtividadeModal
      lead={lead}
      subtitulo={`movido${etapaNome ? ` para ${etapaNome}` : ""} · registre e agende o próximo passo (opcional)`}
      onClose={onClose}
    />
  );
}
