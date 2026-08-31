import RegistrarAtividadeModal from "./RegistrarAtividadeModal";

/**
 * AtividadePosMovePopup — aparece DEPOIS de mover um lead (o move já aconteceu).
 * É o RegistrarAtividadeModal em modo PÓS-MOVE OBRIGATÓRIO: a observação é
 * exigida (a história nunca nasce vazia), o "Pular" vira "Desfazer" (reverte a
 * etapa) e a seção "Avançar etapa" some (redundante, o move já ocorreu).
 */
interface Props {
  lead: { id: string; nome: string } | null;
  etapaNome?: string;
  /** Reverte o move (volta o lead pra etapa de origem) quando o usuário desfaz. */
  onDesfazer?: () => void;
  onClose: () => void;
}

export default function AtividadePosMovePopup({ lead, etapaNome, onDesfazer, onClose }: Props) {
  return (
    <RegistrarAtividadeModal
      lead={lead}
      subtitulo={`movido${etapaNome ? ` para ${etapaNome}` : ""} · registre o que aconteceu (obrigatório)`}
      exigirObservacao
      esconderAvancar
      onDesfazer={onDesfazer}
      onClose={onClose}
    />
  );
}
