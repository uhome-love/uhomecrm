import { ReactNode } from "react";

interface Props {
  titulo: string;
  hint?: string;
  children: ReactNode;
}

/** Horizontal scrollable rail (Netflix style) */
export function TrilhaRail({ titulo, hint, children }: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
        {titulo}
        {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {children}
      </div>
    </section>
  );
}
