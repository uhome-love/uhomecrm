import { useState, useRef, useCallback, useEffect, memo } from "react";
import type { PipelineLead } from "@/hooks/usePipeline";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Copy, MapPin, Globe, Clock, Eye, FileText, MessageCircle, Check, ClipboardList, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { differenceInHoursSafe, todayBRT, dateToBRT } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

// Activity type icons
const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  ligacao: Phone,
  whatsapp: MessageCircle,
  visita: MapPin,
  email: Globe,
  anotacao: FileText,
  tarefa: Check,
};

// Cache for hover data (60s TTL)
const hoverCache = new Map<string, { data: HoverData; timestamp: number }>();
const CACHE_TTL = 60_000;

interface HoverData {
  atividades: Array<{ tipo: string; titulo: string; created_at: string }>;
  ultimaObs: string | null;
}

interface CalcTemp {
  emoji: string; label: string; bg: string; border: string; text: string;
}

function getCalcTemp(lead: PipelineLead): CalcTemp {
  const refDate = lead.updated_at || lead.created_at;
  const hours = differenceInHoursSafe(refDate) ?? Number.POSITIVE_INFINITY;
  const isIndicacao = (lead.origem || "").toLowerCase().includes("indicaç") || (lead.origem || "").toLowerCase().includes("indicac");

  if (hours < 2 || isIndicacao) {
    return { emoji: "🔥", label: "Quente", bg: "bg-[#EF4444]/15", border: "border-[#EF4444]/30", text: "text-[#EF4444]" };
  }
  if (hours < 24) {
    return { emoji: "🟡", label: "Morno", bg: "bg-[#F59E0B]/15", border: "border-[#F59E0B]/30", text: "text-[#F59E0B]" };
  }
  if (hours < 72) {
    return { emoji: "🔵", label: "Frio", bg: "bg-[#3B82F6]/15", border: "border-[#3B82F6]/30", text: "text-[#3B82F6]" };
  }
  return { emoji: "❄️", label: "Gelado", bg: "bg-[#6B7280]/15", border: "border-[#6B7280]/30", text: "text-[#6B7280]" };
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

interface Props {
  lead: PipelineLead;
  children: React.ReactNode;
  onOpenLead: () => void;
}

const PipelineCardHover = memo(function PipelineCardHover({ lead, children, onOpenLead }: Props) {
  const [visible, setVisible] = useState(false);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [position, setPosition] = useState<"right" | "left">("right");
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    // Check cache
    const cached = hoverCache.get(lead.id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setHoverData(cached.data);
      return;
    }

    setLoading(true);
    try {
      // Fetch last 3 activities
      const { data: atividades } = await supabase
        .from("pipeline_atividades")
        .select("tipo, titulo, created_at")
        .eq("pipeline_lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(3);

      // Fetch last annotation
      const { data: anotacoes } = await supabase
        .from("pipeline_anotacoes")
        .select("conteudo")
        .eq("pipeline_lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const result: HoverData = {
        atividades: (atividades || []) as any,
        ultimaObs: anotacoes?.[0]?.conteudo || lead.observacoes || null,
      };

      hoverCache.set(lead.id, { data: result, timestamp: Date.now() });
      setHoverData(result);
    } catch (e) {
      console.warn("Hover data fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [lead.id, lead.observacoes]);

  const handleEnter = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    enterTimer.current = setTimeout(() => {
      // Determine position
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const spaceRight = window.innerWidth - rect.right;
        setPosition(spaceRight < 320 ? "left" : "right");
      }
      setVisible(true);
      fetchData();
    }, 500);
  }, [fetchData]);

  const handleLeave = useCallback(() => {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    leaveTimer.current = setTimeout(() => setVisible(false), 200);
  }, []);

  const handlePopoverEnter = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  const handlePopoverLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => setVisible(false), 150);
  }, []);

  useEffect(() => {
    return () => {
      if (enterTimer.current) clearTimeout(enterTimer.current);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lead.telefone) return;
    navigator.clipboard.writeText(lead.telefone);
    setCopied(true);
    toast.success("Telefone copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const temp = getCalcTemp(lead);

  return (
    <div className="relative" ref={cardRef} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}

      {visible && (
        <div
          className={`absolute top-0 z-50 w-[280px] animate-fade-in ${
            position === "right" ? "left-full ml-2" : "right-full mr-2"
          }`}
          onMouseEnter={handlePopoverEnter}
          onMouseLeave={handlePopoverLeave}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-popover border border-border rounded-xl shadow-xl p-0 overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-border/50 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-bold text-foreground leading-tight flex-1">{lead.nome}</h4>
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${temp.bg} ${temp.border} ${temp.text}`}>
                  {temp.emoji} {temp.label}
                </span>
              </div>
              {lead.telefone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium text-foreground">{formatPhone(lead.telefone)}</span>
                  <button
                    onClick={handleCopyPhone}
                    className="p-0.5 rounded hover:bg-accent transition-colors ml-auto"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="p-3 space-y-2.5">
              {lead.empreendimento && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">{lead.empreendimento}</span>
                </div>
              )}
              {lead.origem && (
                <div className="flex items-center gap-1.5">
                  <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">{lead.origem.replace(/_/g, " ")}</span>
                </div>
              )}

              {/* Histórico */}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Histórico</p>
                {loading ? (
                  <div className="flex items-center gap-2 py-2">
                    <div className="h-3 w-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <span className="text-[10px] text-muted-foreground">Carregando...</span>
                  </div>
                ) : hoverData?.atividades && hoverData.atividades.length > 0 ? (
                  <div className="space-y-1">
                    {hoverData.atividades.map((a, i) => {
                      const Icon = ACTIVITY_ICONS[a.tipo] || FileText;
                      const activityDate = new Date(a.created_at);
                      const activityTimeAgo = Number.isNaN(activityDate.getTime())
                        ? "agora"
                        : formatDistanceToNow(activityDate, { addSuffix: false, locale: ptBR });

                      return (
                        <div key={i} className="flex items-center gap-1.5">
                          <Icon className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                          <span className="text-[11px] text-foreground truncate flex-1">{a.titulo}</span>
                          <span className="text-[9px] text-muted-foreground/60 shrink-0">
                            {activityTimeAgo}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground/50 italic">Nenhuma atividade registrada</p>
                )}
              </div>

              {/* Última observação */}
              {hoverData?.ultimaObs && (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Observação</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {hoverData.ultimaObs.length > 100
                      ? hoverData.ultimaObs.substring(0, 100) + "..."
                      : hoverData.ultimaObs}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-1.5 p-2.5 border-t border-border/50 bg-muted/30">
              {lead.telefone && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] gap-1 flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`tel:${lead.telefone}`, "_self");
                  }}
                >
                  <Phone className="h-3 w-3" />
                  Ligar
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                className="h-7 text-[11px] gap-1 flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLead();
                }}
              >
                <Eye className="h-3 w-3" />
                Abrir lead
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default PipelineCardHover;
