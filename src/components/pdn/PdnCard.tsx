import { memo, useState, useMemo, useCallback } from "react";
import { type PdnEntry, type PdnSituacao } from "@/hooks/usePdn";
import { calcSmartProbabilidade, calcRisco, OBJECAO_OPTIONS, PROXIMA_ACAO_OPTIONS, type RiscoNivel, type SmartProbResult } from "@/lib/pdnScoring";
import { differenceInDays } from "date-fns";
import {
  Flame, Thermometer, Snowflake, Building2, User, AlertTriangle,
  Calendar, Target, FileText, Clock, CheckCircle, Edit3, GripVertical,
  Phone, MessageCircle, ArrowRightLeft, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PdnCardProps {
  entry: PdnEntry;
  readOnly?: boolean;
  onUpdate: (id: string, updates: Record<string, any>) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragged?: boolean;
}

const TEMP_ICONS = { quente: Flame, morno: Thermometer, frio: Snowflake } as const;
const TEMP_STYLES = {
  quente: { label: "Quente", color: "text-red-600", bg: "bg-red-500/10" },
  morno: { label: "Morno", color: "text-amber-600", bg: "bg-amber-500/10" },
  frio: { label: "Frio", color: "text-blue-500", bg: "bg-blue-500/10" },
} as const;

const RISCO_STYLES: Record<RiscoNivel, { emoji: string; color: string; bg: string; label: string; barColor: string }> = {
  seguro: { emoji: "🟢", color: "text-emerald-600", bg: "bg-emerald-500/10", label: "Seguro", barColor: "bg-emerald-500" },
  atencao: { emoji: "🟡", color: "text-amber-600", bg: "bg-amber-500/10", label: "Atenção", barColor: "bg-amber-500" },
  risco: { emoji: "🔴", color: "text-red-600", bg: "bg-red-500/10", label: "Risco", barColor: "bg-red-500" },
};

const DOCS_STYLES: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  doc_completa: { label: "Docs OK", color: "text-emerald-600", icon: CheckCircle },
  em_andamento: { label: "Em andamento", color: "text-amber-600", icon: FileText },
  sem_docs: { label: "Sem docs", color: "text-muted-foreground", icon: FileText },
};

const BORDER_MAP: Record<string, string> = {
  caiu: "border-l-destructive/60",
  assinado: "border-l-emerald-500/60",
  risco: "border-l-red-500/60",
  atencao: "border-l-amber-500/60",
  seguro: "border-l-emerald-500/40",
};

function formatBRL(v: number | null) {
  if (!v) return null;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}mil`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

let cachedNow = new Date();
let cachedNowTs = Date.now();
function getNow() {
  if (Date.now() - cachedNowTs > 60_000) {
    cachedNow = new Date();
    cachedNowTs = Date.now();
  }
  return cachedNow;
}

const PdnCard = memo(function PdnCard({ entry, readOnly, onUpdate, onDragStart, onDragEnd, isDragged }: PdnCardProps) {
  const [editingMotivo, setEditingMotivo] = useState(false);

  const computed = useMemo(() => {
    const now = getNow();
    const smartProb = calcSmartProbabilidade(entry);
    const prob = smartProb.total;
    const risco = calcRisco(entry);
    const diasParado = differenceInDays(now, new Date(entry.updated_at));
    const isCaiu = entry.situacao === "caiu";
    const isAssinado = entry.situacao === "assinado";
    const isActive = !isCaiu && !isAssinado;

    const borderColor = isCaiu ? BORDER_MAP.caiu
      : isAssinado ? BORDER_MAP.assinado
      : BORDER_MAP[risco.nivel];

    return { prob, smartProb, risco, diasParado, isCaiu, isAssinado, isActive, borderColor };
  }, [entry]);

  const { prob, smartProb, risco, diasParado, isCaiu, isAssinado, isActive, borderColor } = computed;
  const riscoConf = RISCO_STYLES[risco.nivel];
  const tempKey = (entry.temperatura in TEMP_STYLES ? entry.temperatura : "morno") as keyof typeof TEMP_STYLES;
  const temp = TEMP_STYLES[tempKey];
  const TempIcon = TEMP_ICONS[tempKey];
  const docs = DOCS_STYLES[entry.docs_status] || DOCS_STYLES.sem_docs;
  const DocsIcon = docs.icon;
  const vgvFormatted = useMemo(() => formatBRL(entry.vgv), [entry.vgv]);

  const handleDragStartEvent = useCallback((e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", entry.id);
    onDragStart();
  }, [entry.id, onDragStart]);

  const handleProximaAcao = useCallback((v: string) => {
    onUpdate(entry.id, { proxima_acao: v });
  }, [entry.id, onUpdate]);

  const handleMotivoBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    onUpdate(entry.id, { motivo_queda: e.target.value });
    setEditingMotivo(false);
  }, [entry.id, onUpdate]);

  const handleMotivoKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onUpdate(entry.id, { motivo_queda: (e.target as HTMLInputElement).value });
      setEditingMotivo(false);
    }
  }, [entry.id, onUpdate]);

  const handleWhatsApp = useCallback(() => {
    if (!entry.corretor) return;
    // Open WhatsApp-style action - for now toast
    const phone = ""; // would need phone from data
    window.open(`https://wa.me/?text=Olá, sobre o cliente ${entry.nome} - ${entry.empreendimento || ""}`, "_blank");
  }, [entry.nome, entry.empreendimento, entry.corretor]);

  return (
    <div
      draggable={!readOnly}
      onDragStart={handleDragStartEvent}
      onDragEnd={onDragEnd}
      className={`group relative rounded-xl border-l-[3px] border bg-card cursor-grab active:cursor-grabbing hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 select-none overflow-hidden ${borderColor} ${
        isDragged ? "opacity-40 scale-95" : "opacity-100"
      } ${!readOnly ? "hover:border-primary/30" : ""}`}
    >
      {/* Top activity bar */}
      <div className={`h-[2px] w-full ${riscoConf.barColor}`} />

      <div className="p-3 space-y-1.5">
        {/* Row 1: Name + Risk + Temperature */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {!readOnly && (
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
            <h4 className="text-[13px] font-bold text-foreground leading-tight line-clamp-1 flex-1">
              {entry.nome || <span className="text-muted-foreground italic">Sem nome</span>}
            </h4>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isActive && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${riscoConf.bg} ${riscoConf.color}`}>
                    {riscoConf.emoji}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[200px]">
                  <p className="font-semibold mb-0.5">{riscoConf.label}</p>
                  {risco.motivos.length > 0 ? (
                    <ul className="space-y-0.5">{risco.motivos.map((m, i) => <li key={i}>• {m}</li>)}</ul>
                  ) : (
                    <p className="text-muted-foreground">Nenhum problema</p>
                  )}
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`p-0.5 rounded ${temp.bg}`}>
                  <TempIcon className={`h-3 w-3 ${temp.color}`} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">{temp.label}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Row 2: Empreendimento + Unidade */}
        {(entry.empreendimento || entry.und) && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Building2 className="h-3 w-3 shrink-0 text-muted-foreground/60" />
            <span className="truncate font-medium">{entry.empreendimento || "—"}</span>
            {entry.und && (
              <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 shrink-0">
                Und {entry.und}
              </Badge>
            )}
          </div>
        )}

        {/* Row 3: VGV — only show if present */}
        {vgvFormatted && (
          <p className="text-[12px] font-bold text-foreground">{vgvFormatted}</p>
        )}

        {/* Row 4: Probability bar (active only) */}
        {isActive && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="w-full flex items-center gap-1.5 group/prob cursor-pointer hover:opacity-80 transition-opacity">
                <Target className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      prob >= 70 ? "bg-emerald-500" : prob >= 40 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${prob}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground w-10 text-right flex items-center gap-0.5">
                  {prob}%
                  {smartProb.trend === "up" && <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />}
                  {smartProb.trend === "down" && <TrendingDown className="h-2.5 w-2.5 text-red-500" />}
                  {smartProb.trend === "stable" && <Minus className="h-2.5 w-2.5 text-muted-foreground/40" />}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" side="right" align="start">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">Por que {prob}%?</p>
                <div className="space-y-1">
                  {smartProb.factors.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5">
                        {f.icon === "check" && <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />}
                        {f.icon === "warning" && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
                        {f.icon === "info" && <Target className="h-3 w-3 text-primary shrink-0" />}
                        <span className="text-muted-foreground">{f.label}</span>
                      </span>
                      <span className={`font-semibold tabular-nums ${f.value > 0 ? "text-emerald-600" : f.value < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                        {f.value > 0 ? `+${f.value}%` : `${f.value}%`}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-1.5 flex justify-between text-[11px]">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-bold text-foreground">{prob}%</span>
                </div>
                <p className="text-[9px] text-muted-foreground">Cap por etapa: máx {entry.situacao === "gerado" ? "85" : "50"}%</p>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Row 5: Docs status — only if not doc_completa to reduce noise */}
        {entry.docs_status !== "doc_completa" ? (
          <div className="flex items-center gap-1.5 text-[10px]">
            <DocsIcon className={`h-3 w-3 shrink-0 ${docs.color}`} />
            <span className={`${docs.color} font-medium`}>{docs.label}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px]">
            <CheckCircle className="h-3 w-3 shrink-0 text-emerald-600" />
            <span className="text-emerald-600 font-medium">Docs OK</span>
          </div>
        )}

        {/* Row 6: Próxima Ação — simplified */}
        {isActive && (
          <>
            {entry.proxima_acao && entry.proxima_acao.trim() ? (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Calendar className="h-3 w-3 shrink-0" />
                <span className="truncate font-medium">{entry.proxima_acao}</span>
                {entry.data_proxima_acao && (
                  <span className="text-[9px] shrink-0 text-foreground font-semibold">{entry.data_proxima_acao}</span>
                )}
              </div>
            ) : !readOnly ? (
              <Select value="" onValueChange={handleProximaAcao}>
                <SelectTrigger className="h-6 text-[10px] border-dashed border-muted-foreground/20 bg-muted/30 text-muted-foreground px-2 w-full gap-1">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <SelectValue placeholder="Próxima ação..." />
                </SelectTrigger>
                <SelectContent>
                  {PROXIMA_ACAO_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </>
        )}

        {/* Row 7: Parado alert — only ≥5 days to reduce noise */}
        {isActive && diasParado >= 5 && (
          <div className={`flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 ${
            diasParado >= 7 ? "text-red-700 bg-red-500/15 font-semibold" : "text-red-600 bg-red-500/10"
          }`}>
            <Clock className="h-3 w-3 shrink-0" />
            <span>Parado há {diasParado} dias</span>
          </div>
        )}

        {/* Quando assina (gerado) */}
        {entry.situacao === "gerado" && entry.quando_assina && (
          <div className="flex items-center gap-1 text-[10px] text-foreground">
            <Edit3 className="h-3 w-3 shrink-0 text-muted-foreground/60" />
            <span className="font-medium">Assina: {entry.quando_assina}</span>
          </div>
        )}

        {/* Motivo queda (caiu) */}
        {isCaiu && (
          <div className="mt-0.5">
            {editingMotivo ? (
              <Input
                autoFocus
                className="h-7 text-xs"
                placeholder="Motivo da queda..."
                defaultValue={entry.motivo_queda || ""}
                onBlur={handleMotivoBlur}
                onKeyDown={handleMotivoKeyDown}
              />
            ) : (
              <p
                className="text-[11px] text-destructive/80 italic cursor-pointer hover:underline"
                onClick={() => !readOnly && setEditingMotivo(true)}
              >
                {entry.motivo_queda ? `❌ ${entry.motivo_queda}` : "Clique para informar motivo"}
              </p>
            )}
          </div>
        )}

        {/* Footer: Corretor + Quick Actions */}
        <div className="flex items-center justify-between pt-1.5 border-t border-border/30 gap-1">
          {entry.corretor ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <User className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              <span className="text-[10px] text-muted-foreground truncate max-w-[80px] font-medium">
                {entry.corretor}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/40 italic">Sem corretor</span>
          )}

          {/* Quick action buttons — visible on hover */}
          {!readOnly && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10"
                    onClick={handleWhatsApp}
                  >
                    <MessageCircle className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">WhatsApp</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                    onClick={() => {
                      if (entry.corretor) {
                        window.open(`tel:`, "_self");
                      }
                    }}
                  >
                    <Phone className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Ligar</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default PdnCard;
