import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Phone, ThumbsUp, TrendingUp, Loader2, Flame } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { startOfDay, startOfWeek, startOfMonth, format } from "date-fns";

type PeriodOption = "hoje" | "semana" | "mes" | "acumulado";

const periodLabels: Record<PeriodOption, string> = {
  hoje: "Hoje",
  semana: "Esta Semana",
  mes: "Este Mês",
  acumulado: "Acumulado Total",
};

const medals = ["🥇", "🥈", "🥉"];
const medalBg = [
  "border-warning/40 bg-gradient-to-r from-warning/10 to-warning/5",
  "border-muted-foreground/20 bg-gradient-to-r from-muted/20 to-muted/10",
  "border-orange-400/30 bg-gradient-to-r from-orange-50/50 to-transparent dark:from-orange-900/10",
];

interface CorretorOARank {
  corretor_id: string;
  nome: string;
  tentativas: number;
  aproveitados: number;
  sem_interesse: number;
  nao_atendeu: number;
  ligacoes: number;
  whatsapps: number;
  pontos: number;
  taxa: number;
}

export default function RankingOfertaAtiva() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [period, setPeriod] = useState<PeriodOption>("semana");

  const periodStart = useMemo(() => {
    if (period === "acumulado") return null;
    const now = new Date();
    if (period === "hoje") return startOfDay(now).toISOString();
    if (period === "semana") return startOfWeek(now, { weekStartsOn: 1 }).toISOString();
    return startOfMonth(now).toISOString();
  }, [period]);

  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ["oa-ranking", period, periodStart],
    queryFn: async () => {
      let query = supabase
        .from("oferta_ativa_tentativas")
        .select("corretor_id, canal, resultado, pontos, created_at");

      if (periodStart) {
        query = query.gte("created_at", periodStart);
      }

      const { data: tentativas, error } = await query;
      if (error) throw error;

      // Group by corretor
      const map = new Map<string, Omit<CorretorOARank, "nome" | "taxa">>();
      for (const t of tentativas || []) {
        if (!map.has(t.corretor_id)) {
          map.set(t.corretor_id, {
            corretor_id: t.corretor_id,
            tentativas: 0, aproveitados: 0, sem_interesse: 0,
            nao_atendeu: 0, ligacoes: 0, whatsapps: 0, pontos: 0,
          });
        }
        const c = map.get(t.corretor_id)!;
        c.tentativas++;
        c.pontos += t.pontos || 0;
        if (t.resultado === "com_interesse") c.aproveitados++;
        if (t.resultado === "sem_interesse") c.sem_interesse++;
        if (t.resultado === "nao_atendeu") c.nao_atendeu++;
        if (t.canal === "ligacao") c.ligacoes++;
        if (t.canal === "whatsapp") c.whatsapps++;
      }

      // Fetch profiles
      const ids = [...map.keys()];
      if (ids.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", ids);
      const profileMap: Record<string, string> = {};
      for (const p of profiles || []) profileMap[p.user_id] = p.nome;

      // Build final array sorted by pontos
      const result: CorretorOARank[] = [...map.values()].map(c => ({
        ...c,
        nome: profileMap[c.corretor_id] || "Corretor",
        taxa: c.tentativas > 0 ? Math.round((c.aproveitados / c.tentativas) * 100) : 0,
      }));

      result.sort((a, b) => b.pontos - a.pontos || b.aproveitados - a.aproveitados);
      return result;
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const totals = useMemo(() => {
    return ranking.reduce(
      (acc, c) => ({
        tentativas: acc.tentativas + c.tentativas,
        aproveitados: acc.aproveitados + c.aproveitados,
        pontos: acc.pontos + c.pontos,
      }),
      { tentativas: 0, aproveitados: 0, pontos: 0 }
    );
  }, [ranking]);

  const taxaGeral = totals.tentativas > 0 ? Math.round((totals.aproveitados / totals.tentativas) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-warning" />
          <h2 className="font-display font-bold text-lg text-foreground">Ranking Oferta Ativa</h2>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(periodLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Tentativas</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{totals.tentativas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <ThumbsUp className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Aproveitados</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{totals.aproveitados}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Taxa Conversão</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{taxaGeral}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-4 w-4 text-warning" />
              <span className="text-xs text-muted-foreground">Total Pontos</span>
            </div>
            <p className="text-2xl font-bold text-warning">{totals.pontos}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ranking Table */}
      {ranking.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sem dados de oferta ativa para o período selecionado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="divide-y divide-border">
            <AnimatePresence>
              {ranking.map((c, i) => (
                <motion.div
                  key={c.corretor_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${i < 3 ? medalBg[i] || "" : ""}`}
                >
                  <span className="text-lg w-8 text-center shrink-0">
                    {i < 3 ? medals[i] : (
                      <span className="text-sm text-muted-foreground font-display font-bold">{i + 1}º</span>
                    )}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                      <span>📞 {c.ligacoes} lig.</span>
                      <span>💬 {c.whatsapps} wpp</span>
                      <span className="text-emerald-600">✅ {c.aproveitados} aprov.</span>
                      <span>❌ {c.sem_interesse} s/int.</span>
                      <span>📵 {c.nao_atendeu} n/at.</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-lg font-display font-bold text-foreground">{c.pontos} <span className="text-xs font-normal text-muted-foreground">pts</span></p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-5 ${c.taxa >= 15 ? "text-emerald-600 border-emerald-500/30" : c.taxa >= 8 ? "text-blue-600 border-blue-500/30" : "text-muted-foreground"}`}
                    >
                      {c.taxa}% conv.
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
