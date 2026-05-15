import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Users, MessageSquare, CalendarDays, ArrowRight, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/ui/PageHeader";

const subtitles = [
  "Recrutamento, RH & Recepção",
  "Cuidando das pessoas por trás dos resultados.",
  "Gestão de talentos e operações do dia a dia.",
];

export default function RhDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState("Carol");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [subtitleIdx, setSubtitleIdx] = useState(0);
  const [stats, setStats] = useState({ candidatos: 0, entrevistas: 0, conversas: 0, reservasHoje: 0 });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome, avatar_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.nome) setNome(data.nome.split(" ")[0]);
      setAvatarUrl(data?.avatar_url || null);
    });
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => setSubtitleIdx(p => (p + 1) % subtitles.length), 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const [r1, r2, r3, r4] = await Promise.all([
        supabase.from("rh_candidatos" as any).select("id", { count: "exact", head: true }),
        supabase.from("rh_candidatos" as any).select("id", { count: "exact", head: true }).eq("etapa", "entrevista_marcada"),
        supabase.from("rh_conversas" as any).select("id", { count: "exact", head: true }),
        supabase.from("sala_reuniao_reservas" as any).select("id", { count: "exact", head: true }).eq("data", hoje),
      ]);
      setStats({
        candidatos: (r1 as any).count ?? 0,
        entrevistas: (r2 as any).count ?? 0,
        conversas: (r3 as any).count ?? 0,
        reservasHoje: (r4 as any).count ?? 0,
      });
    };
    fetchStats();
  }, []);

  const todayFormatted = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });

  const quickCards = [
    {
      icon: Users,
      title: "Recrutamento",
      subtitle: "Kanban de candidatos",
      route: "/rh/recrutamento",
      borderLeft: "#4969FF",
      iconBg: "#4969FF",
      linkColor: "#3350E6",
    },
    {
      icon: MessageSquare,
      title: "Conversas 1:1",
      subtitle: "Registros de reuniões com a equipe",
      route: "/rh/conversas",
      borderLeft: "#8B5CF6",
      iconBg: "#8B5CF6",
      linkColor: "#7C3AED",
    },
    {
      icon: CalendarDays,
      title: "Sala de Reunião",
      subtitle: "Reservas e horários",
      route: "/rh/sala-reuniao",
      borderLeft: "#10B981",
      iconBg: "#10B981",
      linkColor: "#059669",
    },
  ];

  return (
    <div className="bg-[#f0f0f5] dark:bg-[#0e1525] p-6 -m-6 min-h-full space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Dashboard RH"
        subtitle="Recrutamento, entrevistas e gestão de pessoas"
        icon={<Users size={18} strokeWidth={1.5} />}
      />

      {/* Quick Access */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {quickCards.map((card, idx) => (
          <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}>
            <Card
              className="cursor-pointer transition-all duration-200 bg-card hover:shadow-xl group"
              style={{ borderLeft: `4px solid ${card.borderLeft}`, borderTop: "1px solid hsl(var(--border))", borderRight: "1px solid hsl(var(--border))", borderBottom: "1px solid hsl(var(--border))" }}
              onClick={() => navigate(card.route)}
            >
              <CardContent style={{ padding: 28 }}>
                <div className="flex items-center justify-center mb-3" style={{ width: 52, height: 52, borderRadius: 14, background: card.iconBg }}>
                  <card.icon className="text-white" style={{ width: 26, height: 26 }} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "hsl(var(--foreground))" }}>{card.title}</h3>
                <p style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{card.subtitle}</p>
                <div className="flex items-center gap-1 mt-3" style={{ fontSize: 13, fontWeight: 600, color: card.linkColor }}>
                  Acessar <ArrowRight style={{ width: 14, height: 14 }} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Candidatos", value: stats.candidatos, color: "#4969FF" },
          { label: "Entrevistas marcadas", value: stats.entrevistas, color: "#F59E0B" },
          { label: "Conversas 1:1", value: stats.conversas, color: "#8B5CF6" },
          { label: "Reservas hoje", value: stats.reservasHoje, color: "#10B981" },
        ].map((s) => (
          <Card key={s.label} className="bg-card">
            <CardContent className="p-4 text-center">
              <p style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</p>
              <p style={{ fontSize: 12, color: "#6B7280" }}>{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
