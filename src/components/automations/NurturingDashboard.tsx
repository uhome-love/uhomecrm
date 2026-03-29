import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Pause, Play, AlertCircle, CheckCircle2, Clock, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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
};

const STATUS_ICONS: Record<string, { icon: any; color: string }> = {
  enviado: { icon: CheckCircle2, color: "text-emerald-500" },
  pendente: { icon: Clock, color: "text-amber-500" },
  erro: { icon: AlertCircle, color: "text-red-500" },
  cancelado: { icon: Pause, color: "text-muted-foreground" },
};

export default function NurturingDashboard() {
  const [stats, setStats] = useState<StageStats[]>([]);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get stats by stage
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

      // Get recent logs (last 24h)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: logs } = await supabase
        .from("lead_nurturing_sequences")
        .select("id, step_key, stage_tipo, canal, mensagem, status, sent_at, scheduled_at, pipeline_leads(nome)")
        .or(`sent_at.gte.${since},scheduled_at.lte.${new Date().toISOString()}`)
        .neq("status", "cancelado")
        .order("scheduled_at", { ascending: false })
        .limit(30);

      if (logs) {
        setRecentLogs(
          (logs as any[]).map((l) => ({
            ...l,
            lead_nome: l.pipeline_leads?.nome || "Lead",
          }))
        );
      }
    } catch (err) {
      console.error("Error loading nurturing data:", err);
    } finally {
      setLoading(false);
    }
  };

  const togglePause = async () => {
    if (!paused) {
      // Pause all pending
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
        <Button variant="outline" size="sm" className="gap-2" onClick={togglePause}>
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          {paused ? "Retomar" : "Pausar tudo"}
        </Button>
      </div>

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
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Últimos disparos</h3>
        <ScrollArea className="h-64">
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum disparo recente</p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => {
                const statusInfo = STATUS_ICONS[log.status] || STATUS_ICONS.pendente;
                const Icon = statusInfo.icon;
                return (
                  <div key={log.id} className="flex items-center gap-3 text-sm p-2 rounded-md hover:bg-muted/50">
                    <Icon className={`h-4 w-4 shrink-0 ${statusInfo.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{log.lead_nome}</p>
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
    </div>
  );
}
