import { useState, useRef } from "react";
import { type PdnEntry, type PdnSituacao } from "@/hooks/usePdn";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GripVertical, Flame, Thermometer, Snowflake, Building2, User } from "lucide-react";

interface Props {
  entries: PdnEntry[];
  readOnly?: boolean;
  onUpdate: (id: string, updates: Record<string, any>) => void;
  searchTerm: string;
  filterCorretor: string;
}

const COLUMNS: { key: PdnSituacao; label: string; icon: string; color: string; border: string }[] = [
  { key: "visita", label: "📋 Negócios (Visita)", icon: "📋", color: "bg-primary/10 text-primary", border: "border-primary/30" },
  { key: "gerado", label: "📄 Gerados", icon: "📄", color: "bg-amber-500/10 text-amber-600", border: "border-amber-500/30" },
  { key: "assinado", label: "✅ Assinados", icon: "✅", color: "bg-emerald-500/10 text-emerald-600", border: "border-emerald-500/30" },
];

const TEMP_CONFIG: Record<string, { icon: React.ReactNode; class: string; label: string }> = {
  quente: { icon: <Flame className="h-3 w-3" />, class: "bg-red-500/15 text-red-600 border-red-500/30", label: "Quente" },
  morno: { icon: <Thermometer className="h-3 w-3" />, class: "bg-amber-500/15 text-amber-600 border-amber-500/30", label: "Morno" },
  frio: { icon: <Snowflake className="h-3 w-3" />, class: "bg-blue-500/15 text-blue-600 border-blue-500/30", label: "Frio" },
};

function formatBRL(v: number | null) {
  if (!v) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function PdnKanban({ entries, readOnly, onUpdate, searchTerm, filterCorretor }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<PdnSituacao | null>(null);
  const dragRef = useRef<string | null>(null);

  const filtered = entries.filter(e => {
    if (searchTerm && !e.nome.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterCorretor && e.corretor !== filterCorretor) return false;
    return true;
  });

  const grouped = COLUMNS.map(col => ({
    ...col,
    items: filtered.filter(e => e.situacao === col.key),
    totalVgv: filtered.filter(e => e.situacao === col.key).reduce((s, e) => s + (e.vgv || 0), 0),
  }));

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (readOnly) return;
    dragRef.current = id;
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent, col: PdnSituacao) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(col);
  };

  const handleDragLeave = () => setDragOverCol(null);

  const handleDrop = (e: React.DragEvent, targetSituacao: PdnSituacao) => {
    e.preventDefault();
    setDragOverCol(null);
    setDraggedId(null);
    const id = dragRef.current;
    if (!id || readOnly) return;
    const entry = entries.find(en => en.id === id);
    if (!entry || entry.situacao === targetSituacao) return;
    onUpdate(id, { situacao: targetSituacao });
    dragRef.current = null;
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverCol(null);
    dragRef.current = null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 min-h-[400px]">
      {grouped.map(col => (
        <div
          key={col.key}
          className={`flex flex-col rounded-lg border-2 transition-colors ${
            dragOverCol === col.key ? `${col.border} bg-accent/50` : "border-border bg-card"
          }`}
          onDragOver={e => handleDragOver(e, col.key)}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, col.key)}
        >
          {/* Column header */}
          <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-lg ${col.color}`}>
            <span className="text-sm font-bold">{col.label}</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] h-5">{col.items.length}</Badge>
              {col.totalVgv > 0 && (
                <span className="text-[10px] font-semibold opacity-80">{formatBRL(col.totalVgv)}</span>
              )}
            </div>
          </div>

          {/* Cards */}
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-2 min-h-[100px]">
              {col.items.map(entry => {
                const temp = TEMP_CONFIG[entry.temperatura] || TEMP_CONFIG.morno;
                const isDragged = draggedId === entry.id;
                return (
                  <Card
                    key={entry.id}
                    draggable={!readOnly}
                    onDragStart={e => handleDragStart(e, entry.id)}
                    onDragEnd={handleDragEnd}
                    className={`p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${
                      isDragged ? "opacity-40 scale-95" : "opacity-100"
                    } ${!readOnly ? "hover:border-primary/40" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      {!readOnly && (
                        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Name */}
                        <p className="text-sm font-semibold text-foreground truncate">
                          {entry.nome || <span className="text-muted-foreground italic">Sem nome</span>}
                        </p>

                        {/* Empreendimento + Und */}
                        {(entry.empreendimento || entry.und) && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Building2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{entry.empreendimento}{entry.und ? ` · ${entry.und}` : ""}</span>
                          </div>
                        )}

                        {/* Corretor */}
                        {entry.corretor && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <User className="h-3 w-3 shrink-0" />
                            <span className="truncate">{entry.corretor}</span>
                          </div>
                        )}

                        {/* Bottom row: temperature + VGV */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <Badge variant="outline" className={`text-[10px] h-5 gap-1 ${temp.class}`}>
                            {temp.icon} {temp.label}
                          </Badge>
                          {entry.vgv ? (
                            <span className="text-[11px] font-bold text-foreground">{formatBRL(entry.vgv)}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
              {col.items.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  {readOnly ? "Nenhum registro" : "Arraste cards aqui"}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}
