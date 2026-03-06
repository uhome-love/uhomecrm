import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { STATUS_LABELS, STATUS_COLORS, ORIGEM_LABELS, type Visita, type VisitaStatus } from "@/hooks/useVisitas";

interface Props {
  visitas: Visita[];
  onUpdateStatus: (id: string, status: VisitaStatus) => void;
  onEdit?: (visita: Visita) => void;
  showCorretor?: boolean;
}

export default function VisitasList({ visitas, onUpdateStatus, onEdit, showCorretor }: Props) {
  if (visitas.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma visita encontrada.</p>;
  }

  return (
    <div className="rounded-lg border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Data</TableHead>
            <TableHead className="text-xs">Hora</TableHead>
            <TableHead className="text-xs">Cliente</TableHead>
            <TableHead className="text-xs">Empreendimento</TableHead>
            <TableHead className="text-xs">Origem</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visitas.map(v => (
            <TableRow key={v.id} className="hover:bg-muted/30">
              <TableCell className="text-xs font-medium">
                {format(new Date(v.data_visita + "T12:00:00"), "dd/MM", { locale: ptBR })}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {v.hora_visita ? v.hora_visita.slice(0, 5) : "—"}
              </TableCell>
              <TableCell className="text-xs font-medium">{v.nome_cliente}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{v.empreendimento || "—"}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px]">
                  {ORIGEM_LABELS[v.origem] || v.origem}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={`text-[10px] ${STATUS_COLORS[v.status] || ""}`}>
                  {STATUS_LABELS[v.status] || v.status}
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {Object.entries(STATUS_LABELS)
                      .filter(([k]) => k !== v.status)
                      .map(([k, label]) => (
                        <DropdownMenuItem key={k} onClick={() => onUpdateStatus(v.id, k as VisitaStatus)}>
                          <ArrowRight className="h-3 w-3 mr-2" /> {label}
                        </DropdownMenuItem>
                      ))}
                    {onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(v)}>
                        Editar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
