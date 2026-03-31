import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Send, Pause, Play, AlertCircle, CheckCircle2, Clock, BarChart3, RefreshCcw, Mail, MessageCircle, Phone, TrendingUp, Flame } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Types ──
interface StageStats {
  stage_tipo: string;
  total: number;
  enviados: number;
  pendentes: number;
  erros: number;
}

interface RecentLog {
  id: string;
  step_key: string;
  stage_tipo: string;
  canal: string;
  mensagem: string;
  status: string;
  sent_at: string | null;
  scheduled_at: string;
  lead_nome?: string;
}

interface ReactivationStats {
  totalTentados: number;
  totalReativados: number;
  emailEnviados: number;
  whatsappEnviados: number;
  emailErros: number;
  whatsappErros: number;
}

interface ChannelPerf {
  whatsapp: { enviados: number; lidos: number; respondidos: number };
  email: { enviados: number; abertos: number; clicados: number };
  voz: { total: number; atendidas: number; interessados: number };
}

interface HotLead {
  id: string;
  pipeline_lead_id: string;
  lead_score: number;
  sequencia_ativa: string;
  ultimo_evento: string;
  lead_nome?: string;
}

// ── Constants ──
const STAGE_LABELS: Record<string, string> = {
  novo: "Novo Lead",
  sem_contato: "Sem Contato",
  contato_iniciado: "Contato Iniciado",
  qualificacao: "Qualificação",
  possivel_visita: "Possível Visita",
  visita_marcada: "Visita Marcada",
  visita_realizada: "Visita Realizada",
  negociacao: "Negociação",
  proposta: "Proposta",
  venda_realizada: "Venda Realizada",
  reativacao: "Reativação Base Fria",
  descartado: "Descartado",
};

const STATUS_ICONS: Record<string, { icon: any; color: string }> = {
  enviado: { icon: CheckCircle2, color: "text-emerald-500" },
  pendente: { icon: Clock, color: "text-amber-500" },
  erro: { icon: AlertCircle, color: "text-red-500" },
  cancelado: { icon: Pause, color: "text-muted-foreground" },
};

// ── Main Component ──
export default function NurturingDashboard() {
  const [stats, setStats] = useState<StageStats[]>([]);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [reactivationStats, setReactivationStats] = useState<ReactivationStats>({
    totalTentados: 0, totalReativados: 0, emailEnviados: 0,
    whatsappEnviados: 0, emailErros: 0, whatsappErros: 0,
  });
  const [channelPerf, setChannelPerf] = useState<ChannelPerf>({
    whatsapp: { enviados: 0, lidos: 0, respondidos: 0 },
    email: { enviados: 0, abertos: 0, clicados: 0 },
    voz: { total: 0, atendidas: 0, interessados: 0 },
  });
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [activeTab, setActiveTab] = useState("geral");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadStats(), loadLogs(), loadReactivation(), loadChannelPerf(), loadHotLeads()]);
    } catch (err) {
      console.error("Error loading nurturing data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    const { data: allSeqs } = await supabase
      .from("lead_nurturing_sequences")
      .select("stage_tipo, status")
      .neq("status", "cancelado");

    if (allSeqs) {
      const grouped: Record<string, StageStats> = {};
      for (const s of allSeqs as any[]) {
        if (!grouped[s.stage_tipo]) {
          grouped[s.stage_tipo] = { stage_tipo: s.stage_tipo, total: 0, enviados: 0, pendentes: 0, erros: 0 };
        }
        grouped[s.stage_tipo].total++;
        if (s.status === "enviado") grouped[s.stage_tipo].enviados++;
        else if (s.status === "pendente") grouped[s.stage_tipo].pendentes++;
        else if (s.status === "erro") grouped[s.stage_tipo].erros++;
      }
      setStats(Object.values(grouped).sort((a, b) => b.pendentes - a.pendentes));
    }
  };

  const loadLogs = async () => {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await supabase
      .from("lead_nurturing_sequences")
      .select("id, step_key, stage_tipo, canal, mensagem, status, sent_at, scheduled_at, pipeline_leads(nome)")
      .or(`sent_at.gte.${since},scheduled_at.lte.${new Date().toISOString()}`)
      .neq("status", "cancelado")
      .order("scheduled_at", { ascending: false })
      .limit(50);

    if (logs) {
      setRecentLogs(
        (logs as any[]).map((l) => ({
          ...l,
          lead_nome: l.pipeline_leads?.nome || "Lead",
        }))
      );
    }
  };

  const loadReactivation = async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: reactivSeqs } = await supabase
      .from("lead_nurturing_sequences")
      .select("canal, status")
      .in("stage_tipo", ["reativacao", "sem_contato", "qualificacao"])
      .gte("created_at", thirtyDaysAgo);

    if (reactivSeqs) {
      const stats: ReactivationStats = {
        totalTentados: 0, totalReativados: 0, emailEnviados: 0,
        whatsappEnviados: 0, emailErros: 0, whatsappErros: 0,
      };

      const leadIds = new Set<string>();
      for (const s of reactivSeqs as any[]) {
        if (s.canal === "email" && s.status === "enviado") stats.emailEnviados++;
        if (s.canal === "whatsapp" && s.status === "enviado") stats.whatsappEnviados++;
        if (s.canal === "email" && s.status === "erro") stats.emailErros++;
        if (s.canal === "whatsapp" && s.status === "erro") stats.whatsappErros++;
      }
      stats.totalTentados = reactivSeqs.length;
      setReactivationStats(stats);
    }
  };

  const loadChannelPerf = async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Nurturing sequences by channel
    const { data: seqs } = await supabase
      .from("lead_nurturing_sequences")
      .select("canal, status")
      .eq("status", "enviado")
      .gte("created_at", thirtyDaysAgo);

    const waEnviados = (seqs || []).filter((s: any) => s.canal === "whatsapp").length;
    const emailEnviados = (seqs || []).filter((s: any) => s.canal === "email").length;

    // Voice call logs
    const { data: voiceLogs } = await supabase
      .from("voice_call_logs")
      .select("status, resultado")
      .gte("created_at", thirtyDaysAgo);

    const vozTotal = voiceLogs?.length || 0;
    const vozAtendidas = (voiceLogs || []).filter((v: any) => v.status === "atendida").length;
    const vozInteressados = (voiceLogs || []).filter((v: any) => v.resultado === "interessado").length;

    setChannelPerf({
      whatsapp: { enviados: waEnviados, lidos: 0, respondidos: 0 },
      email: { enviados: emailEnviados, abertos: 0, clicados: 0 },
      voz: { total: vozTotal, atendidas: vozAtendidas, interessados: vozInteressados },
    });
  };

  const loadHotLeads = async () => {
    const { data: hot } = await supabase
      .from("lead_nurturing_state")
      .select("id, pipeline_lead_id, lead_score, sequencia_ativa, ultimo_evento, pipeline_leads(nome)")
      .gte("lead_score", 15)
      .eq("status", "ativo")
      .order("lead_score", { ascending: false })
      .limit(10);

    if (hot) {
      setHotLeads(
        (hot as any[]).map((h) => ({
          ...h,
          lead_nome: h.pipeline_leads?.nome || "Lead",
        }))
      );
    }
  };

  const togglePause = async () => {
    if (!paused) {
      const { error } = await supabase
        .from("lead_nurturing_sequences")
        .update({ status: "cancelado" } as any)
        .eq("status", "pendente");
      if (error) { toast.error("Erro ao pausar"); return; }
      toast.success("Todas as sequências pausadas");
      setPaused(true);
    } else {
      toast.info("Para retomar, leads precisam mudar de etapa para gerar novos steps");
      setPaused(false);
    }
    loadData();
  };

  const totalPendentes = stats.reduce((sum, s) => sum + s.pendentes, 0);
  const totalEnviados = stats.reduce((sum, s) => sum + s.enviados, 0);
  const totalErros = stats.reduce((sum, s) => sum + s.erros, 0);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Sequências de Nutrição</h2>
          <Badge variant="outline" className="text-xs">{totalPendentes} pendentes</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={loadData}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={togglePause}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? "Retomar" : "Pausar tudo"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-sm">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="canais">Canais</TabsTrigger>
          <TabsTrigger value="reativacao">Reativação</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-4 mt-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{totalEnviados}</p>
              <p className="text-xs text-muted-foreground">Enviados</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{totalPendentes}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{totalErros}</p>
              <p className="text-xs text-muted-foreground">Erros</p>
            </Card>
          </div>

          {/* Stats by Stage */}
          {stats.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Por Etapa</h3>
              </div>
              <div className="space-y-2">
                {stats.map((s) => (
                  <div key={s.stage_tipo} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{STAGE_LABELS[s.stage_tipo] || s.stage_tipo}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{s.pendentes} pendentes</Badge>
                      <Badge variant="secondary" className="text-[10px]">{s.enviados} enviados</Badge>
                      {s.erros > 0 && <Badge variant="destructive" className="text-[10px]">{s.erros} erros</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recent Logs */}
          <LogsSection logs={recentLogs} />
        </TabsContent>

        {/* ── Performance por Canal ── */}
        <TabsContent value="canais" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <MessageCircle className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
              <p className="text-xl font-bold">{channelPerf.whatsapp.enviados}</p>
              <p className="text-[10px] text-muted-foreground">WhatsApp enviados</p>
            </Card>
            <Card className="p-3 text-center">
              <Mail className="h-5 w-5 mx-auto text-blue-500 mb-1" />
              <p className="text-xl font-bold">{channelPerf.email.enviados}</p>
              <p className="text-[10px] text-muted-foreground">Emails enviados</p>
            </Card>
            <Card className="p-3 text-center">
              <Phone className="h-5 w-5 mx-auto text-purple-500 mb-1" />
              <p className="text-xl font-bold">{channelPerf.voz.total}</p>
              <p className="text-[10px] text-muted-foreground">Ligações IA</p>
            </Card>
          </div>

          {/* Voz details */}
          {channelPerf.voz.total > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Phone className="h-4 w-4" /> Voz IA (30 dias)
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <p className="text-lg font-bold">{channelPerf.voz.total}</p>
                  <span className="text-muted-foreground">Total</span>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-600">{channelPerf.voz.atendidas}</p>
                  <span className="text-muted-foreground">Atendidas</span>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-600">{channelPerf.voz.interessados}</p>
                  <span className="text-muted-foreground">Interessados</span>
                </div>
              </div>
            </Card>
          )}

          {/* Hot Leads */}
          {hotLeads.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" /> Leads Quentes (score ≥ 15)
              </h3>
              <div className="space-y-2">
                {hotLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/30">
                    <div>
                      <p className="font-medium text-xs">{lead.lead_nome}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {lead.sequencia_ativa} · Último: {lead.ultimo_evento}
                      </p>
                    </div>
                    <Badge variant={lead.lead_score >= 30 ? "destructive" : "default"} className="text-xs">
                      Score {lead.lead_score}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

          {/* Reactivation KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-semibold">E-mails (30d)</h3>
              </div>
              <p className="text-2xl font-bold text-blue-600">{reactivationStats.emailEnviados}</p>
              <p className="text-xs text-muted-foreground">
                enviados · {reactivationStats.emailErros} erros
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-semibold">WhatsApp (30d)</h3>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{reactivationStats.whatsappEnviados}</p>
              <p className="text-xs text-muted-foreground">
                enviados · {reactivationStats.whatsappErros} erros
              </p>
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-2">Resumo de Reativação</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total de disparos (30d)</span>
                <span className="font-medium">{reactivationStats.totalTentados}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Via E-mail</span>
                <span className="font-medium">{reactivationStats.emailEnviados + reactivationStats.emailErros}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Via WhatsApp</span>
                <span className="font-medium">{reactivationStats.whatsappEnviados + reactivationStats.whatsappErros}</span>
              </div>
            </div>
          </Card>

          {/* Reactivation logs filtered */}
          <LogsSection
            logs={recentLogs.filter(l => ["reativacao", "sem_contato", "qualificacao"].includes(l.stage_tipo))}
            title="Últimos disparos de reativação"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Logs Sub-component ──
function LogsSection({ logs, title = "Últimos disparos" }: { logs: RecentLog[]; title?: string }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <ScrollArea className="h-64">
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum disparo recente</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => {
              const statusInfo = STATUS_ICONS[log.status] || STATUS_ICONS.pendente;
              const Icon = statusInfo.icon;
              const isEmail = log.canal === "email";
              return (
                <div key={log.id} className="flex items-center gap-3 text-sm p-2 rounded-md hover:bg-muted/50">
                  <Icon className={`h-4 w-4 shrink-0 ${statusInfo.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {isEmail ? (
                        <Mail className="h-3 w-3 text-blue-500 shrink-0" />
                      ) : (
                        <MessageCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                      )}
                      <p className="text-xs font-medium truncate">{log.lead_nome}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {log.mensagem || log.step_key} · {STAGE_LABELS[log.stage_tipo] || log.stage_tipo}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {log.sent_at
                      ? formatDistanceToNow(new Date(log.sent_at), { addSuffix: true, locale: ptBR })
                      : formatDistanceToNow(new Date(log.scheduled_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
