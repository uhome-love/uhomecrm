import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreVertical, ArrowRight, FileSpreadsheet, CheckCircle2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { STATUS_LABELS, STATUS_COLORS, ORIGEM_LABELS, type Visita, type VisitaStatus } from "@/hooks/useVisitas";
import { useVisitaToPdn } from "@/hooks/useVisitaToPdn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  visitas: Visita[];
  onUpdateStatus: (id: string, status: VisitaStatus) => void;
  onEdit?: (visita: Visita) => void;
  onDelete?: (id: string) => void;
  showCorretor?: boolean;
}

export default function VisitasList({ visitas, onUpdateStatus, onEdit, onDelete, showCorretor }: Props) {
  const { convertToPdn } = useVisitaToPdn();

  if (visitas.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma visita encontrada.</p>;
  }

  const handleConvertToPdn = async (visita: Visita) => {
    // First ensure status is realizada
    if (visita.status !== "realizada") {
      onUpdateStatus(visita.id, "realizada");
    }
    await convertToPdn(visita);
  };

  return (
    <TooltipProvider>
      <div className="rounded-lg border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Data</TableHead>
              <TableHead className="text-xs">Hora</TableHead>
              <TableHead className="text-xs">Cliente</TableHead>
              {showCorretor && <TableHead className="text-xs">Corretor</TableHead>}
              <TableHead className="text-xs">Empreendimento</TableHead>
              <TableHead className="text-xs">Origem</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs text-center">PDN</TableHead>
              <TableHead className="text-xs w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visitas.map(v => {
              const hasPdn = !!(v as any).linked_pdn_id;
              return (
                <TableRow key={v.id} className="hover:bg-muted/30">
                  <TableCell className="text-xs font-medium">
                    {format(new Date(v.data_visita + "T12:00:00"), "dd/MM", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {v.hora_visita ? v.hora_visita.slice(0, 5) : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-medium">{v.nome_cliente}</TableCell>
                  {showCorretor && (
                    <TableCell className="text-xs text-muted-foreground">
                      {v.corretor_nome || "—"}
                    </TableCell>
                  )}
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
                  <TableCell className="text-center">
                    {hasPdn ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Já vinculado ao PDN</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : v.status === "realizada" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-primary hover:text-primary gap-1"
                        onClick={() => handleConvertToPdn(v)}
                      >
                        <FileSpreadsheet className="h-3 w-3" /> PDN
                      </Button>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
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
                        {v.status === "realizada" && !hasPdn && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleConvertToPdn(v)} className="text-primary">
                              <FileSpreadsheet className="h-3 w-3 mr-2" /> Enviar para PDN
                            </DropdownMenuItem>
                          </>
                        )}
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(v)}>
                            Editar
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                if (window.confirm("Tem certeza que deseja excluir esta visita?")) {
                                  onDelete(v.id);
                                }
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3 w-3 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
