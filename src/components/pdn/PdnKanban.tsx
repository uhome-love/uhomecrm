import { useState, useRef } from "react";
import { type PdnEntry, type PdnSituacao } from "@/hooks/usePdn";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { GripVertical, Flame, Thermometer, Snowflake, Building2, User, AlertTriangle, Calendar, Target } from "lucide-react";
import { calcProbabilidade, calcRisco, type RiscoNivel } from "@/lib/pdnScoring";
import { differenceInDays } from "date-fns";

interface Props {
  entries: PdnEntry[];
  readOnly?: boolean;
  onUpdate: (id: string, updates: Record<string, any>) => void;
  searchTerm: string;
  filterCorretor: string;
}

const COLUMNS: { key: PdnSituacao; label: string; color: string; border: string }[] = [
  { key: "visita", label: "📋 Negócios (Visita)", color: "bg-primary/10 text-primary", border: "border-primary/30" },
  { key: "gerado", label: "📄 Gerados", color: "bg-amber-500/10 text-amber-600", border: "border-amber-500/30" },
  { key: "assinado", label: "✅ Assinados", color: "bg-emerald-500/10 text-emerald-600", border: "border-emerald-500/30" },
  { key: "caiu", label: "❌ Caiu", color: "bg-destructive/10 text-destructive", border: "border-destructive/30" },
];

const TEMP_CONFIG: Record<string, { icon: React.ReactNode; class: string; label: string }> = {
  quente: { icon: <Flame className="h-3 w-3" />, class: "bg-red-500/15 text-red-600 border-red-500/30", label: "Quente" },
  morno: { icon: <Thermometer className="h-3 w-3" />, class: "bg-amber-500/15 text-amber-600 border-amber-500/30", label: "Morno" },
  frio: { icon: <Snowflake className="h-3 w-3" />, class: "bg-blue-500/15 text-blue-600 border-blue-500/30", label: "Frio" },
};

const RISCO_CONFIG: Record<RiscoNivel, { emoji: string; class: string; label: string }> = {
  seguro: { emoji: "🟢", class: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", label: "Seguro" },
  atencao: { emoji: "🟡", class: "bg-amber-500/15 text-amber-600 border-amber-500/30", label: "Atenção" },
  risco: { emoji: "🔴", class: "bg-red-500/15 text-red-600 border-red-500/30", label: "Risco" },
};

function formatBRL(v: number | null) {
  if (!v) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function PdnKanban({ entries, readOnly, onUpdate, searchTerm, filterCorretor }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<PdnSituacao | null>(null);
  const [editingMotivo, setEditingMotivo] = useState<string | null>(null);
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

    if (targetSituacao === "caiu") {
      onUpdate(id, { situacao: targetSituacao });
      setEditingMotivo(id);
    } else {
      onUpdate(id, { situacao: targetSituacao, motivo_queda: null });
    }
    dragRef.current = null;
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverCol(null);
    dragRef.current = null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 min-h-[400px]">
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
                const isCaiu = entry.situacao === "caiu";
                const isAssinado = entry.situacao === "assinado";
                const prob = calcProbabilidade(entry);
                const risco = calcRisco(entry);
                const riscoConf = RISCO_CONFIG[risco.nivel];
                const semProximaAcao = !isCaiu && !isAssinado && (!entry.proxima_acao || !entry.proxima_acao.trim());
                const diasParado = differenceInDays(new Date(), new Date(entry.updated_at));

                return (
                  <Card
                    key={entry.id}
                    draggable={!readOnly}
                    onDragStart={e => handleDragStart(e, entry.id)}
                    onDragEnd={handleDragEnd}
                    className={`p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${
                      isDragged ? "opacity-40 scale-95" : "opacity-100"
                    } ${!readOnly ? "hover:border-primary/40" : ""} ${isCaiu ? "border-destructive/20 bg-destructive/5" : ""} ${
                      risco.nivel === "risco" && !isCaiu && !isAssinado ? "border-red-500/30" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!readOnly && (
                        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Name + risk badge */}
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {entry.nome || <span className="text-muted-foreground italic">Sem nome</span>}
                          </p>
                          {!isCaiu && !isAssinado && (
                            <span className="text-[9px] shrink-0" title={riscoConf.label}>{riscoConf.emoji}</span>
                          )}
                        </div>

                        {/* Und */}
                        {entry.und && (
                          <p className="text-[11px] text-muted-foreground">Und: {entry.und}</p>
                        )}

                        {/* Empreendimento */}
                        {entry.empreendimento && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Building2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{entry.empreendimento}</span>
                          </div>
                        )}

                        {/* Corretor */}
                        {entry.corretor && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <User className="h-3 w-3 shrink-0" />
                            <span className="truncate">{entry.corretor}</span>
                          </div>
                        )}

                        {/* VGV */}
                        {entry.vgv ? (
                          <p className="text-[11px] font-bold text-foreground">{formatBRL(entry.vgv)}</p>
                        ) : null}

                        {/* Probabilidade */}
                        {!isCaiu && !isAssinado && (
                          <div className="flex items-center gap-1.5">
                            <Target className="h-3 w-3 text-muted-foreground" />
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  prob >= 70 ? "bg-emerald-500" : prob >= 40 ? "bg-amber-500" : "bg-red-500"
                                }`}
                                style={{ width: `${prob}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-semibold text-muted-foreground">{prob}%</span>
                          </div>
                        )}

                        {/* Próxima ação */}
                        {entry.proxima_acao && entry.proxima_acao.trim() && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span className="truncate">{entry.proxima_acao}</span>
                            {entry.data_proxima_acao && <span className="shrink-0 font-medium">· {entry.data_proxima_acao}</span>}
                          </div>
                        )}

                        {/* Alert: sem próxima ação */}
                        {semProximaAcao && (
                          <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-500/10 rounded px-1.5 py-0.5">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>Sem próxima ação</span>
                          </div>
                        )}

                        {/* Alert: negócio parado */}
                        {!isCaiu && !isAssinado && diasParado >= 3 && (
                          <div className={`flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 ${
                            diasParado >= 7 ? "text-red-700 bg-red-500/20" :
                            diasParado >= 5 ? "text-red-600 bg-red-500/10" :
                            "text-amber-600 bg-amber-500/10"
                          }`}>
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>{diasParado >= 5 ? "Parado" : "Sem atualização"} há {diasParado} dias</span>
                          </div>
                        )}

                        {/* Objeção */}
                        {entry.objecao_cliente && (
                          <Badge variant="outline" className="text-[9px] h-4 gap-0.5 border-muted-foreground/30">
                            💬 {entry.objecao_cliente}
                          </Badge>
                        )}

                        {/* Motivo da queda */}
                        {isCaiu && (
                          <div className="mt-1">
                            {editingMotivo === entry.id ? (
                              <Input
                                autoFocus
                                className="h-7 text-xs"
                                placeholder="Motivo da queda..."
                                defaultValue={entry.motivo_queda || ""}
                                onBlur={(e) => {
                                  onUpdate(entry.id, { motivo_queda: e.target.value });
                                  setEditingMotivo(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    onUpdate(entry.id, { motivo_queda: (e.target as HTMLInputElement).value });
                                    setEditingMotivo(null);
                                  }
                                }}
                              />
                            ) : (
                              <p
                                className="text-[11px] text-destructive/80 italic cursor-pointer hover:underline"
                                onClick={() => !readOnly && setEditingMotivo(entry.id)}
                              >
                                {entry.motivo_queda ? `❌ ${entry.motivo_queda}` : "Clique para informar motivo da queda"}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Bottom row: temperature */}
                        {!isCaiu && (
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <Badge variant="outline" className={`text-[10px] h-5 gap-1 ${temp.class}`}>
                              {temp.icon} {temp.label}
                            </Badge>
                          </div>
                        )}
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
