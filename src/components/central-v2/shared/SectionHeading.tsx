import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}

/**
 * Cabeçalho padronizado de seção da Central de Relatórios:
 * ícone em "chip" + título display + subtítulo opcional.
 */
export function SectionHeading({ icon: Icon, title, subtitle }: Props) {
  return (
    <div className="flex items-center gap-3 border-b border-border pb-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-lg leading-tight text-foreground sm:text-xl">{title}</h2>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}
