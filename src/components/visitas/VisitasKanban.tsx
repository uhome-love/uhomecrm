import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Building2, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { STATUS_LABELS, STATUS_COLORS, ORIGEM_LABELS, type Visita, type VisitaStatus } from "@/hooks/useVisitas";
import { useVisitaToPdn } from "@/hooks/useVisitaToPdn";

const KANBAN_COLUMNS: VisitaStatus[] = ["marcada", "confirmada", "realizada", "reagendada", "cancelada"];

const COLUMN_ICONS: Record<string, string> = {
  marcada: "📅",
  confirmada: "✅",
  realizada: "🏠",
  reagendada: "🔄",
  cancelada: "❌",
};

interface Props {
  visitas: Visita[];
  onUpdateStatus: (id: string, status: VisitaStatus) => void;
}

export default function VisitasKanban({ visitas, onUpdateStatus }: Props) {
  const { convertToPdn } = useVisitaToPdn();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {KANBAN_COLUMNS.map(col => {
        const items = visitas.filter(v => v.status === col);
        return (
          <div key={col} className="space-y-2">
            <div className="flex items-center gap-2 px-2">
              <span className="text-sm">{COLUMN_ICONS[col]}</span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {STATUS_LABELS[col]}
              </h3>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{items.length}</Badge>
            </div>

            <div className="space-y-2 min-h-[100px]">
              {items.map(v => {
                const hasPdn = !!(v as any).linked_pdn_id;
                return (
                  <Card key={v.id} className="p-3 space-y-2 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold truncate flex-1">{v.nome_cliente}</p>
                      {hasPdn && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 ml-1" />}
                    </div>

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
