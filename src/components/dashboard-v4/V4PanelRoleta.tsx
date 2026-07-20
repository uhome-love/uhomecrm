import { PresencaRoletaPanel } from "@/components/roleta/PresencaRoletaPanel";

interface Props {
  gestorId: string | undefined;
}

/**
 * V4PanelRoleta — wrapper fino em torno do painel compartilhado.
 * A lógica vive em `PresencaRoletaPanel` e é usada também no dashboard do CEO.
 */
export function V4PanelRoleta({ gestorId }: Props) {
  return <PresencaRoletaPanel scope="gestor" gestorId={gestorId} />;
}
