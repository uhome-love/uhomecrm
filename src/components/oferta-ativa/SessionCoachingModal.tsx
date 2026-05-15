import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, Phone, CheckCircle, TrendingUp, Clock, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

const homiMascot = "/images/homi-mascot-official.png";

export interface SessionMetrics {
  total_tentativas: number;
  total_atenderam: number;
  total_aproveitados: number;
  ligacoes: number;
  whatsapps: number;
  emails: number;
  pontos: number;
  duracao_segundos: number;
  empreendimento: string;
  lista_id: string;
  session_start: number; // timestamp
}

interface Props {
  open: boolean;
  onClose: () => void;
  metrics: SessionMetrics;
  onViewLeadsQuentes?: () => void;
}

export default function SessionCoachingModal({ open, onClose, metrics, onViewLeadsQuentes }: Props) {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const m = metrics;
  const taxaAtendimento = m.total_tentativas > 0 ? Math.round((m.total_atenderam / m.total_tentativas) * 100) : 0;
  const taxaAproveitamento = m.total_atenderam > 0 ? Math.round((m.total_aproveitados / m.total_atenderam) * 100) : 0;
  const duracaoMin = Math.round(m.duracao_segundos / 60);

  useEffect(() => {
    if (!open || feedback || loading) return;
    generateFeedback();
  }, [open]);

  const generateFeedback = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch 30-day averages for this corretor
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: pastAttempts } = await supabase
        .from("oferta_ativa_tentativas")
        .select("resultado, created_at")
        .eq("corretor_id", user.id)
        .gte("created_at", thirtyDaysAgo.toISOString());

      const past = pastAttempts || [];
      const pastTotal = past.length;
      const pastAprov = past.filter(a => a.resultado === "com_interesse").length;
      const pastAtend = past.filter(a => a.resultado !== "nao_atendeu" && a.resultado !== "numero_errado").length;

      // Fetch team averages today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: teamToday } = await supabase
        .from("oferta_ativa_tentativas")
        .select("corretor_id, resultado")
        .gte("created_at", today.toISOString());

      const teamData = teamToday || [];
      const teamCorretores = new Set(teamData.map(t => t.corretor_id));
      const teamCount = teamCorretores.size || 1;
      const teamTotalTent = teamData.length;
      const teamTotalAprov = teamData.filter(t => t.resultado === "com_interesse").length;

      // Build hourly breakdown from session attempts
      const sessionStartTime = new Date(m.session_start);
      const { data: sessionAttempts } = await supabase
        .from("oferta_ativa_tentativas")
        .select("resultado, created_at")
        .eq("corretor_id", user.id)
        .gte("created_at", sessionStartTime.toISOString());

      let detalhesHora = "";
      if (sessionAttempts && sessionAttempts.length > 0) {
        const byHour: Record<number, { total: number; aprov: number }> = {};
        for (const a of sessionAttempts) {
          const h = new Date(a.created_at).getHours();
          if (!byHour[h]) byHour[h] = { total: 0, aprov: 0 };
          byHour[h].total++;
          if (a.resultado === "com_interesse") byHour[h].aprov++;
        }
        detalhesHora = Object.entries(byHour)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([h, v]) => `${h}h: ${v.total} tentativas, ${v.aprov} aproveitados`)
          .join("\n");
      }

      // Check hot leads without contact
      const { count: leadsQuentes } = await supabase
        .from("oferta_ativa_leads")
        .select("id", { count: "exact", head: true })
        .eq("corretor_id", user.id)
        .eq("status", "aproveitado")
        .eq("cadastrado_jetimob", false);

      const sessionMetricsPayload = {
        total_tentativas: m.total_tentativas,
        total_atenderam: m.total_atenderam,
        total_aproveitados: m.total_aproveitados,
        taxa_atendimento: taxaAtendimento,
        taxa_aproveitamento: taxaAproveitamento,
        ligacoes: m.ligacoes,
        whatsapps: m.whatsapps,
        emails: m.emails,
        pontos: m.pontos,
        duracao_min: duracaoMin,
        empreendimento: m.empreendimento,
        media_corretor_tentativas: pastTotal > 0 ? Math.round(pastTotal / 30) : "N/A",
        media_corretor_aproveitamento: pastTotal > 0 ? Math.round((pastAprov / Math.max(pastAtend, 1)) * 100) : "N/A",
        media_time_tentativas: Math.round(teamTotalTent / teamCount),
        media_time_aproveitados: Math.round(teamTotalAprov / teamCount),
        detalhes_por_hora: detalhesHora,
        leads_quentes_pendentes: leadsQuentes || 0,
      };

      const corretorNome = user.user_metadata?.nome || user.email?.split("@")[0] || "";

      const { data, error } = await supabase.functions.invoke("oa-session-coaching", {
        body: { session_metrics: sessionMetricsPayload, corretor_nome: corretorNome },
      });

      if (error) throw error;
      setFeedback(data?.feedback || "Sem feedback disponível.");

      // Save coaching session
      await supabase.from("coaching_sessions" as any).insert({
        corretor_id: user.id,
        lista_id: m.lista_id,
        session_start: new Date(m.session_start).toISOString(),
        duracao_segundos: m.duracao_segundos,
        total_tentativas: m.total_tentativas,
        total_atenderam: m.total_atenderam,
        total_aproveitados: m.total_aproveitados,
        taxa_atendimento: taxaAtendimento,
        taxa_aproveitamento: taxaAproveitamento,
        media_corretor_30d: {
          tentativas: pastTotal,
          aproveitados: pastAprov,
        },
        media_time_hoje: {
          tentativas: teamTotalTent,
          aproveitados: teamTotalAprov,
        },
        feedback_ia: data?.feedback,
        metricas: sessionMetricsPayload,
      });
    } catch (err) {
      console.error("Coaching feedback error:", err);
      setFeedback("Não foi possível gerar o feedback neste momento. Seus resultados foram salvos!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-primary" />
            Sessão encerrada! Aqui está seu resumo 🎯
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Metrics cards */}
          <div className="grid grid-cols-4 gap-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl border border-border bg-muted/30 p-3 text-center"
            >
              <Phone className="h-4 w-4 mx-auto text-primary mb-1" />
              <p className="text-xl font-bold text-foreground">{m.total_tentativas}</p>
              <p className="text-[10px] text-muted-foreground">ligações</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl border border-border bg-muted/30 p-3 text-center"
            >
              <CheckCircle className="h-4 w-4 mx-auto text-blue-500 mb-1" />
              <p className="text-xl font-bold text-foreground">{m.total_atenderam}</p>
              <p className="text-[10px] text-muted-foreground">atenderam</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl border border-border bg-emerald-500/10 p-3 text-center"
            >
              <TrendingUp className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
              <p className="text-xl font-bold text-emerald-600">{m.total_aproveitados}</p>
              <p className="text-[10px] text-muted-foreground">aproveitados</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-xl border border-border bg-muted/30 p-3 text-center"
            >
              <Flame className="h-4 w-4 mx-auto text-amber-500 mb-1" />
              <p className="text-xl font-bold text-foreground">{taxaAproveitamento}%</p>
              <p className="text-[10px] text-muted-foreground">taxa</p>
            </motion.div>
          </div>

          {/* Session info */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {duracaoMin}min</span>
            <span>📞 {m.ligacoes}</span>
            <span>💬 {m.whatsapps}</span>
            <span>📧 {m.emails}</span>
            <span className="font-semibold text-primary">⭐ {m.pontos} pts</span>
          </div>

          {/* AI Feedback */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl border border-primary/20 bg-primary/5 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <img src={homiMascot} alt="Homi" className="h-8 w-8 object-contain" />
              <div>
                <p className="text-sm font-semibold text-foreground">Feedback do Homi</p>
                <p className="text-[10px] text-muted-foreground">Coach de performance</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-6 gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Analisando sua sessão...</span>
              </div>
            ) : feedback ? (
              <div className="prose prose-sm max-w-none text-foreground">
                <ReactMarkdown>{feedback}</ReactMarkdown>
              </div>
            ) : null}
          </motion.div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            {onViewLeadsQuentes && (
              <Button variant="outline" size="sm" onClick={onViewLeadsQuentes} className="gap-1.5">
                🔥 Ver leads quentes para amanhã
              </Button>
            )}
            <Button size="sm" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
