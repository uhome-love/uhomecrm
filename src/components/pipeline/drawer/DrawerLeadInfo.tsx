// ─────────────────────────────────────────────────────────────────
// DrawerLeadInfo — Coluna esquerda (36%) do Drawer wide v3
//
// Estrutura espelha a coluna direita:
//   [Header fixo (shrink-0)] + [Body scrollável (ScrollArea flex-1)]
//
// O header fixo (avatar + nome + pílulas + contatos) recebe o mesmo
// padding-top da TabsList da direita (pt-4 = 16px), garantindo
// alinhamento visual constante independentemente do scroll.
//
// resetKey: ao mudar (ex. lead.id), zera scrollTop do viewport do
// Radix ScrollArea — evita que o body apareça "começando abaixo"
// quando o drawer permanece montado entre leads.
// ─────────────────────────────────────────────────────────────────
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLayoutEffect, useRef, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Conteúdo do header fixo (não rola). Espelha a TabsList da direita. */
  header?: ReactNode;
  resetKey?: string | number;
}

export default function DrawerLeadInfo({ children, header, resetKey }: Props) {
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
      className="hidden md:flex flex-col shrink-0 min-w-0 w-full md:w-[36%] md:max-w-[440px] border-r border-border/50 bg-[#fafafa] dark:bg-white/[0.02]"
      data-drawer-pane="info"
    >
      {header && (
        <div className="shrink-0 px-5 pt-4" data-drawer-header="info">
          {header}
        </div>
      )}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-4 space-y-3">
          {children}
        </div>
      </ScrollArea>
    </aside>
  );
}
