// ─────────────────────────────────────────────────────────────────
// DrawerLeadInfo — Coluna esquerda (36%) do Drawer wide v3
//
// Shell de layout: largura, background off-white, padding, scroll.
// Recebe children do orquestrador PipelineLeadDetail.
// ─────────────────────────────────────────────────────────────────
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export default function DrawerLeadInfo({ children }: Props) {
  return (
    <aside
      className="hidden md:flex flex-col shrink-0 w-full md:w-[36%] md:max-w-[440px] border-r border-border/50 bg-[#fafafa] dark:bg-white/[0.02]"
      data-drawer-pane="info"
    >
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-4 space-y-3">
          {children}
        </div>
      </ScrollArea>
    </aside>
  );
}
