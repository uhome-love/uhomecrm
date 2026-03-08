import { useState, useEffect, useMemo } from "react";
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
  const [subtitleIdx, setSubtitleIdx] = useState(0);

  // Marketing summary
  const [mktStats, setMktStats] = useState({ campanhas: 0, leadsHoje: 0, leadsSemana: 0, ultimoPost: "" });
  // Financeiro summary
  const [finStats, setFinStats] = useState({ pendentes: 0, ultimoContrato: "" });
  // Marketplace summary
  const [mkpStats, setMkpStats] = useState({ ativos: 0, pendentes: 0 });
  // Operational summary
  const [opStats, setOpStats] = useState({ corretoresAtivos: 0, visitasHoje: 0, leadsFila: 0 });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.nome) setNome(data.nome.split(" ")[0]);
    });
  }, [user]);

  // Rotate subtitle
  useEffect(() => {
    const interval = setInterval(() => {
      setSubtitleIdx((prev) => (prev + 1) % subtitles.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Fetch marketing stats
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    Promise.all([
      supabase.from("marketing_entries").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
      supabase.from("conteudos_marketing").select("tema, data_publicacao, status").order("data_publicacao", { ascending: false }).limit(1),
    ]).then(([campaigns, posts]) => {
      setMktStats({
        campanhas: campaigns.count ?? 0,
        leadsHoje: 0,
        leadsSemana: 0,
        ultimoPost: posts.data?.[0]?.tema || "Nenhum ainda",
      });
    });
  }, []);

  // Fetch financeiro stats
  useEffect(() => {
    supabase.from("pagadorias").select("status, created_at").order("created_at", { ascending: false }).then(({ data }) => {
      const pendentes = (data || []).filter((p: any) => p.status === "pendente" || p.status === "rascunho").length;
      setFinStats({ pendentes, ultimoContrato: data?.[0]?.created_at ? format(new Date(data[0].created_at), "dd/MM") : "—" });
    });
  }, []);

  // Fetch marketplace stats
  useEffect(() => {
    supabase.from("marketplace_items").select("status").then(({ data }) => {
      const ativos = (data || []).filter((i: any) => i.status === "aprovado").length;
      const pendentes = (data || []).filter((i: any) => i.status === "pendente").length;
      setMkpStats({ ativos, pendentes });
    });
  }, []);

  // Fetch operational stats
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const fetchOp = async () => {
      const corretores = await supabase.from("team_members").select("id", { count: "exact", head: true }).eq("ativo", true);
      const visitas = await supabase.from("visitas").select("id", { count: "exact", head: true }).eq("data_visita", today);
      const fila = await supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).is("corretor_id", null);
      setOpStats({
        corretoresAtivos: corretores.count ?? 0,
        visitasHoje: visitas.count ?? 0,
        leadsFila: fila.count ?? 0,
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
      color: "from-purple-600 to-purple-400",
      borderColor: "border-purple-500/30",
    },
    {
      icon: DollarSign,
      title: "Financeiro / Pagadorias",
      subtitle: "Comissões e contratos",
      route: "/backoffice/pagadorias",
      color: "from-amber-600 to-amber-400",
      borderColor: "border-amber-500/30",
    },
    {
      icon: ShoppingCart,
      title: "Marketplace Admin",
      subtitle: "Scripts e materiais da equipe",
      route: "/marketplace",
      color: "from-emerald-600 to-emerald-400",
      borderColor: "border-emerald-500/30",
    },
    {
      icon: Settings,
      title: "Administração",
      subtitle: "Configurações do sistema",
      route: "/configuracoes",
      color: "from-slate-600 to-slate-400",
      borderColor: "border-slate-500/30",
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header personalizado */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-purple-600/30">
            AP
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Fala, {nome}! 👋
            </h1>
            <motion.p
              key={subtitleIdx}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-muted-foreground mt-0.5"
            >
              {subtitles[subtitleIdx]}
            </motion.p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground capitalize">{todayFormatted}</p>
        </div>
      </motion.div>

      {/* Quick Access Grid 2x2 */}
      <div className="grid grid-cols-2 gap-4">
        {quickCards.map((card, idx) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
          >
            <Card
              className={`cursor-pointer hover:shadow-lg transition-all duration-200 border ${card.borderColor} hover:scale-[1.01]`}
              onClick={() => navigate(card.route)}
            >
              <CardContent className="p-5">
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-3`}>
                  <card.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-foreground text-base">{card.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>
                <div className="flex items-center gap-1 text-xs font-medium text-purple-400 mt-3">
                  Acessar <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Summary sections - 2 columns */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Marketing Section */}
        <Card className="border-purple-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-purple-500" />
              📣 Atividade de Marketing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Campanhas recentes</span>
              <span className="font-semibold">{mktStats.campanhas}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Último post</span>
              <span className="font-medium text-foreground truncate max-w-[180px]">{mktStats.ultimoPost}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              onClick={() => navigate("/backoffice/marketing")}
            >
              Ir para Central de Marketing →
            </Button>
          </CardContent>
        </Card>

        {/* Financeiro Section */}
        <Card className="border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-500" />
              💰 Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pagadorias pendentes</span>
              <span className="font-semibold">{finStats.pendentes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Último contrato</span>
              <span className="font-medium">{finStats.ultimoContrato}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              onClick={() => navigate("/backoffice/pagadorias")}
            >
              Ir para Pagadorias →
            </Button>
          </CardContent>
        </Card>

        {/* Marketplace Section */}
        <Card className="border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-emerald-500" />
              🛒 Marketplace
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Itens ativos</span>
              <span className="font-semibold">{mkpStats.ativos}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pendentes de aprovação</span>
              <span className="font-semibold">{mkpStats.pendentes}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => navigate("/marketplace")}
            >
              Gerenciar Marketplace →
            </Button>
          </CardContent>
        </Card>

        {/* Operational Overview */}
        <Card className="border-slate-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4 text-slate-400" />
              📋 Visão Geral da Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Corretores ativos
              </span>
              <span className="font-semibold">{opStats.corretoresAtivos}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> Visitas hoje
              </span>
              <span className="font-semibold">{opStats.visitasHoje}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Kanban className="h-3.5 w-3.5" /> Leads na fila
              </span>
              <span className="font-semibold">{opStats.leadsFila}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 italic">Somente leitura — dados consolidados</p>
          </CardContent>
        </Card>
      </div>

      {/* HOMI Alert */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <Card className="border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-white shadow flex items-center justify-center shrink-0">
                <img src="/images/homi-48.png" alt="HOMI" className="h-7 w-7 object-contain" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-500" /> HOMI Ana
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
                  className="text-blue-400 hover:text-blue-300 px-0"
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
