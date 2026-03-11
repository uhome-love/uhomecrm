import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SlidersHorizontal, X, Save, Star, CalendarIcon, Trash2 } from "lucide-react";
import { format, differenceInHours, differenceInDays, startOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, differenceInDaysSafe, differenceInHoursSafe, parseDateTimeSafe } from "@/lib/utils";
import type { PipelineLead, PipelineStage, PipelineSegmento } from "@/hooks/usePipeline";

export interface PipelineFilters {
  search: string;
  stages: string[];
  corretores: string[];
  scoreMin: number;
  temperaturas: string[];
  origens: string[];
  segmentos: string[];
  empreendimentos: string[];
  diasSemAcao: string; // "" | "1" | "3" | "7"
  periodoEntrada: string; // "" | "hoje" | "semana" | "mes" | "custom"
  periodoCustomStart?: Date;
  periodoCustomEnd?: Date;
  comVisita: string; // "" | "sim" | "nao"
  slaStatus: string; // "" | "ok" | "warning" | "breach"
  gerenteFilter: string; // "all" | "sem_gerente" | "com_gerente" | "criticos"
}

export const EMPTY_FILTERS: PipelineFilters = {
  search: "",
  stages: [],
  corretores: [],
  scoreMin: 0,
  temperaturas: [],
  origens: [],
  segmentos: [],
  empreendimentos: [],
  diasSemAcao: "",
  periodoEntrada: "",
  comVisita: "",
  slaStatus: "",
  gerenteFilter: "all",
};

interface SavedFilter {
  name: string;
  filters: PipelineFilters;
  isPreset?: boolean;
}

const STORAGE_KEY = "pipeline-saved-filters";

function loadSavedFilters(): SavedFilter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function persistSavedFilters(filters: SavedFilter[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Ignore storage errors (privacy mode / blocked storage)
  }
}

const PRESETS: SavedFilter[] = [
  {
    name: "🔥 Leads quentes hoje",
    isPreset: true,
    filters: { ...EMPTY_FILTERS, temperaturas: ["quente"], periodoEntrada: "hoje" },
  },
  {
    name: "🚨 SLA expirado",
    isPreset: true,
    filters: { ...EMPTY_FILTERS, slaStatus: "breach" },
  },
  {
    name: "📅 Aguardando visita",
    isPreset: true,
    filters: { ...EMPTY_FILTERS, comVisita: "sim" },
  },
];

// Calculated temperature (mirrors PipelineCard logic)
function getCalcTemp(lead: PipelineLead): string {
  const refDate = lead.updated_at || lead.created_at;
  const hours = differenceInHoursSafe(refDate) ?? Number.POSITIVE_INFINITY;
  const isIndicacao = (lead.origem || "").toLowerCase().includes("indicaç") || (lead.origem || "").toLowerCase().includes("indicac");
  if (hours < 2 || isIndicacao) return "quente";
  if (hours < 24) return "morno";
  if (hours < 72) return "frio";
  return "gelado";
}

export function applyFilters(
  leads: PipelineLead[],
  filters: PipelineFilters,
  stages: PipelineStage[],
): PipelineLead[] {
  let result = leads;

  if (filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    result = result.filter(l =>
      l.nome.toLowerCase().includes(q) ||
      l.telefone?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.empreendimento?.toLowerCase().includes(q)
    );
  }

  if (filters.stages.length > 0) {
    result = result.filter(l => filters.stages.includes(l.stage_id));
  }

  if (filters.corretores.length > 0) {
    result = result.filter(l => l.corretor_id && filters.corretores.includes(l.corretor_id));
  }

  if (filters.scoreMin > 0) {
    result = result.filter(l => {
      const score = calculateLeadScore(l as any);
      return score.score >= filters.scoreMin;
    });
  }

  if (filters.temperaturas.length > 0) {
    result = result.filter(l => {
      const temp = l.temperatura || getCalcTemp(l);
      return filters.temperaturas.includes(temp);
    });
  }

  if (filters.origens.length > 0) {
    result = result.filter(l => l.origem && filters.origens.includes(l.origem));
  }

  if (filters.segmentos.length > 0) {
    result = result.filter(l => l.segmento_id && filters.segmentos.includes(l.segmento_id));
  }

  if (filters.empreendimentos.length > 0) {
    result = result.filter(l => l.empreendimento && filters.empreendimentos.includes(l.empreendimento));
  }

  if (filters.diasSemAcao) {
    const minDays = parseInt(filters.diasSemAcao);
    result = result.filter(l => {
      const days = differenceInDays(new Date(), new Date(l.stage_changed_at));
      return days >= minDays;
    });
  }

  if (filters.periodoEntrada) {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;
    if (filters.periodoEntrada === "hoje") start = startOfDay(now);
    else if (filters.periodoEntrada === "semana") start = startOfWeek(now, { weekStartsOn: 1 });
    else if (filters.periodoEntrada === "mes") start = startOfMonth(now);
    else if (filters.periodoEntrada === "custom") {
      start = filters.periodoCustomStart || null;
      end = filters.periodoCustomEnd || null;
    }
    if (start) {
      result = result.filter(l => {
        const d = new Date(l.created_at);
        if (end) return d >= start! && d <= end;
        return d >= start!;
      });
    }
  }

  if (filters.comVisita === "sim") {
    // leads in "visita" type stages
    const visitaStageIds = stages.filter(s => s.tipo === "visita" || s.nome.toLowerCase().includes("visita")).map(s => s.id);
    result = result.filter(l => visitaStageIds.includes(l.stage_id));
  } else if (filters.comVisita === "nao") {
    const visitaStageIds = stages.filter(s => s.tipo === "visita" || s.nome.toLowerCase().includes("visita")).map(s => s.id);
    result = result.filter(l => !visitaStageIds.includes(l.stage_id));
  }

  if (filters.slaStatus) {
    result = result.filter(l => {
      const stage = stages.find(s => s.id === l.stage_id);
      if (!stage) return false;
      const sla = getSlaStatus(stage.tipo, l.stage_changed_at);
      return sla.status === filters.slaStatus;
    });
  }

  if (filters.gerenteFilter === "sem_gerente") result = result.filter(l => !l.gerente_id);
  else if (filters.gerenteFilter === "com_gerente") result = result.filter(l => !!l.gerente_id);
  else if (filters.gerenteFilter === "criticos") result = result.filter(l => l.complexidade_score >= 40 && !l.gerente_id);

  return result;
}

export function countActiveFilters(filters: PipelineFilters): number {
  let count = 0;
  if (filters.search) count++;
  if (filters.stages.length) count++;
  if (filters.corretores.length) count++;
  if (filters.scoreMin > 0) count++;
  if (filters.temperaturas.length) count++;
  if (filters.origens.length) count++;
  if (filters.segmentos.length) count++;
  if (filters.empreendimentos.length) count++;
  if (filters.diasSemAcao) count++;
  if (filters.periodoEntrada) count++;
  if (filters.comVisita) count++;
  if (filters.slaStatus) count++;
  if (filters.gerenteFilter !== "all") count++;
  return count;
}

interface Props {
  filters: PipelineFilters;
  onChange: (filters: PipelineFilters) => void;
  stages: PipelineStage[];
  segmentos: PipelineSegmento[];
  leads: PipelineLead[];
  corretorNomes: Record<string, string>;
  isManager: boolean;
}

export default function PipelineAdvancedFilters({
  filters, onChange, stages, segmentos, leads, corretorNomes, isManager,
}: Props) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => loadSavedFilters());
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  useEffect(() => { persistSavedFilters(savedFilters); }, [savedFilters]);

  const origens = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { if (l.origem) set.add(l.origem); });
    return Array.from(set).sort();
  }, [leads]);

  const empreendimentos = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { if (l.empreendimento) set.add(l.empreendimento); });
    return Array.from(set).sort();
  }, [leads]);

  const corretorList = useMemo(() =>
    Object.entries(corretorNomes).sort((a, b) => a[1].localeCompare(b[1])),
    [corretorNomes]
  );

  const update = (partial: Partial<PipelineFilters>) => onChange({ ...filters, ...partial });

  const toggleArrayItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];

  const handleSave = () => {
    if (!saveName.trim()) return;
    setSavedFilters(prev => [...prev, { name: saveName.trim(), filters: { ...filters } }]);
    setSaveName("");
    setShowSaveInput(false);
  };

  const handleDeleteSaved = (idx: number) => {
    setSavedFilters(prev => prev.filter((_, i) => i !== idx));
  };

  const handleApplySaved = (sf: SavedFilter) => {
    onChange({ ...sf.filters });
  };

  const allFilters = [...PRESETS, ...savedFilters];
  const activeCount = countActiveFilters(filters);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant={activeCount > 0 ? "default" : "outline"} size="sm" className="gap-1.5 h-9">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filtros</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center text-[9px] rounded-full bg-background text-foreground">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[340px] sm:w-[380px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              Filtros Avançados
            </SheetTitle>
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive" onClick={() => onChange({ ...EMPTY_FILTERS })}>
                <X className="h-3 w-3 mr-1" /> Limpar tudo
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-5 pb-6">
            {/* Saved Filters Chips */}
            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Filtros Salvos</Label>
              <div className="flex flex-wrap gap-1.5">
                {allFilters.map((sf, i) => (
                  <div key={`${sf.name}-${i}`} className="flex items-center gap-0.5">
                    <button
                      onClick={() => handleApplySaved(sf)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-card hover:bg-accent hover:border-primary/30 transition-colors font-medium"
                    >
                      {sf.name}
                    </button>
                    {!sf.isPreset && (
                      <button onClick={() => handleDeleteSaved(i - PRESETS.length)} className="text-muted-foreground hover:text-destructive p-0.5">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {showSaveInput ? (
                <div className="flex gap-1.5">
                  <Input
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    placeholder="Nome do filtro"
                    className="h-7 text-xs flex-1"
                    onKeyDown={e => e.key === "Enter" && handleSave()}
                  />
                  <Button size="sm" className="h-7 text-xs px-2" onClick={handleSave} disabled={!saveName.trim()}>Salvar</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setShowSaveInput(false)}>×</Button>
                </div>
              ) : (
                activeCount > 0 && (
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full" onClick={() => setShowSaveInput(true)}>
                    <Save className="h-3 w-3" /> Salvar este filtro
                  </Button>
                )
              )}
            </div>

            <Separator />

            {/* Score Mínimo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Score mínimo</Label>
                <span className="text-xs font-bold text-primary">{filters.scoreMin > 0 ? `≥ ${filters.scoreMin}` : "Todos"}</span>
              </div>
              <Slider
                value={[filters.scoreMin]}
                onValueChange={([v]) => update({ scoreMin: v })}
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            <Separator />

            {/* Temperatura */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Temperatura</Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: "quente", label: "🔥 Quente", color: "border-red-400 bg-red-500/10 text-red-700" },
                  { value: "morno", label: "🟡 Morno", color: "border-amber-400 bg-amber-500/10 text-amber-700" },
                  { value: "frio", label: "🔵 Frio", color: "border-blue-400 bg-blue-500/10 text-blue-700" },
                  { value: "gelado", label: "❄️ Gelado", color: "border-muted-foreground/30 bg-muted text-muted-foreground" },
                ].map(t => (
                  <button
                    key={t.value}
                    onClick={() => update({ temperaturas: toggleArrayItem(filters.temperaturas, t.value) })}
                    className={cn(
                      "text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all",
                      filters.temperaturas.includes(t.value)
                        ? `${t.color} ring-1 ring-primary/30`
                        : "border-border text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Etapa do funil */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Etapas do funil</Label>
              <div className="space-y-1">
                {stages.map(s => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                    <Checkbox
                      checked={filters.stages.includes(s.id)}
                      onCheckedChange={() => update({ stages: toggleArrayItem(filters.stages, s.id) })}
                    />
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.cor }} />
                    <span className="text-xs">{s.nome}</span>
                  </label>
                ))}
              </div>
            </div>

            <Separator />

            {/* Corretor */}
            {isManager && corretorList.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Corretor responsável</Label>
                  <div className="space-y-1 max-h-[120px] overflow-y-auto">
                    {corretorList.map(([id, nome]) => (
                      <label key={id} className="flex items-center gap-2 cursor-pointer py-0.5">
                        <Checkbox
                          checked={filters.corretores.includes(id)}
                          onCheckedChange={() => update({ corretores: toggleArrayItem(filters.corretores, id) })}
                        />
                        <span className="text-xs">{nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Origem */}
            {origens.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Origem do lead</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {origens.map(o => (
                      <button
                        key={o}
                        onClick={() => update({ origens: toggleArrayItem(filters.origens, o) })}
                        className={cn(
                          "text-[11px] px-2.5 py-1 rounded-full border transition-all",
                          filters.origens.includes(o)
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        )}
                      >
                        {o.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Segmento */}
            {segmentos.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Segmento</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {segmentos.map(s => (
                      <button
                        key={s.id}
                        onClick={() => update({ segmentos: toggleArrayItem(filters.segmentos, s.id) })}
                        className={cn(
                          "text-[11px] px-2.5 py-1 rounded-full border transition-all font-medium",
                          filters.segmentos.includes(s.id)
                            ? "ring-1 ring-primary/30 font-semibold"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        )}
                        style={filters.segmentos.includes(s.id) ? { borderColor: s.cor, backgroundColor: `${s.cor}15`, color: s.cor } : {}}
                      >
                        {s.nome}
                      </button>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Empreendimento */}
            {empreendimentos.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Empreendimento</Label>
                  <div className="space-y-1 max-h-[120px] overflow-y-auto">
                    {empreendimentos.map(e => (
                      <label key={e} className="flex items-center gap-2 cursor-pointer py-0.5">
                        <Checkbox
                          checked={filters.empreendimentos.includes(e)}
                          onCheckedChange={() => update({ empreendimentos: toggleArrayItem(filters.empreendimentos, e) })}
                        />
                        <span className="text-xs truncate">{e}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Dias sem ação */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Dias sem ação</Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: "1", label: "> 1 dia" },
                  { value: "3", label: "> 3 dias" },
                  { value: "7", label: "> 7 dias" },
                ].map(d => (
                  <button
                    key={d.value}
                    onClick={() => update({ diasSemAcao: filters.diasSemAcao === d.value ? "" : d.value })}
                    className={cn(
                      "text-[11px] px-2.5 py-1 rounded-full border transition-all",
                      filters.diasSemAcao === d.value
                        ? "border-destructive bg-destructive/10 text-destructive font-semibold"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Período de entrada */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Período de entrada</Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: "hoje", label: "Hoje" },
                  { value: "semana", label: "Esta semana" },
                  { value: "mes", label: "Este mês" },
                ].map(p => (
                  <button
                    key={p.value}
                    onClick={() => update({ periodoEntrada: filters.periodoEntrada === p.value ? "" : p.value })}
                    className={cn(
                      "text-[11px] px-2.5 py-1 rounded-full border transition-all",
                      filters.periodoEntrada === p.value
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "text-[11px] px-2.5 py-1 rounded-full border transition-all flex items-center gap-1",
                        filters.periodoEntrada === "custom"
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      <CalendarIcon className="h-3 w-3" /> Personalizado
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="start">
                    <Calendar
                      mode="range"
                      selected={filters.periodoCustomStart && filters.periodoCustomEnd ? { from: filters.periodoCustomStart, to: filters.periodoCustomEnd } : undefined}
                      onSelect={(range) => {
                        if (range?.from) {
                          update({
                            periodoEntrada: "custom",
                            periodoCustomStart: range.from,
                            periodoCustomEnd: range.to || range.from,
                          });
                        }
                      }}
                      locale={ptBR}
                      className={cn("p-2 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Separator />

            {/* Com visita marcada */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Visita marcada</Label>
              <div className="flex gap-1.5">
                {[
                  { value: "sim", label: "✅ Sim" },
                  { value: "nao", label: "❌ Não" },
                ].map(v => (
                  <button
                    key={v.value}
                    onClick={() => update({ comVisita: filters.comVisita === v.value ? "" : v.value })}
                    className={cn(
                      "text-[11px] px-2.5 py-1 rounded-full border transition-all",
                      filters.comVisita === v.value
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* SLA */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Status do SLA</Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: "ok", label: "✅ No prazo", color: "border-green-400 bg-green-500/10 text-green-700" },
                  { value: "warning", label: "⏳ Expirando", color: "border-amber-400 bg-amber-500/10 text-amber-700" },
                  { value: "breach", label: "🚨 Expirado", color: "border-red-400 bg-red-500/10 text-red-700" },
                ].map(s => (
                  <button
                    key={s.value}
                    onClick={() => update({ slaStatus: filters.slaStatus === s.value ? "" : s.value })}
                    className={cn(
                      "text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all",
                      filters.slaStatus === s.value
                        ? `${s.color} ring-1 ring-primary/30`
                        : "border-border text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Gerente filter for managers */}
            {isManager && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Supervisão gerente</Label>
                  <Select value={filters.gerenteFilter} onValueChange={v => update({ gerenteFilter: v })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="sem_gerente">Sem gerente</SelectItem>
                      <SelectItem value="com_gerente">Com gerente</SelectItem>
                      <SelectItem value="criticos">⚠️ Críticos (sem gerente)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
