import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import { PeriodoToggle } from "./PeriodoToggle";
import type { PeriodoV3 } from "@/hooks/useDashboardGerenteV3";

interface Props {
  nome: string;
  avatarUrl?: string | null;
  periodo: PeriodoV3;
  onPeriodoChange: (p: PeriodoV3) => void;
  onEditarMetas?: () => void;
  /** v4: ocultar o seletor de período (KPIs do v4 são fixos no mês). */
  hidePeriodoToggle?: boolean;
}

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function DashboardHeader({ nome, avatarUrl, periodo, onPeriodoChange, onEditarMetas, hidePeriodoToggle = false }: Props) {
  const primeiroNome = nome?.split(" ")[0] ?? "";
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 pb-2">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 ring-2 ring-primary/15">
          <AvatarImage src={avatarUrl ?? undefined} alt={nome} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {primeiroNome.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm text-muted-foreground">{saudacao()},</p>
          <h1 className="text-2xl font-semibold text-foreground leading-tight">{primeiroNome}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!hidePeriodoToggle && <PeriodoToggle value={periodo} onChange={onPeriodoChange} />}
        {onEditarMetas && (
          <Button variant="outline" size="sm" onClick={onEditarMetas} className="gap-2">
            <Settings2 className="h-4 w-4" />
            Metas
          </Button>
        )}
      </div>
    </header>
  );
}
