import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, Minus, Trophy, Phone, CheckCircle, Flame, Target, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Area,
} from "recharts";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DayData {
  date: string;
  label: string;
  tentativas: number;
  aproveitados: number;
  pontos: number;
  ligacoes: number;
  whatsapps: number;
  emails: number;
  taxa: number;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function useWeeklyData(weekStart: Date) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["corretor-weekly-summary", user?.id, weekStart.toISOString()],
    queryFn: async () => {
      const mondayBrt = format(weekStart, "yyyy-MM-dd");
      const dayStartUtc = new Date(`${mondayBrt}T00:00:00-03:00`).toISOString();

      const endOfWeekDate = new Date(weekStart);
      endOfWeekDate.setDate(weekStart.getDate() + 7);
      const endBrt = format(endOfWeekDate, "yyyy-MM-dd");
      const dayEndUtc = new Date(`${endBrt}T00:00:00-03:00`).toISOString();

      const { data, error } = await supabase
        .from("oferta_ativa_tentativas")
        .select("canal, resultado, pontos, created_at")
        .eq("corretor_id", user!.id)
        .gte("created_at", dayStartUtc)
        .lt("created_at", dayEndUtc);

      if (error) throw error;

      const days: DayData[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        const dayLabel = WEEKDAYS[d.getDay()];
        const dayNum = d.getDate().toString().padStart(2, "0") + "/" + (d.getMonth() + 1).toString().padStart(2, "0");

        const dayItems = (data || []).filter(
          (t) => new Date(t.created_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) === dateStr
        );

        const tentativas = dayItems.length;
        const aproveitados = dayItems.filter((t) => t.resultado === "com_interesse").length;
        const pontos = dayItems.reduce((sum, t) => sum + t.pontos, 0);
        const ligacoes = dayItems.filter((t) => t.canal === "ligacao").length;
        const whatsapps = dayItems.filter((t) => t.canal === "whatsapp").length;
        const emails = dayItems.filter((t) => t.canal === "email").length;
        const taxa = tentativas > 0 ? Math.round((aproveitados / tentativas) * 100) : 0;

        days.push({ date: dateStr, label: `${dayLabel}\n${dayNum}`, tentativas, aproveitados, pontos, ligacoes, whatsapps, emails, taxa });
      }

      const prevMondayBrt = format(subWeeks(weekStart, 1), "yyyy-MM-dd");
      const prevStartUtc = new Date(`${prevMondayBrt}T00:00:00-03:00`).toISOString();

      const { data: prevData } = await supabase
        .from("oferta_ativa_tentativas")
        .select("resultado, pontos")
        .eq("corretor_id", user!.id)
        .gte("created_at", prevStartUtc)
        .lt("created_at", dayStartUtc);

      const prevTentativas = prevData?.length || 0;
      const prevAproveitados = prevData?.filter((t) => t.resultado === "com_interesse").length || 0;
      const prevPontos = prevData?.reduce((sum, t) => sum + t.pontos, 0) || 0;

      return { days, prevTentativas, prevAproveitados, prevPontos };
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

function TrendChip({ current, previous, label, variant }: { current: number; previous: number; label: string; variant: "blue" | "green" | "amber" }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    amber: "bg-amber-50 text-amber-600 border-amber-200",
  };

  let trend = "";
  let TrendIcon = Minus;
  if (previous === 0 && current > 0) {
    trend = "novo!";
    TrendIcon = TrendingUp;
  } else if (previous > 0) {
    const pct = Math.round(((current - previous) / previous) * 100);
    if (pct > 0) { trend = `+${pct}%`; TrendIcon = TrendingUp; }
    else if (pct < 0) { trend = `${pct}%`; TrendIcon = TrendingDown; }
    else { trend = "="; }
  } else {
    trend = "--";
  }

  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full border ${colors[variant]}`}>
      <TrendIcon className="h-3.5 w-3.5" /> {label}: {trend}
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-gray-800">{label?.replace("\n", " ")}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-bold text-gray-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function CorretorWeeklySummary() {
  const [selectedWeek, setSelectedWeek] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const isCurrentWeek = isSameWeek(selectedWeek, new Date(), { weekStartsOn: 1 });

  const { data, isLoading } = useWeeklyData(selectedWeek);

  const totals = useMemo(() => {
    if (!data) return { tentativas: 0, aproveitados: 0, pontos: 0, taxa: 0, melhorDia: "" };
    const tentativas = data.days.reduce((s, d) => s + d.tentativas, 0);
    const aproveitados = data.days.reduce((s, d) => s + d.aproveitados, 0);
    const pontos = data.days.reduce((s, d) => s + d.pontos, 0);
    const taxa = tentativas > 0 ? Math.round((aproveitados / tentativas) * 100) : 0;
    const melhorDia = data.days.reduce((best, d) => (d.pontos > best.pontos ? d : best), data.days[0]);
    return { tentativas, aproveitados, pontos, taxa, melhorDia: melhorDia?.label?.replace("\n", " ") || "" };
  }, [data]);

  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 });
  const weekLabel = `${format(selectedWeek, "dd/MM", { locale: ptBR })} — ${format(weekEnd, "dd/MM", { locale: ptBR })}`;

  const getTaxaColor = (taxa: number) => {
    if (taxa >= 15) return "text-green-600";
    if (taxa >= 8) return "text-amber-600";
    return "text-red-500";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-lg border-gray-200 hover:bg-gray-100"
          onClick={() => setSelectedWeek(prev => subWeeks(prev, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-800">{weekLabel}</p>
          <p className="text-xs text-gray-400">
            {isCurrentWeek ? "Semana atual" : format(selectedWeek, "'Semana de' dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="icon" 
          className="h-9 w-9 rounded-lg border-gray-200 hover:bg-gray-100" 
          disabled={isCurrentWeek}
          onClick={() => setSelectedWeek(prev => addWeeks(prev, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary Card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div
          className="rounded-2xl p-5"
          style={{
            background: "linear-gradient(135deg, #EFF6FF, #F0FDF4)",
            borderLeft: "4px solid #3B82F6",
            borderRadius: 16,
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 shrink-0">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">Resumo da Semana</h3>
              <p className="text-xs text-gray-400">Sua evolução de segunda a domingo</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <TrendChip current={totals.tentativas} previous={data.prevTentativas} label="Tentativas" variant="blue" />
            <TrendChip current={totals.aproveitados} previous={data.prevAproveitados} label="Aproveitados" variant="green" />
            <TrendChip current={totals.pontos} previous={data.prevPontos} label="Pontos" variant="amber" />
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Tentativas", value: totals.tentativas, icon: Phone, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Aproveitados", value: totals.aproveitados, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
            { label: "Pontos", value: totals.pontos, icon: Trophy, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Taxa Aprov.", value: `${totals.taxa}%`, icon: Target, color: getTaxaColor(totals.taxa), bg: totals.taxa >= 15 ? "bg-green-50" : totals.taxa >= 8 ? "bg-amber-50" : "bg-red-50" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl p-4 bg-white transition-all duration-200 hover:-translate-y-0.5 cursor-default"
              style={{
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.bg} shrink-0 mb-2`}>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <p className={`text-4xl font-black leading-none ${item.color}`}>{item.value}</p>
              <p className="text-sm font-medium text-gray-500 mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Performance Chart */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div
          className="rounded-2xl p-5 bg-white"
          style={{
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Performance Diária
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.days} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="tentativas"
                  name="Tentativas"
                  fill="rgba(59,130,246,0.12)"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#3B82F6", stroke: "#fff", strokeWidth: 2 }}
                />
                <Bar
                  dataKey="aproveitados"
                  name="Aproveitados"
                  fill="#22C55E"
                  radius={[4, 4, 0, 0]}
                  barSize={24}
                />
                <Line
                  type="monotone"
                  dataKey="pontos"
                  name="Pontos"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#F59E0B", stroke: "#fff", strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      {/* Best Day Highlight */}
      {totals.tentativas > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{
              background: "linear-gradient(135deg, #FFFBEB, #FEF3C7)",
              border: "1px solid rgba(245,158,11,0.2)",
            }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 shrink-0">
              <Flame className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">🏆 Melhor Dia da Semana</p>
              <p className="text-base font-bold text-gray-800 mt-0.5">
                {totals.melhorDia} — {data.days.reduce((best, d) => (d.pontos > best.pontos ? d : best), data.days[0]).pontos} pontos
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Channel Breakdown */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div
          className="rounded-2xl p-5 bg-white"
          style={{
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <h4 className="text-lg font-bold text-gray-800 mb-3">Canais Utilizados na Semana</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.days} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="ligacoes" name="Ligações" fill="#06B6D4" radius={[2, 2, 0, 0]} stackId="a" />
                <Bar dataKey="whatsapps" name="WhatsApps" fill="#22C55E" radius={[2, 2, 0, 0]} stackId="a" />
                <Bar dataKey="emails" name="E-mails" fill="#3B82F6" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
