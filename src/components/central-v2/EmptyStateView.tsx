import { Construction } from "lucide-react";
import { getSection, type CentralSectionId } from "./sections";

interface Props {
  secao: CentralSectionId;
}

export function EmptyStateView({ secao }: Props) {
  const s = getSection(secao);
  const Icon = s.icon;
  return (
    <div className="central-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h2 className="font-display text-2xl text-foreground">{s.label}</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Em construção — dados desta seção entram na próxima fase.
      </p>
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
        <Construction className="h-3.5 w-3.5" />
        Fase 0.5 · Prompt 6
      </div>
    </div>
  );
}
