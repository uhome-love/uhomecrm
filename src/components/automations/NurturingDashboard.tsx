import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Send, Pause, Play, AlertCircle, CheckCircle2, Clock, BarChart3,
  RefreshCcw, Mail, MessageCircle, Phone, Flame, Zap, Activity, ShieldCheck, ShieldAlert, Rocket
} from "lucide-react";
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

interface HealthStatus {
  whatsapp: boolean;
  mailgun: boolean;
  elevenlabs: boolean;
  lastSequencerRun: string | null;
  lastReactivationRun: string | null;
}

// ── Constants ──
const STAGE_LABELS: Record<string, string> = {
  novo: "Novo Lead", sem_contato: "Sem Contato", contato_iniciado: "Contato Iniciado",
  qualificacao: "Qualificação", possivel_visita: "Possível Visita", visita_marcada: "Visita Marcada",
  visita_realizada: "Visita Realizada", negociacao: "Negociação", proposta: "Proposta",
  venda_realizada: "Venda Realizada", reativacao: "Reativação Base Fria", descartado: "Descartado",
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
  const [channelPerf, setChannelPerf] = useState<ChannelPerf>({
    whatsapp: { enviados: 0, lidos: 0, respondidos: 0 },
    email: { enviados: 0, abertos: 0, clicados: 0 },
    voz: { total: 0, atendidas: 0, interessados: 0 },
  });
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [health, setHealth] = useState<HealthStatus>({
    whatsapp: false, mailgun: false, elevenlabs: false,
    lastSequencerRun: null, lastReactivationRun: null,
  });
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("geral");
  const [activeLeads, setActiveLeads] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [windowOpen24h, setWindowOpen24h] = useState(0);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadStats(), loadLogs(), loadChannelPerf(), loadHotLeads(), loadHealth(), loadGlobalKpis()]);
    } catch (err) {
      console.error("Error loading nurturing data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadGlobalKpis = async () => {
    // Use count query to avoid 1000-row truncation
    const { count: activeCount } = await supabase
      .from("lead_nurturing_state")
      .select("id", { count: "exact", head: true })
      .eq("status", "ativo");
    setActiveLeads(activeCount || 0);

    // For avg score, fetch only scores (paginate if needed)
    const { data: states } = await supabase
      .from("lead_nurturing_state")
      .select("lead_score")
      .eq("status", "ativo")
      .limit(1000);
    if (states && states.length > 0) {
      const totalScore = states.reduce((s, st: any) => s + (st.lead_score || 0), 0);
      setAvgScore(Math.round(totalScore / states.length));
    }
  };

  const loadHealth = async () => {
    // ops_events uses 'fn' and 'message' columns, NOT 'tipo'
    const { data: seqRun } = await supabase
      .from("ops_events")
      .select("created_at")
      .eq("fn", "cron-nurturing-sequencer")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: reactRun } = await supabase
      .from("ops_events")
      .select("created_at")
      .eq("fn", "reactivate-cold-leads")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Check if recent sends succeeded (proxy for config being valid)
    const { data: recentWa } = await supabase
      .from("lead_nurturing_sequences")
      .select("status")
      .eq("canal", "whatsapp")
      .eq("status", "enviado")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: recentEmail } = await supabase
      .from("lead_nurturing_sequences")
      .select("status")
      .eq("canal", "email")
      .eq("status", "enviado")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: recentVoz } = await supabase
      .from("voice_call_logs")
      .select("status")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setHealth({
      whatsapp: !!recentWa,
      mailgun: !!recentEmail,
      elevenlabs: !!recentVoz,
      lastSequencerRun: seqRun?.created_at || null,
      lastReactivationRun: reactRun?.created_at || null,
    });
  };

  const loadStats = async () => {
    // Paginate to avoid 1000-row truncation
    let allSeqs: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data } = await supabase
        .from("lead_nurturing_sequences")
        .select("stage_tipo, status")
        .neq("status", "cancelado")
        .range(from, from + pageSize - 1);
      if (!data || data.length === 0) break;
      allSeqs = allSeqs.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    if (allSeqs.length > 0) {
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
      .gte("scheduled_at", since)
      .neq("status", "cancelado")
      .order("scheduled_at", { ascending: false })
      .limit(50);

    if (logs) {
      setRecentLogs(
        (logs as any[]).map((l) => ({ ...l, lead_nome: l.pipeline_leads?.nome || "Lead" }))
      );
    }
  };

  const loadChannelPerf = async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: seqs } = await supabase
      .from("lead_nurturing_sequences")
      .select("canal, status")
      .eq("status", "enviado")
      .gte("created_at", thirtyDaysAgo);

    // Count nurturing-only sends (don't double-count with campaign sends)
    const waEnviadosNurturing = (seqs || []).filter((s: any) => s.canal === "whatsapp").length;
    const emailEnviadosNurturing = (seqs || []).filter((s: any) => s.canal === "email").length;

    // ── Real WhatsApp read/reply data from campaigns ──
    const { count: waCampTotal } = await supabase
      .from("whatsapp_campaign_sends")
      .select("id", { count: "exact", head: true })
      .gte("sent_at", thirtyDaysAgo);

    const { count: waLidos } = await supabase
      .from("whatsapp_campaign_sends")
      .select("id", { count: "exact", head: true })
      .in("status_envio", ["read", "replied"])
      .gte("sent_at", thirtyDaysAgo);

    const { count: waRespondidos } = await supabase
      .from("whatsapp_campaign_sends")
      .select("id", { count: "exact", head: true })
      .eq("status_envio", "replied")
      .gte("sent_at", thirtyDaysAgo);

    // ── Real email open/click data from campaigns ──
    const { count: emailCampTotal } = await supabase
      .from("email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo);

    const { count: emailAbertos } = await supabase
      .from("email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .gt("aberturas", 0)
      .gte("created_at", thirtyDaysAgo);

    const { count: emailClicados } = await supabase
      .from("email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .gt("cliques", 0)
      .gte("created_at", thirtyDaysAgo);

    // Use count queries for voice to avoid truncation
    const { count: vozTotal } = await supabase
      .from("voice_call_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo);

    const { count: vozAtendidas } = await supabase
      .from("voice_call_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "atendida")
      .gte("created_at", thirtyDaysAgo);

    const { count: vozInteressados } = await supabase
      .from("voice_call_logs")
      .select("id", { count: "exact", head: true })
      .eq("resultado", "interessado")
      .gte("created_at", thirtyDaysAgo);

    // ── Count leads with open 24h window ──
    const { count: windowCount } = await supabase
      .from("pipeline_leads")
      .select("id", { count: "exact", head: true })
      .gt("conversation_window_until", new Date().toISOString());

    setWindowOpen24h(windowCount || 0);

    setChannelPerf({
      whatsapp: { enviados: waEnviadosNurturing + (waCampTotal || 0), lidos: waLidos || 0, respondidos: waRespondidos || 0 },
      email: { enviados: emailEnviadosNurturing + (emailCampTotal || 0), abertos: emailAbertos || 0, clicados: emailClicados || 0 },
      voz: {
        total: vozTotal || 0,
        atendidas: vozAtendidas || 0,
        interessados: vozInteressados || 0,
      },
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
      setHotLeads((hot as any[]).map((h) => ({ ...h, lead_nome: h.pipeline_leads?.nome || "Lead" })));
    }
  };

  const executeNow = async (fn: string) => {
    setExecuting(fn);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body: { source: "manual" } });
      if (error) throw error;
      toast.success(`${fn} executado com sucesso`, { description: JSON.stringify(data).slice(0, 100) });
      loadData();
    } catch (e: any) {
      toast.error(`Erro ao executar ${fn}`, { description: e.message });
    } finally {
      setExecuting(null);
    }
  };

  const togglePause = async () => {
    if (!paused) {
      // Pause: set status to 'pausado' (reversible) instead of 'cancelado'
      const { error } = await supabase
        .from("lead_nurturing_sequences")
        .update({ status: "pausado" } as any)
        .eq("status", "pendente");
      if (error) { toast.error("Erro ao pausar"); return; }
      toast.success("Todas as sequências pausadas (reversível)");
      setPaused(true);
    } else {
      // Resume: set status back to 'pendente'
      const { error } = await supabase
        .from("lead_nurturing_sequences")
        .update({ status: "pendente" } as any)
        .eq("status", "pausado");
      if (error) { toast.error("Erro ao retomar"); return; }
      toast.success("Sequências retomadas");
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
          <h2 className="text-lg font-bold">Motor de Nutrição</h2>
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
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="canais">Canais</TabsTrigger>
          <TabsTrigger value="operacao">Operação</TabsTrigger>
          <TabsTrigger value="reativacao">Reativação</TabsTrigger>
        </TabsList>

        {/* ── GERAL ── */}
        <TabsContent value="geral" className="space-y-4 mt-4">
          {/* Global KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3 text-center">
              <Activity className="h-4 w-4 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{activeLeads}</p>
              <p className="text-xs text-muted-foreground">Leads em nutrição</p>
            </Card>
            <Card className="p-3 text-center">
              <BarChart3 className="h-4 w-4 mx-auto text-blue-500 mb-1" />
              <p className="text-2xl font-bold">{avgScore}</p>
              <p className="text-xs text-muted-foreground">Score médio</p>
            </Card>
            <Card className="p-3 text-center">
              <Flame className="h-4 w-4 mx-auto text-orange-500 mb-1" />
              <p className="text-2xl font-bold text-orange-600">{hotLeads.length}</p>
              <p className="text-xs text-muted-foreground">Hot leads</p>
            </Card>
            <Card className="p-3 text-center">
              <CheckCircle2 className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
              <p className="text-2xl font-bold text-emerald-600">{totalEnviados}</p>
              <p className="text-xs text-muted-foreground">Enviados</p>
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

          <LogsSection logs={recentLogs} />
        </TabsContent>

        {/* ── CANAIS ── */}
        <TabsContent value="canais" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3 text-center">
              <MessageCircle className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
              <p className="text-xl font-bold">{channelPerf.whatsapp.enviados}</p>
              <p className="text-[10px] text-muted-foreground">WhatsApp (30d)</p>
            </Card>
            <Card className="p-3 text-center">
              <Mail className="h-5 w-5 mx-auto text-blue-500 mb-1" />
              <p className="text-xl font-bold">{channelPerf.email.enviados}</p>
              <p className="text-[10px] text-muted-foreground">Emails (30d)</p>
            </Card>
            <Card className="p-3 text-center">
              <Phone className="h-5 w-5 mx-auto text-purple-500 mb-1" />
              <p className="text-xl font-bold">{channelPerf.voz.total}</p>
              <p className="text-[10px] text-muted-foreground">Voz IA (30d)</p>
            </Card>
            <Card className="p-3 text-center border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
              <Zap className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
              <p className="text-xl font-bold text-emerald-600">{windowOpen24h}</p>
              <p className="text-[10px] text-muted-foreground">Janela 24h aberta</p>
            </Card>
          </div>

          {/* WhatsApp Detailed Stats */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-emerald-500" /> WhatsApp (30 dias)
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div>
                <p className="text-lg font-bold">{channelPerf.whatsapp.enviados}</p>
                <span className="text-muted-foreground">Enviados</span>
              </div>
              <div>
                <p className="text-lg font-bold text-blue-600">{channelPerf.whatsapp.lidos}</p>
                <span className="text-muted-foreground">Lidos</span>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-600">{channelPerf.whatsapp.respondidos}</p>
                <span className="text-muted-foreground">Respondidos</span>
              </div>
            </div>
            {channelPerf.whatsapp.enviados > 0 && (
              <div className="mt-2 pt-2 border-t text-[10px] text-muted-foreground text-center">
                Taxa leitura: {Math.round((channelPerf.whatsapp.lidos / channelPerf.whatsapp.enviados) * 100)}% · 
                Taxa resposta: {Math.round((channelPerf.whatsapp.respondidos / channelPerf.whatsapp.enviados) * 100)}%
              </div>
            )}
          </Card>

          {/* Email Detailed Stats */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" /> Email (30 dias)
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div>
                <p className="text-lg font-bold">{channelPerf.email.enviados}</p>
                <span className="text-muted-foreground">Enviados</span>
              </div>
              <div>
                <p className="text-lg font-bold text-blue-600">{channelPerf.email.abertos}</p>
                <span className="text-muted-foreground">Abertos</span>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-600">{channelPerf.email.clicados}</p>
                <span className="text-muted-foreground">Clicados</span>
              </div>
            </div>
          </Card>

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
        </TabsContent>

        {/* ── OPERAÇÃO (Health Check + Execução Manual) ── */}
        <TabsContent value="operacao" className="space-y-4 mt-4">
          {/* Health Check */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Saúde do Sistema
            </h3>
            <div className="space-y-2">
              <HealthItem label="WhatsApp (Meta API)" ok={health.whatsapp} />
              <HealthItem label="Email (Mailgun)" ok={health.mailgun} />
              <HealthItem label="Voz IA (ElevenLabs)" ok={health.elevenlabs} />
            </div>
            <div className="mt-3 pt-3 border-t space-y-1">
              <p className="text-xs text-muted-foreground">
                Último Sequenciador: {health.lastSequencerRun
                  ? formatDistanceToNow(new Date(health.lastSequencerRun), { addSuffix: true, locale: ptBR })
                  : "Nunca executou"}
              </p>
              <p className="text-xs text-muted-foreground">
                Última Reativação: {health.lastReactivationRun
                  ? formatDistanceToNow(new Date(health.lastReactivationRun), { addSuffix: true, locale: ptBR })
                  : "Nunca executou"}
              </p>
            </div>
          </Card>

          {/* Manual Execution */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" /> Execução Manual
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Sequenciador</p>
                  <p className="text-xs text-muted-foreground">Processa steps pendentes agora</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!executing}
                  onClick={() => executeNow("cron-nurturing-sequencer")}
                >
                  {executing === "cron-nurturing-sequencer" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  <span className="ml-1">Executar</span>
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Reativar Base Fria</p>
                  <p className="text-xs text-muted-foreground">Varre leads parados e agenda nutrição</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!executing}
                  onClick={() => executeNow("reactivate-cold-leads")}
                >
                  {executing === "reactivate-cold-leads" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  <span className="ml-1">Executar</span>
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Orquestrador</p>
                  <p className="text-xs text-muted-foreground">Testa o motor de scoring</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!executing}
                  onClick={() => executeNow("nurturing-orchestrator")}
                >
                  {executing === "nurturing-orchestrator" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  <span className="ml-1">Testar</span>
                </Button>
              </div>
            </div>
          </Card>

          {/* Erros */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" /> Erros Recentes
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{totalEnviados}</p>
                <p className="text-xs text-muted-foreground">Enviados</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{totalPendentes}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{totalErros}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ── REATIVAÇÃO ── */}
        <TabsContent value="reativacao" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-semibold">E-mails (30d)</h3>
              </div>
              <p className="text-2xl font-bold text-blue-600">{channelPerf.email.enviados}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-semibold">WhatsApp (30d)</h3>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{channelPerf.whatsapp.enviados}</p>
            </Card>
          </div>

          <LogsSection
            logs={recentLogs.filter(l => ["reativacao", "sem_contato", "qualificacao"].includes(l.stage_tipo))}
            title="Últimos disparos de reativação"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Health indicator ──
function HealthItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      {ok ? (
        <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 gap-1">
          <ShieldCheck className="h-3 w-3" /> Ativo
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 gap-1">
          <ShieldAlert className="h-3 w-3" /> Sem dados
        </Badge>
      )}
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
