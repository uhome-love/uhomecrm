// ─────────────────────────────────────────────────────────────────
// DrawerTimeline — Coluna direita (64%) do Drawer wide v3
//
// Shell de layout: largura, background white, scroll vertical.
// Recebe children (tabs + conteúdo) do orquestrador PipelineLeadDetail.
// ─────────────────────────────────────────────────────────────────
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export default function DrawerTimeline({ children }: Props) {
  return (
    <section
      className="flex-1 flex flex-col min-w-0 bg-card"
      data-drawer-pane="timeline"
    >
      {children}
    </section>
  );
}
