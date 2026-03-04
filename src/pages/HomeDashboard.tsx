import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  ClipboardCheck,
  Crown,
  Shield,
  ArrowRight,
  FileText,
  MessageSquare,
  FileBarChart,
  Filter,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";

export default function HomeDashboard() {
  const { user } = useAuth();
  const { isGestor, isAdmin } = useUserRole();
  const [nome, setNome] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.nome) setNome(data.nome.split(" ")[0]);
    });
  }, [user]);

  const navigate = useNavigate();

  const shortcuts = [
    ...(isGestor ? [
      { title: "Recuperação de Leads", description: "Gerencie e recupere leads com IA", icon: LayoutDashboard, url: "/gestao" },
      { title: "Checkpoint do Gerente", description: "Metas diárias e resultados do time", icon: ClipboardCheck, url: "/checkpoint" },
      { title: "Scripts de Ligação", description: "Gere roteiros de ligação com IA", icon: FileText, url: "/scripts" },
      { title: "Follow Ups", description: "Mensagens de follow-up para WhatsApp", icon: MessageSquare, url: "/scripts" },
      { title: "Relatórios 1:1", description: "Relatórios de performance por corretor", icon: FileBarChart, url: "/relatorios" },
      { title: "Funil Comercial", description: "Leads → Propostas → Vendas (macro)", icon: Filter, url: "/funil" },
    ] : []),
    ...(isAdmin ? [
      { title: "Dashboard CEO", description: "Visão macro consolidada da empresa", icon: Crown, url: "/ceo" },
      { title: "Administração", description: "Gerenciar usuários e configurações", icon: Shield, url: "/admin" },
    ] : []),
  ];

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Hero Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl gradient-hero p-8 lg:p-10"
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-primary/5 rounded-full blur-2xl" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/10 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-xs font-semibold text-primary-foreground/60 uppercase tracking-widest">
              Uhome IA
            </span>
          </div>
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-primary-foreground">
            Olá{nome ? `, ${nome}` : ""}! 👋
          </h1>
          <p className="text-primary-foreground/70 mt-2 text-sm lg:text-base max-w-xl">
            Bem-vindo(a) ao <strong>UHOME IA</strong> — sua plataforma de inteligência e gestão comercial imobiliária.
          </p>
        </div>
      </motion.div>

      {/* Quick Access */}
      <div>
        <h2 className="font-display font-bold text-lg text-foreground mb-1">Acesso Rápido</h2>
        <p className="text-sm text-muted-foreground mb-5">Navegue diretamente para seus módulos</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {shortcuts.map((s, i) => (
            <motion.button
              key={s.url + s.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              onClick={() => navigate(s.url)}
              className="group flex flex-col items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-card hover:shadow-elevated hover:border-primary/20 transition-all duration-200 text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                <s.icon className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="font-display font-semibold text-sm text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.description}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                Acessar <ArrowRight className="h-3 w-3" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
