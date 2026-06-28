// ─────────────────────────────────────────────────────────────────
// DrawerLeadInfo — Coluna esquerda (36%) do Drawer wide v3
//
// Estrutura espelha a coluna direita:
//   [Header fixo (shrink-0)] + [Body scrollável (overflow-y-auto flex-1)]
//
// O header fixo (avatar + nome + pílulas + contatos) recebe o mesmo
// padding-top da TabsList da direita (pt-4 = 16px), garantindo
// alinhamento visual constante independentemente do scroll.
//
// resetKey: ao mudar (ex. lead.id), zera scrollTop do container de
// rolagem — evita que o body apareça "começando abaixo" quando o
// drawer permanece montado entre leads.
//
// IMPORTANTE: usamos um container de rolagem nativo (overflow-y-auto)
// em vez do Radix ScrollArea. O viewport do Radix aplica display:table
// no wrapper interno, fazendo o conteúdo assumir sua largura preferida
// (max-content) e transbordar o painel em larguras de laptop
// (1024–1536px), sendo cortado na divisória. O div nativo com
// overflow-x-hidden respeita 100% da largura do painel.
// ─────────────────────────────────────────────────────────────────
import { useLayoutEffect, useRef, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Conteúdo do header fixo (não rola). Espelha a TabsList da direita. */
  header?: ReactNode;
  resetKey?: string | number;
}

export default function DrawerLeadInfo({ children, header, resetKey }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [resetKey]);

  return (
    <aside
      className="hidden md:flex flex-col shrink-0 min-w-0 w-full md:w-[36%] md:max-w-[440px] border-r border-border/50 bg-[#fafafa] dark:bg-white/[0.02]"
      data-drawer-pane="info"
    >
      {header && (
        <div className="shrink-0 px-5 pt-4" data-drawer-header="info">
          {header}
        </div>
      )}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="w-full min-w-0 px-5 py-4 space-y-3">
          {children}
        </div>
      </div>
    </aside>
  );
}
