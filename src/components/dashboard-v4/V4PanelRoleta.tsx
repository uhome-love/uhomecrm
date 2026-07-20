import { PresencaSummaryCard } from "@/components/roleta/PresencaSummaryCard";

interface Props {
  gestorId: string | undefined;
}

/**
 * V4PanelRoleta — card compacto de presença no dashboard do gestor.
 * A gestão completa fica em /roleta/presenca.
 */
export function V4PanelRoleta({ gestorId }: Props) {
  return <PresencaSummaryCard scope="gestor" gestorId={gestorId} />;
}
