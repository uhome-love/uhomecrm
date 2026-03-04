import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Sparkles, Loader2, ChevronDown, ChevronUp, Zap, Megaphone, AlertTriangle, Info, TrendingUp, MessageSquare, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Lead } from "@/types/lead";
import { getDaysSinceContact, calculateRecoveryScore, getScoreClassification } from "@/lib/leadUtils";
import { supabase } from "@/integrations/supabase/client";

interface RecoveryAgentPanelProps {
  leads: Lead[];
}

interface Insight {
  emoji: string;
  text: string;
  type: "opportunity" | "warning" | "info";
}

interface Campaign {
  name: string;
  description: string;
  target_count: number;
  priority: "alta" | "media" | "baixa";
  channel: "whatsapp" | "email" | "sms";
}

interface Action {
  action: string;
  impact: "alto" | "medio" | "baixo";
  reason: string;
}

interface AgentStrategy {
  attack_first: string;
  top_empreendimentos: string;
  contact_sequence: string;
}

interface AgentAnalysis {
  insights: Insight[];
  campaigns: Campaign[];
  actions: Action[];
  strategy?: AgentStrategy;
  summary: string;
}

function buildLeadsSummary(leads: Lead[]): string {
  const total = leads.length;
  const withPhone = leads.filter((l) => l.telefone && l.telefone.replace(/\D/g, "").length >= 8).length;
  const withEmail = leads.filter((l) => l.email && l.email.includes("@")).length;
  const withInterest = leads.filter((l) => l.interesse && l.interesse.trim().length > 2).length;

  // Score distribution
  const scores = leads.map((l) => l.recoveryScore ?? calculateRecoveryScore(l));
  const alta = scores.filter((s) => s >= 80).length;
  const boa = scores.filter((s) => s >= 60 && s < 80).length;
  const media = scores.filter((s) => s >= 40 && s < 60).length;
  const baixa = scores.filter((s) => s < 40).length;
  const avgScore = total > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / total) : 0;

  // Time buckets
  const timeBuckets = { "0-7": 0, "8-15": 0, "16-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  leads.forEach((l) => {
    const days = getDaysSinceContact(l.ultimoContato);
    if (days === null) timeBuckets["90+"]++;
    else if (days <= 7) timeBuckets["0-7"]++;
    else if (days <= 15) timeBuckets["8-15"]++;
    else if (days <= 30) timeBuckets["16-30"]++;
    else if (days <= 60) timeBuckets["31-60"]++;
    else if (days <= 90) timeBuckets["61-90"]++;
    else timeBuckets["90+"]++;
  });

  // Top interests/empreendimentos
  const interestMap: Record<string, number> = {};
  leads.forEach((l) => {
    const key = l.interesse && l.interesse.trim().length > 2 ? l.interesse.trim() : "Sem interesse definido";
    interestMap[key] = (interestMap[key] || 0) + 1;
  });
  const topInterests = Object.entries(interestMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => `  - ${name}: ${count} leads`);

  // Origem distribution
  const origemMap: Record<string, number> = {};
  leads.forEach((l) => {
    const key = l.origem || "Sem origem";
    origemMap[key] = (origemMap[key] || 0) + 1;
  });
  const topOrigens = Object.entries(origemMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => `  - ${name}: ${count} leads`);

  // Interest + phone combos
  const interestWithPhone: Record<string, number> = {};
  leads.forEach((l) => {
    if (l.telefone && l.interesse && l.interesse.trim().length > 2) {
      const key = l.interesse.trim();
      interestWithPhone[key] = (interestWithPhone[key] || 0) + 1;
    }
  });
  const topInterestPhone = Object.entries(interestWithPhone)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `  - ${name}: ${count} leads com telefone`);

  return `TOTAL: ${total} leads

CONTATO:
- Com telefone válido: ${withPhone} (${Math.round((withPhone / total) * 100)}%)
- Com email válido: ${withEmail} (${Math.round((withEmail / total) * 100)}%)
- Com interesse definido: ${withInterest} (${Math.round((withInterest / total) * 100)}%)

RECOVERY SCORE:
- Score médio: ${avgScore}/100
- Oportunidade Alta (80-100): ${alta} leads
- Oportunidade Boa (60-79): ${boa} leads
- Oportunidade Média (40-59): ${media} leads
- Oportunidade Baixa (0-39): ${baixa} leads

TEMPO SEM CONTATO:
- 0-7 dias: ${timeBuckets["0-7"]} leads
- 8-15 dias: ${timeBuckets["8-15"]} leads
- 16-30 dias: ${timeBuckets["16-30"]} leads
- 31-60 dias: ${timeBuckets["31-60"]} leads
- 61-90 dias: ${timeBuckets["61-90"]} leads
- 90+ dias: ${timeBuckets["90+"]} leads

TOP EMPREENDIMENTOS/INTERESSES:
${topInterests.join("\n")}

TOP ORIGENS:
${topOrigens.join("\n")}

EMPREENDIMENTOS COM TELEFONE (potencial de contato direto):
${topInterestPhone.join("\n")}`;
}

const insightTypeConfig = {
  opportunity: { icon: TrendingUp, color: "bg-success/10 text-success border-success/30" },
  warning: { icon: AlertTriangle, color: "bg-warning/10 text-warning border-warning/30" },
  info: { icon: Info, color: "bg-info/10 text-info border-info/30" },
};

const priorityConfig = {
  alta: { label: "Alta", className: "bg-destructive/10 text-destructive border-destructive/30" },
  media: { label: "Média", className: "bg-warning/10 text-warning border-warning/30" },
  baixa: { label: "Baixa", className: "bg-muted text-muted-foreground border-border" },
};

const channelConfig = {
  whatsapp: { icon: MessageSquare, label: "WhatsApp" },
  email: { icon: Mail, label: "Email" },
  sms: { icon: Phone, label: "SMS" },
};

const impactConfig = {
  alto: { label: "Alto Impacto", className: "bg-success/10 text-success border-success/30" },
  medio: { label: "Médio Impacto", className: "bg-warning/10 text-warning border-warning/30" },
  baixo: { label: "Baixo Impacto", className: "bg-muted text-muted-foreground border-border" },
};

export default function RecoveryAgentPanel({ leads }: RecoveryAgentPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AgentAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<"insights" | "campaigns" | "actions" | "strategy">("insights");

  const handleAnalyze = useCallback(async () => {
    if (leads.length === 0) {
      toast.error("Importe leads antes de executar a análise.");
      return;
    }
    setLoading(true);
    setExpanded(true);
    try {
      const summary = buildLeadsSummary(leads);
      const { data, error } = await supabase.functions.invoke("recovery-agent", {
        body: { leads_summary: summary },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setAnalysis(data);
      toast.success("Análise do Recovery AI Agent concluída!");
    } catch (err: any) {
      console.error("Recovery agent error:", err);
      toast.error("Erro ao executar análise de IA.");
    } finally {
      setLoading(false);
    }
  }, [leads]);

  if (leads.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-primary/30 bg-gradient-to-br from-card to-primary/5 shadow-card overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 ring-2 ring-primary/20">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-display font-bold text-foreground text-sm flex items-center gap-2">
              Recovery Manager AI
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                IA
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              {analysis ? "Análise concluída — clique para ver" : "Análise inteligente de oportunidades de recuperação"}
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground ml-2" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground ml-2" />
          )}
        </button>
        <Button
          onClick={handleAnalyze}
          disabled={loading}
          size="sm"
          className="gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {analysis ? "Reanalisar" : "Analisar Leads"}
            </>
          )}
        </Button>
      </div>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {loading && !analysis && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="relative">
                    <Bot className="h-12 w-12 text-primary/40" />
                    <Sparkles className="h-5 w-5 text-primary absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <p className="text-sm text-muted-foreground animate-pulse">
                    Recovery AI Agent analisando {leads.length} leads...
                  </p>
                </div>
              )}

              {analysis && (
                <>
                  {/* Summary */}
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-sm text-foreground leading-relaxed">
                      <span className="font-semibold">📋 Resumo:</span> {analysis.summary}
                    </p>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 border-b border-border pb-0">
                    {([
                      { key: "insights" as const, label: "Insights", icon: Zap, count: analysis.insights.length },
                      { key: "campaigns" as const, label: "Campanhas", icon: Megaphone, count: analysis.campaigns.length },
                      { key: "actions" as const, label: "Ações", icon: TrendingUp, count: analysis.actions.length },
                      { key: "strategy" as const, label: "Estratégia", icon: Zap, count: analysis.strategy ? 1 : 0 },
                    ]).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                          activeTab === tab.key
                            ? "bg-card border border-b-0 border-border text-foreground -mb-px"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <tab.icon className="h-3.5 w-3.5" />
                        {tab.label}
                        <Badge variant="secondary" className="h-4 min-w-4 text-[10px] px-1">
                          {tab.count}
                        </Badge>
                      </button>
                    ))}
                  </div>

                  {/* Insights Tab */}
                  {activeTab === "insights" && (
                    <div className="space-y-2">
                      {analysis.insights.map((insight, i) => {
                        const config = insightTypeConfig[insight.type];
                        const Icon = config.icon;
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className={`flex items-start gap-3 rounded-lg border p-3 ${config.color}`}
                          >
                            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                            <p className="text-sm leading-relaxed">
                              <span className="mr-1.5">{insight.emoji}</span>
                              {insight.text}
                            </p>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {/* Campaigns Tab */}
                  {activeTab === "campaigns" && (
                    <div className="space-y-3">
                      {analysis.campaigns.map((campaign, i) => {
                        const pConfig = priorityConfig[campaign.priority];
                        const cConfig = channelConfig[campaign.channel];
                        const ChannelIcon = cConfig.icon;
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className="rounded-lg border border-border bg-card p-4 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="font-display font-semibold text-foreground text-sm">
                                {campaign.name}
                              </h4>
                              <div className="flex gap-1.5">
                                <Badge variant="outline" className={`text-[10px] ${pConfig.className}`}>
                                  {pConfig.label}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] gap-1">
                                  <ChannelIcon className="h-2.5 w-2.5" />
                                  {cConfig.label}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">{campaign.description}</p>
                            <p className="text-xs font-medium text-foreground">
                              🎯 ~{campaign.target_count} leads
                            </p>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {/* Actions Tab */}
                  {activeTab === "actions" && (
                    <div className="space-y-2">
                      {analysis.actions.map((action, i) => {
                        const iConfig = impactConfig[action.impact];
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-lg border border-border bg-card p-3 space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                                <Zap className="h-3.5 w-3.5 text-primary" />
                                {action.action}
                              </p>
                              <Badge variant="outline" className={`text-[10px] ${iConfig.className}`}>
                                {iConfig.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground pl-5">{action.reason}</p>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {/* Strategy Tab */}
                  {activeTab === "strategy" && analysis.strategy && (
                    <div className="space-y-3">
                      {[
                        { title: "🎯 Quem atacar primeiro", content: analysis.strategy.attack_first },
                        { title: "🏢 Empreendimentos com maior potencial", content: analysis.strategy.top_empreendimentos },
                        { title: "📋 Sequência de contato recomendada", content: analysis.strategy.contact_sequence },
                      ].map((item, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className="rounded-lg border border-border bg-card p-4"
                        >
                          <h4 className="font-display font-semibold text-foreground text-sm mb-2">{item.title}</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">{item.content}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {!loading && !analysis && (
                <div className="text-center py-8 space-y-2">
                  <Bot className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Clique em <strong>"Analisar Leads"</strong> para o agente de IA identificar oportunidades,
                    sugerir campanhas e priorizar ações.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
