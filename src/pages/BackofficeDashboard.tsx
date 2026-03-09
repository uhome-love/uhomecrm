import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Megaphone, DollarSign, ShoppingCart, Settings, ArrowRight,
  Sparkles, Users, CalendarDays, Kanban, Eye,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const subtitles = [
  "Marketing, Financeiro & Operações",
  "A empresa roda porque você cuida dos bastidores.",
  "Gestão inteligente, sempre nos bastidores.",
];

export default function BackofficeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState("Ana");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [subtitleIdx, setSubtitleIdx] = useState(0);

  const [mktStats, setMktStats] = useState({ campanhas: 0, leadsHoje: 0, leadsSemana: 0, ultimoPost: "" });
  const [finStats, setFinStats] = useState({ pendentes: 0, ultimoContrato: "" });
  const [mkpStats, setMkpStats] = useState({ ativos: 0, pendentes: 0 });
  const [opStats, setOpStats] = useState({ corretoresAtivos: 0, visitasHoje: 0, leadsFila: 0 });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome, avatar_url, avatar_gamificado_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.nome) setNome(data.nome.split(" ")[0]);
      const url = data?.avatar_url || (data as any)?.avatar_gamificado_url || null;
      setAvatarUrl(url);
    });
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSubtitleIdx((prev) => (prev + 1) % subtitles.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const fetchMkt = async () => {
      const campaigns: any = await supabase.from("marketing_entries").select("id", { count: "exact", head: true }).gte("created_at", weekAgo);
      const posts: any = await supabase.from("conteudos_marketing").select("tema, data_publicacao, status").order("data_publicacao", { ascending: false }).limit(1);
      setMktStats({
        campanhas: campaigns.count ?? 0,
        leadsHoje: 0,
        leadsSemana: 0,
        ultimoPost: posts.data?.[0]?.tema || "Nenhum ainda",
      });
    };
    fetchMkt();
  }, []);

  useEffect(() => {
    const fetchFin = async () => {
      const { data }: any = await supabase.from("pagadorias").select("status, created_at").order("created_at", { ascending: false });
      const pendentes = (data || []).filter((p: any) => p.status === "pendente" || p.status === "rascunho").length;
      setFinStats({ pendentes, ultimoContrato: data?.[0]?.created_at ? format(new Date(data[0].created_at), "dd/MM") : "—" });
    };
    fetchFin();
  }, []);

  useEffect(() => {
    const fetchMkp = async () => {
      const { data }: any = await supabase.from("marketplace_items").select("status");
      const ativos = (data || []).filter((i: any) => i.status === "aprovado").length;
      const pendentes = (data || []).filter((i: any) => i.status === "pendente").length;
      setMkpStats({ ativos, pendentes });
    };
    fetchMkp();
  }, []);

  useEffect(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const fetchOp = async () => {
      const r1: any = await (supabase.from("team_members" as any).select("id", { count: "exact", head: true }) as any);
      const r2: any = await (supabase.from("visitas").select("id", { count: "exact", head: true }).eq("data_visita", today) as any);
      const r3: any = await (supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).is("corretor_id", null) as any);
      setOpStats({
        corretoresAtivos: r1?.count ?? 0,
        visitasHoje: r2?.count ?? 0,
        leadsFila: r3?.count ?? 0,
      });
    };
    fetchOp();
  }, []);

  const todayFormatted = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });

  const quickCards = [
    {
      icon: Megaphone,
      title: "Central de Marketing",
      subtitle: "Campanhas, posts e conteúdos",
      route: "/backoffice/marketing",
      borderLeft: "#8B5CF6",
      iconBg: "#8B5CF6",
      linkColor: "#7C3AED",
    },
    {
      icon: DollarSign,
      title: "Financeiro / Pagadorias",
      subtitle: "Comissões e contratos",
      route: "/backoffice/pagadorias",
      borderLeft: "#F59E0B",
      iconBg: "#F59E0B",
      linkColor: "#D97706",
    },
    {
      icon: ShoppingCart,
      title: "Marketplace Admin",
      subtitle: "Scripts e materiais da equipe",
      route: "/marketplace",
      borderLeft: "#10B981",
      iconBg: "#10B981",
      linkColor: "#059669",
    },
    {
      icon: Settings,
      title: "Administração",
      subtitle: "Configurações do sistema",
      route: "/configuracoes",
      borderLeft: "#6B7280",
      iconBg: "#6B7280",
      linkColor: "#6B7280",
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header "Fala, Ana" ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl px-6 py-5 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)" }}
      >
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={nome}
              className="rounded-full object-cover shrink-0"
              style={{ width: 56, height: 56, border: "2px solid #7C3AED" }}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-full font-bold text-white text-lg shrink-0"
              style={{ width: 56, height: 56, background: "#7C3AED", border: "2px solid #7C3AED" }}
            >
              {nome ? nome[0].toUpperCase() : "A"}
            </div>
          )}
          <div>
            <h1 style={{ color: "#FFFFFF", fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
              Fala, {nome}! 👋
            </h1>
            <motion.p
              key={subtitleIdx}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ color: "#94A3B8", fontSize: 14, marginTop: 4 }}
            >
              {subtitles[subtitleIdx]}
            </motion.p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="capitalize" style={{ color: "#64748B", fontSize: 13 }}>{todayFormatted}</p>
        </div>
      </motion.div>

      {/* ── Quick Access Grid 2×2 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {quickCards.map((card, idx) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
          >
            <Card
              className="cursor-pointer transition-all duration-200 bg-card hover:shadow-xl group"
              style={{
                borderLeft: `4px solid ${card.borderLeft}`,
                borderTop: "1px solid hsl(var(--border))",
                borderRight: "1px solid hsl(var(--border))",
                borderBottom: "1px solid hsl(var(--border))",
              }}
              onClick={() => navigate(card.route)}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "translateY(-2px)";
                el.style.boxShadow = `0 8px 24px rgba(124,58,237,0.12)`;
                el.style.borderColor = card.borderLeft;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "translateY(0)";
                el.style.boxShadow = "none";
                el.style.borderColor = "";
              }}
            >
              <CardContent style={{ padding: 28 }}>
                <div
                  className="flex items-center justify-center mb-3"
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: card.iconBg,
                  }}
                >
                  <card.icon className="text-white" style={{ width: 26, height: 26 }} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "hsl(var(--foreground))" }}>
                  {card.title}
                </h3>
                <p style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{card.subtitle}</p>
                <div
                  className="flex items-center gap-1 mt-3"
                  style={{ fontSize: 13, fontWeight: 600, color: card.linkColor }}
                >
                  Acessar <ArrowRight style={{ width: 14, height: 14 }} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Marketing */}
        <Card style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
              <Megaphone className="h-4 w-4" style={{ color: "#8B5CF6" }} />
              📣 Atividade de Marketing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span style={{ fontSize: 13, color: "#6B7280" }}>Campanhas recentes</span>
              <span style={{ fontSize: 15, fontWeight: 500, color: "#374151" }}>{mktStats.campanhas}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ fontSize: 13, color: "#6B7280" }}>Último post</span>
              <span className="truncate max-w-[180px]" style={{ fontSize: 15, fontWeight: 500, color: "#374151" }}>{mktStats.ultimoPost}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              style={{ borderColor: "#7C3AED", color: "#7C3AED", borderRadius: 6, fontSize: 13 }}
              onClick={() => navigate("/backoffice/marketing")}
            >
              Ir para Central de Marketing →
            </Button>
          </CardContent>
        </Card>

        {/* Financeiro */}
        <Card style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
              <DollarSign className="h-4 w-4" style={{ color: "#F59E0B" }} />
              💰 Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span style={{ fontSize: 13, color: "#6B7280" }}>Pagadorias pendentes</span>
              <span style={{ fontSize: 15, fontWeight: 500, color: "#374151" }}>{finStats.pendentes}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ fontSize: 13, color: "#6B7280" }}>Último contrato</span>
              <span style={{ fontSize: 15, fontWeight: 500, color: "#374151" }}>{finStats.ultimoContrato}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              style={{ borderColor: "#D97706", color: "#D97706", borderRadius: 6, fontSize: 13 }}
              onClick={() => navigate("/backoffice/pagadorias")}
            >
              Ir para Pagadorias →
            </Button>
          </CardContent>
        </Card>

        {/* Marketplace */}
        <Card style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
              <ShoppingCart className="h-4 w-4" style={{ color: "#10B981" }} />
              🛒 Marketplace
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span style={{ fontSize: 13, color: "#6B7280" }}>Itens ativos</span>
              <span style={{ fontSize: 15, fontWeight: 500, color: "#374151" }}>{mkpStats.ativos}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ fontSize: 13, color: "#6B7280" }}>Pendentes de aprovação</span>
              <span style={{ fontSize: 15, fontWeight: 500, color: "#374151" }}>{mkpStats.pendentes}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              style={{ borderColor: "#10B981", color: "#059669", borderRadius: 6, fontSize: 13 }}
              onClick={() => navigate("/marketplace")}
            >
              Gerenciar Marketplace →
            </Button>
          </CardContent>
        </Card>

        {/* Operacional */}
        <Card style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
              <Eye className="h-4 w-4" style={{ color: "#6B7280" }} />
              📋 Visão Geral da Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="flex items-center gap-1.5" style={{ fontSize: 13, color: "#6B7280" }}>
                <Users className="h-3.5 w-3.5" /> Corretores ativos
              </span>
              <span style={{ fontSize: 15, fontWeight: 500, color: "#374151" }}>{opStats.corretoresAtivos}</span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-1.5" style={{ fontSize: 13, color: "#6B7280" }}>
                <CalendarDays className="h-3.5 w-3.5" /> Visitas hoje
              </span>
              <span style={{ fontSize: 15, fontWeight: 500, color: "#374151" }}>{opStats.visitasHoje}</span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-1.5" style={{ fontSize: 13, color: "#6B7280" }}>
                <Kanban className="h-3.5 w-3.5" /> Leads na fila
              </span>
              <span style={{ fontSize: 15, fontWeight: 500, color: "#374151" }}>{opStats.leadsFila}</span>
            </div>
            <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4, fontStyle: "italic" }}>Somente leitura — dados consolidados</p>
          </CardContent>
        </Card>
      </div>

      {/* ── HOMI Alert ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <Card style={{ border: "1px solid rgba(99,102,241,0.2)" }}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-white shadow flex items-center justify-center shrink-0">
                <img src="/images/homi-mascot-official.png" alt="HOMI" className="h-7 w-7 object-contain" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" style={{ color: "#6366F1" }} /> HOMI Ana
                </p>
                <p className="text-sm text-muted-foreground">
                  {finStats.pendentes > 0
                    ? `Olá ${nome}! Há ${finStats.pendentes} pagadoria${finStats.pendentes > 1 ? "s" : ""} aguardando sua atenção.`
                    : `Tudo em dia, ${nome}! Foca na produção de conteúdo e organização. 💜`}
                  {mkpStats.pendentes > 0 && ` E ${mkpStats.pendentes} item${mkpStats.pendentes > 1 ? "ns" : ""} no Marketplace aguardando aprovação.`}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-0"
                  style={{ color: "#7C3AED" }}
                  onClick={() => navigate("/backoffice/homi-ana")}
                >
                  Conversar com HOMI Ana →
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
