// ─────────────────────────────────────────────────────────────────
// DrawerLeadInfo — Coluna esquerda (36%) do Drawer wide v3
//
// Shell de layout: largura, background off-white, padding, scroll.
// Recebe children do orquestrador PipelineLeadDetail.
//
// resetKey: ao mudar (ex. lead.id), zera scrollTop do viewport do
// Radix ScrollArea — evita que o conteúdo apareça "começando abaixo"
// quando o drawer permanece montado entre leads.
// ─────────────────────────────────────────────────────────────────
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLayoutEffect, useRef, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  resetKey?: string | number;
}

export default function DrawerLeadInfo({ children, resetKey }: Props) {
  const asideRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const vp = asideRef.current?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]"
    );
    if (vp) vp.scrollTop = 0;
  }, [resetKey]);

  return (
    <aside
      ref={asideRef}
      className="hidden md:flex flex-col shrink-0 w-full md:w-[36%] md:max-w-[440px] border-r border-border/50 bg-[#fafafa] dark:bg-white/[0.02]"
      data-drawer-pane="info"
    >
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 pt-2 pb-4 space-y-3">
          {children}
        </div>
      </ScrollArea>
    </aside>
  );
}
