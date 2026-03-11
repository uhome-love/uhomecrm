import { useMemo, useState } from "react";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Flame, Target, TrendingUp, BarChart3, Clock, Eye,
  Phone, ArrowUpRight, RefreshCw, ChevronDown, ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { differenceInHoursSafe, formatDistanceToNowSafe } from "@/lib/utils";
import { formatDistanceToNowSafe } from "@/lib/utils";
import { ptBR } from "date-fns/locale";
import { getSlaStatus } from "@/lib/leadScoring";

interface OpportunityRadarProps {
  leads: PipelineLead[];
  stages: PipelineStage[];
  corretorNomes: Record<string, string>;
  onSelectLead: (lead: PipelineLead) => void;
}

interface RadarLead {
  lead: PipelineLead;
  score: number;
  stage: PipelineStage;
  category: "hot" | "warm" | "reengage";
  scoreReasons: string[];
  slaStatus: "ok" | "warning" | "breach";
  slaMinutes: number;
  hoursInStage: number;
}

const SEGMENTOS_MAP: Record<string, { badge: string; cor: string }> = {
  "Open Bosque": { badge: "S1 · MCMV", cor: "#16A34A" },
  "Orygem": { badge: "S2 · Médio-Alto", cor: "#2563EB" },
  "Las Casas": { badge: "S2 · Médio-Alto", cor: "#2563EB" },
  "Casa Tua": { badge: "S2 · Médio-Alto", cor: "#2563EB" },
  "Lake Eyre": { badge: "S3 · Alto Padrão", cor: "#7C3AED" },
  "Casa Bastian": { badge: "S4 · Investimento", cor: "#B45309" },
  "Shift": { badge: "S4 · Investimento", cor: "#B45309" },
};

function computeRadarScore(lead: PipelineLead, stage: PipelineStage): { score: number; reasons: string[] } {
  let score = lead.oportunidade_score || 0;
  const reasons: string[] = [];

  // Base score boost by stage advancement
  const stageBonus: Record<string, number> = {
    visita_marcada: 15, visita_realizada: 25, negociacao: 30, proposta: 35, assinatura: 40,
    possibilidade_visita: 10, qualificacao: 5,
  };
  if (stageBonus[stage.tipo]) {
    score += stageBonus[stage.tipo];
    reasons.push(`Etapa "${stage.nome}" (+${stageBonus[stage.tipo]})`);
  }

  // VGV bonus
  const vgv = lead.valor_estimado || 0;
  if (vgv >= 500_000) { score += 15; reasons.push("VGV ≥ R$500k (+15)"); }
  else if (vgv >= 200_000) { score += 8; reasons.push("VGV ≥ R$200k (+8)"); }
  else if (vgv > 0) { score += 3; reasons.push("VGV definido (+3)"); }

  // Temperatura
  if ((lead as any).temperatura === "quente") { score += 10; reasons.push("Lead quente (+10)"); }
  else if ((lead as any).temperatura === "morno") { score += 5; reasons.push("Lead morno (+5)"); }

  // Próxima ação defined
  if (lead.proxima_acao) { score += 5; reasons.push("Próxima ação definida (+5)"); }

  // Recency bonus
  const hoursIn = differenceInHours(new Date(), new Date(lead.stage_changed_at));
  if (hoursIn < 2) { score += 10; reasons.push("Movimentação < 2h (+10)"); }
  else if (hoursIn < 24) { score += 5; reasons.push("Movimentação < 24h (+5)"); }

  // Gerente envolvido
  if (lead.gerente_id) { score += 5; reasons.push("Gerente envolvido (+5)"); }

  return { score: Math.min(100, Math.max(0, score)), reasons };
}

export default function OpportunityRadar({ leads, stages, corretorNomes, onSelectLead }: OpportunityRadarProps) {
  const [filterSegmento, setFilterSegmento] = useState("all");
  const [filterCorretor, setFilterCorretor] = useState("all");
  const [filterEmpreendimento, setFilterEmpreendimento] = useState("all");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ hot: true, warm: true, reengage: true });

  const stageMap = useMemo(() => new Map(stages.map(s => [s.id, s])), [stages]);

  const radarLeads = useMemo(() => {
    const now = new Date();
    const results: RadarLead[] = [];

    for (const lead of leads) {
      const stage = stageMap.get(lead.stage_id);
      if (!stage || ["venda", "descarte"].includes(stage.tipo)) continue;

      const { score, reasons } = computeRadarScore(lead, stage);
      const hoursInStage = differenceInHours(now, new Date(lead.stage_changed_at));
      const sla = getSlaStatus(stage.tipo, lead.stage_changed_at);

      let category: "hot" | "warm" | "reengage";
      if (score >= 70 && hoursInStage <= 2) {
        category = "hot";
      } else if (score >= 50 || ["visita_marcada", "visita_realizada"].includes(stage.tipo)) {
        category = score >= 70 ? "hot" : "warm";
      } else if (hoursInStage >= 72) {
        category = "reengage";
      } else if (score >= 45) {
        category = "warm";
      } else {
        // Low score, not stale — skip from radar
        continue;
      }

      results.push({
        lead, score, stage, category,
        scoreReasons: reasons,
        slaStatus: sla.status,
        slaMinutes: sla.minutesRemaining,
        hoursInStage,
      });
    }

    return results.sort((a, b) => b.score - a.score);
  }, [leads, stageMap]);

  // Unique filter values
  const empreendimentos = useMemo(() => [...new Set(leads.map(l => l.empreendimento).filter(Boolean))].sort(), [leads]);
  const corretorIds = useMemo(() => [...new Set(leads.map(l => l.corretor_id).filter(Boolean))], [leads]);

  // Apply filters
  const filtered = useMemo(() => {
    return radarLeads.filter(r => {
      if (filterCorretor !== "all" && r.lead.corretor_id !== filterCorretor) return false;
      if (filterEmpreendimento !== "all" && r.lead.empreendimento !== filterEmpreendimento) return false;
      if (filterSegmento !== "all") {
        const seg = SEGMENTOS_MAP[r.lead.empreendimento || ""];
        if (!seg || seg.badge !== filterSegmento) return false;
      }
      return true;
    });
  }, [radarLeads, filterCorretor, filterEmpreendimento, filterSegmento]);

  const hot = filtered.filter(r => r.category === "hot");
  const warm = filtered.filter(r => r.category === "warm");
  const reengage = filtered.filter(r => r.category === "reengage");

  const totalVGVHot = hot.reduce((s, r) => s + (r.lead.valor_estimado || 0), 0);
  const avgScore = filtered.length > 0
    ? Math.round(filtered.reduce((s, r) => s + r.score, 0) / filtered.length)
    : 0;

  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const formatVGV = (v: number) => {
    if (v === 0) return "R$ 0";
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
    return `R$ ${(v / 1_000).toFixed(0)}mil`;
  };

  const formatSla = (mins: number) => {
    if (mins <= 0) return "Estourado";
    if (mins < 60) return `${mins}min`;
    if (mins < 1440) return `${Math.round(mins / 60)}h`;
    return `${Math.round(mins / 1440)}d`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 gap-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <Card className="p-3 border-l-[3px] border-l-red-500">
          <div className="flex items-center gap-2 mb-1">
            <Flame className="h-4 w-4 text-red-500" />
            <span className="text-xs text-muted-foreground">Quentes</span>
          </div>
          <p className="text-xl font-bold">{hot.length}</p>
          <p className="text-[10px] text-muted-foreground">score &gt;70 + contato &lt;2h</p>
        </Card>
        <Card className="p-3 border-l-[3px] border-l-amber-500">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">Boas chances</span>
          </div>
          <p className="text-xl font-bold">{warm.length}</p>
          <p className="text-[10px] text-muted-foreground">score 50-70 ou visita</p>
        </Card>
        <Card className="p-3 border-l-[3px] border-l-primary">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">VGV Quente</span>
          </div>
          <p className={`text-lg font-bold ${totalVGVHot === 0 ? "text-muted-foreground" : ""}`}>
            {formatVGV(totalVGVHot)}
          </p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Score médio</span>
          </div>
          <p className="text-xl font-bold">{avgScore}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <Select value={filterSegmento} onValueChange={setFilterSegmento}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos segmentos</SelectItem>
            <SelectItem value="S1 · MCMV">S1 · MCMV</SelectItem>
            <SelectItem value="S2 · Médio-Alto">S2 · Médio-Alto</SelectItem>
            <SelectItem value="S3 · Alto Padrão">S3 · Alto Padrão</SelectItem>
            <SelectItem value="S4 · Investimento">S4 · Investimento</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCorretor} onValueChange={setFilterCorretor}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Corretor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos corretores</SelectItem>
            {corretorIds.map(id => (
              <SelectItem key={id} value={id!}>{corretorNomes[id!] || "Sem nome"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterEmpreendimento} onValueChange={setFilterEmpreendimento}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Empreendimento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos empreend.</SelectItem>
            {empreendimentos.map(e => (
              <SelectItem key={e} value={e!}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterSegmento !== "all" || filterCorretor !== "all" || filterEmpreendimento !== "all") && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={() => { setFilterSegmento("all"); setFilterCorretor("all"); setFilterEmpreendimento("all"); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Lead sections */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 pr-2 pb-4">
          {filtered.length === 0 ? (
            <Card className="p-8 text-center">
              <Target className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhuma oportunidade encontrada</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Ajuste os filtros ou aguarde leads avançarem no funil</p>
            </Card>
          ) : (
            <>
              <RadarSection
                title="QUENTES"
                icon={<Flame className="h-4 w-4 text-red-500" />}
                items={hot}
                expanded={expandedSections.hot}
                onToggle={() => toggleSection("hot")}
                borderColor="border-l-red-500"
                corretorNomes={corretorNomes}
                onSelectLead={onSelectLead}
                formatVGV={formatVGV}
                formatSla={formatSla}
              />
              <RadarSection
                title="BOAS CHANCES"
                icon={<Target className="h-4 w-4 text-amber-500" />}
                items={warm}
                expanded={expandedSections.warm}
                onToggle={() => toggleSection("warm")}
                borderColor="border-l-amber-500"
                corretorNomes={corretorNomes}
                onSelectLead={onSelectLead}
                formatVGV={formatVGV}
                formatSla={formatSla}
              />
              <RadarSection
                title="PARA REENGAJAR"
                icon={<RefreshCw className="h-4 w-4 text-muted-foreground" />}
                items={reengage}
                expanded={expandedSections.reengage}
                onToggle={() => toggleSection("reengage")}
                borderColor="border-l-border"
                corretorNomes={corretorNomes}
                onSelectLead={onSelectLead}
                formatVGV={formatVGV}
                formatSla={formatSla}
              />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Section component ──
interface RadarSectionProps {
  title: string;
  icon: React.ReactNode;
  items: RadarLead[];
  expanded: boolean;
  onToggle: () => void;
  borderColor: string;
  corretorNomes: Record<string, string>;
  onSelectLead: (lead: PipelineLead) => void;
  formatVGV: (v: number) => string;
  formatSla: (mins: number) => string;
}

function RadarSection({ title, icon, items, expanded, onToggle, borderColor, corretorNomes, onSelectLead, formatVGV, formatSla }: RadarSectionProps) {
  if (items.length === 0) return null;

  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-left mb-2 group"
      >
        {icon}
        <span className="text-sm font-bold text-foreground">{title}</span>
        <Badge variant="secondary" className="text-[10px]">{items.length} leads</Badge>
        <span className="ml-auto">
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2">
          {items.map(r => (
            <RadarCard
              key={r.lead.id}
              item={r}
              borderColor={borderColor}
              corretorNomes={corretorNomes}
              onSelectLead={onSelectLead}
              formatVGV={formatVGV}
              formatSla={formatSla}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card component ──
interface RadarCardProps {
  item: RadarLead;
  borderColor: string;
  corretorNomes: Record<string, string>;
  onSelectLead: (lead: PipelineLead) => void;
  formatVGV: (v: number) => string;
  formatSla: (mins: number) => string;
}

function RadarCard({ item, borderColor, corretorNomes, onSelectLead, formatVGV, formatSla }: RadarCardProps) {
  const { lead, score, stage, scoreReasons, slaStatus, slaMinutes, hoursInStage } = item;
  const seg = SEGMENTOS_MAP[lead.empreendimento || ""];
  const timeAgo = formatDistanceToNowSafe(lead.stage_changed_at, { addSuffix: true, locale: ptBR, fallback: "data inválida" });

  const scoreColor = score >= 70 ? "text-red-600" : score >= 50 ? "text-amber-600" : "text-muted-foreground";
  const scoreBg = score >= 70 ? "bg-red-500/10" : score >= 50 ? "bg-amber-500/10" : "bg-muted";

  return (
    <TooltipProvider>
      <Card className={`p-3 border-l-[3px] ${borderColor} hover:shadow-md transition-all`}>
        {/* Row 1: Name + Score */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {item.category === "hot" && <Flame className="h-4 w-4 text-red-500 shrink-0" />}
            {item.category === "warm" && <Target className="h-4 w-4 text-amber-500 shrink-0" />}
            {item.category === "reengage" && <RefreshCw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            <h4 className="text-sm font-bold text-foreground truncate">{lead.nome}</h4>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className={`${scoreBg} ${scoreColor} border-0 text-xs font-bold cursor-help`}>
                Score: {score}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[250px]">
              <p className="font-bold text-xs mb-1">Composição do Score</p>
              {scoreReasons.map((r, i) => (
                <p key={i} className="text-[11px]">• {r}</p>
              ))}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Row 2: Stage · Empreendimento · Time · SLA */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-xs text-muted-foreground">
          {lead.empreendimento && (
            <span className="font-medium text-foreground">{lead.empreendimento}</span>
          )}
          <span>·</span>
          <span>{stage.nome}</span>
          <span>·</span>
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {timeAgo}
          </span>
          {slaStatus !== "ok" && (
            <>
              <span>·</span>
              <span className={`font-semibold flex items-center gap-0.5 ${slaStatus === "breach" ? "text-destructive" : "text-amber-600"}`}>
                <AlertTriangle className="h-3 w-3" />
                SLA {slaStatus === "breach" ? "estourado" : formatSla(slaMinutes)}
              </span>
            </>
          )}
        </div>

        {/* Row 3: Origin + Segment + Corretor */}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {(lead as any).origem && (
            <Badge variant="outline" className="text-[10px] h-5">{(lead as any).origem}</Badge>
          )}
          {seg && (
            <Badge className="text-[10px] h-5 border-0 text-white" style={{ backgroundColor: seg.cor }}>
              {seg.badge}
            </Badge>
          )}
          {lead.corretor_id && corretorNomes[lead.corretor_id] && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              {corretorNomes[lead.corretor_id]}
            </span>
          )}
        </div>

        {/* Row 4: Actions + VGV */}
        <div className="flex items-center justify-between mt-2 gap-2">
          <div className="flex items-center gap-1.5">
            {lead.telefone && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 px-2"
                onClick={(e) => { e.stopPropagation(); window.open(`tel:${lead.telefone}`); }}
              >
                <Phone className="h-3 w-3" />
                Ligar
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1 px-2"
              onClick={() => onSelectLead(lead)}
            >
              <ArrowUpRight className="h-3 w-3" />
              Ver lead
            </Button>
          </div>
          {(lead.valor_estimado || 0) > 0 && (
            <span className="text-xs font-bold text-primary">
              VGV {formatVGV(lead.valor_estimado!)}
            </span>
          )}
        </div>
      </Card>
    </TooltipProvider>
  );
}
