import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, ClipboardCheck, Crown, Shield, ArrowRight, FileText, MessageSquare, FileBarChart } from "lucide-react";

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
      { title: "Recuperação de Leads", description: "Gerencie e recupere leads com IA", icon: LayoutDashboard, url: "/gestao", color: "bg-primary/10 text-primary" },
      { title: "Checkpoint do Gerente", description: "Metas diárias e resultados do time", icon: ClipboardCheck, url: "/checkpoint", color: "bg-success/10 text-success" },
      { title: "Scripts de Ligação", description: "Gere roteiros de ligação com IA", icon: FileText, url: "/scripts", color: "bg-accent/10 text-accent" },
      { title: "Follow Ups", description: "Mensagens de follow-up para WhatsApp", icon: MessageSquare, url: "/scripts", color: "bg-secondary/10 text-secondary-foreground" },
      { title: "Relatórios 1:1", description: "Relatórios de performance por corretor", icon: FileBarChart, url: "/relatorios", color: "bg-info/10 text-info" },
    ] : []),
    ...(isAdmin ? [
      { title: "Dashboard CEO", description: "Visão macro consolidada da empresa", icon: Crown, url: "/ceo", color: "bg-warning/10 text-warning" },
      { title: "Administração", description: "Gerenciar usuários e configurações", icon: Shield, url: "/admin", color: "bg-info/10 text-info" },
    ] : []),
  ];

  return (
    <div className="p-6 space-y-8">
      {/* Welcome */}
      <div className="rounded-2xl gradient-hero p-8 text-primary-foreground">
        <h1 className="font-display text-3xl font-bold">
          Olá{nome ? `, ${nome}` : ""}! 👋
        </h1>
        <p className="text-primary-foreground/80 mt-2 text-sm max-w-lg">
          Bem-vindo(a) ao <strong>Uhome Gestão e IA</strong> — sua plataforma inteligente de gestão comercial imobiliária.
        </p>
      </div>

      {/* Quick Access */}
      <div>
        <h2 className="font-display font-semibold text-lg text-foreground mb-4">Acesso Rápido</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {shortcuts.map((s) => (
            <button
              key={s.url}
              onClick={() => navigate(s.url)}
              className="group flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 shadow-card hover:shadow-elevated transition-all text-left"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display font-semibold text-sm text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Acessar <ArrowRight className="h-3 w-3" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
