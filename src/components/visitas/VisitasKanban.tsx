import { useState, type DragEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Building2, CheckCircle2, FileSpreadsheet, Trash2, User, Link2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { STATUS_LABELS, STATUS_COLORS, ORIGEM_LABELS, type Visita, type VisitaStatus } from "@/hooks/useVisitas";
import { useVisitaToPdn } from "@/hooks/useVisitaToPdn";

const KANBAN_COLUMNS: VisitaStatus[] = ["marcada", "confirmada", "realizada", "reagendada", "cancelada", "no_show"];

const COLUMN_ICONS: Record<string, string> = {
  marcada: "📅",
  confirmada: "✅",
  realizada: "🏠",
  reagendada: "🔄",
  cancelada: "❌",
  no_show: "👻",
};

interface Props {
  visitas: Visita[];
  onUpdateStatus: (id: string, status: VisitaStatus) => void;
  onDelete?: (id: string) => void;
}

export default function VisitasKanban({ visitas, onUpdateStatus, onDelete }: Props) {
  const { convertToPdn } = useVisitaToPdn();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<VisitaStatus | null>(null);

  const handleDragStart = (e: DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    setDraggingId(id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: DragEvent, col: VisitaStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(col);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e: DragEvent, targetCol: VisitaStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) {
      const visita = visitas.find(v => v.id === id);
      if (visita && visita.status !== targetCol) {
        onUpdateStatus(id, targetCol);
      }
    }
    setDraggingId(null);
    setDragOverCol(null);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
      {KANBAN_COLUMNS.map(col => {
        const items = visitas
          .filter(v => v.status === col)
          .sort((a, b) => {
            const dateComp = b.data_visita.localeCompare(a.data_visita);
            if (dateComp !== 0) return dateComp;
            const timeA = a.hora_visita || "99:99";
            const timeB = b.hora_visita || "99:99";
            return timeA.localeCompare(timeB);
          });
        const isOver = dragOverCol === col;
        return (
          <div
            key={col}
            className="space-y-2"
            onDragOver={(e) => handleDragOver(e, col)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col)}
          >
            <div className="flex items-center gap-2 px-2">
              <span className="text-sm">{COLUMN_ICONS[col]}</span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {STATUS_LABELS[col]}
              </h3>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{items.length}</Badge>
            </div>

            <div className={`space-y-2 min-h-[100px] rounded-lg transition-colors duration-150 p-1 ${
              isOver ? "bg-primary/10 ring-2 ring-primary/30 ring-inset" : ""
            }`}>
              {items.map(v => {
                  const hasPdn = !!(v as any).linked_pdn_id;
                  const hasPipeline = !!(v as any).pipeline_lead_id;
                  const isDragging = draggingId === v.id;
                return (
                  <Card
                    key={v.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, v.id)}
                    onDragEnd={handleDragEnd}
                    className={`p-3 space-y-2 transition-all cursor-grab active:cursor-grabbing ${
                      isDragging ? "opacity-40 scale-95" : "hover:shadow-md"
                    }`}
                  >
                     <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold truncate flex-1">{v.nome_cliente}</p>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {hasPipeline && <Link2 className="h-3.5 w-3.5 text-primary" />}
                        {hasPdn && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                      </div>
                    </div>

                    {v.corretor_nome && (
                      <div className="flex items-center gap-1 text-[10px] text-primary font-medium">
                        <User className="h-3 w-3" />
                        <span className="truncate">{v.corretor_nome}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(v.data_visita + "T12:00:00"), "dd/MM", { locale: ptBR })}
                      {v.hora_visita && (
                        <>
                          <Clock className="h-3 w-3 ml-1" />
                          {v.hora_visita.slice(0, 5)}
                        </>
                      )}
                    </div>

                    {v.empreendimento && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        <span className="truncate">{v.empreendimento}</span>
                      </div>
                    )}

                    <Badge variant="outline" className="text-[9px]">
                      {ORIGEM_LABELS[v.origem] || v.origem}
                    </Badge>

                    {/* Quick status transitions */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {col === "marcada" && (
                        <>
                          <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5" onClick={() => onUpdateStatus(v.id, "confirmada")}>
                            Confirmar
                          </Button>
                          <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5" onClick={() => onUpdateStatus(v.id, "cancelada")}>
                            Cancelar
                          </Button>
                        </>
                      )}
                      {col === "confirmada" && (
                        <>
                          <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5" onClick={() => onUpdateStatus(v.id, "realizada")}>
                            Realizada
                          </Button>
                          <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5" onClick={() => onUpdateStatus(v.id, "no_show")}>
                            No Show
                          </Button>
                        </>
                      )}
                      {col === "realizada" && !hasPdn && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-5 text-[9px] px-1.5 text-primary border-primary/30"
                          onClick={() => convertToPdn(v)}
                        >
                          <FileSpreadsheet className="h-3 w-3 mr-0.5" /> Enviar PDN
                        </Button>
                      )}
                      {col === "reagendada" && (
                        <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5" onClick={() => onUpdateStatus(v.id, "confirmada")}>
                          Confirmar
                        </Button>
                      )}
                      {col === "cancelada" && (
                        <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5" onClick={() => onUpdateStatus(v.id, "reagendada")}>
                          Reagendar
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-5 text-[9px] px-1.5 text-destructive border-destructive/30"
                          onClick={() => {
                            if (window.confirm("Tem certeza que deseja excluir esta visita?")) {
                              onDelete(v.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}

              {items.length === 0 && (
                <p className="text-[10px] text-muted-foreground/50 text-center py-4">Nenhuma</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
