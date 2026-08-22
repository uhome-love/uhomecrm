/**
 * Menu de ações (⋯) dos contatos da LIA — visível apenas para o CEO (admin).
 * Usado na aba "Leads e conversas" e no Kanban.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ban, MoreVertical, Trash2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import LiaDescartarDialog from "./LiaDescartarDialog";
import LiaExcluirDialog from "./LiaExcluirDialog";
import type { LiaEstado } from "./useLiaHub";

interface Props {
  estado: LiaEstado;
  className?: string;
}

export default function LiaLeadAcoesMenu({ estado, className }: Props) {
  const { roles } = useUserRole();
  const [descartar, setDescartar] = useState(false);
  const [excluir, setExcluir] = useState(false);

  const isAdmin = (roles ?? []).includes("admin");
  if (!isAdmin) return null;

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div onClick={stop} className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            aria-label="Ações do contato"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={stop}>
          <DropdownMenuItem onSelect={() => setDescartar(true)}>
            <Ban className="mr-2 h-4 w-4" /> Descartar / Inativar
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onSelect={() => setExcluir(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Excluir da LIA
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LiaDescartarDialog estado={estado} open={descartar} onOpenChange={setDescartar} />
      <LiaExcluirDialog estado={estado} open={excluir} onOpenChange={setExcluir} />
    </div>
  );
}
