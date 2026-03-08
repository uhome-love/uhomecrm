import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  ClipboardCheck,
  Shield,
  LogOut,
  Home,
  FileEdit,
  Bot,
  FileBarChart,
  TrendingUp,
  BarChart3,
  CalendarDays,
  Trophy,
  Phone,
  Users,
  SearchCheck,
  Settings,
  Kanban,
  Bell,
  Heart,
  Workflow,
  BookOpen,
  Award,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useSmartAlerts } from "@/hooks/useSmartAlerts";
import { toast } from "sonner";
import { getLevel } from "@/lib/gamification";

const homiMascot = "/images/homi-mascot-opt.png";

type NavItem = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

function SidebarNavGroup({ label, items, badges, collapsed, index }: {
  label: string;
  items: NavItem[];
  badges: Record<string, number>;
  collapsed: boolean;
  index: number;
}) {
  if (items.length === 0) return null;
  return (
    <SidebarGroup key={label} className="animate-fade-in mt-4 first:mt-0" style={{ animationDelay: `${index * 60}ms` }}>
      <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] font-medium tracking-wider uppercase px-3 mb-1">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="space-y-0.5">
          {items.map((item) => {
            const badgeCount = badges[item.url] || 0;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.url}
                    end
                    className="group/nav text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-foreground/5 transition-all duration-150 rounded-r-lg relative py-2 px-3"
                    activeClassName="!text-sidebar-foreground font-medium !bg-sidebar-foreground/[0.08] border-l-2 !border-l-primary rounded-l-none"
                  >
                    <item.icon className="mr-2.5 h-4 w-4 shrink-0 transition-transform duration-150 group-hover/nav:translate-x-0.5" />
                    {!collapsed && (
                      <span className="text-sm">{item.title}</span>
                    )}
                    {badgeCount > 0 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger-500 text-[10px] font-bold text-white px-1 animate-pulse-soft">
                        {badgeCount}
                      </span>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { isGestor, isAdmin } = useUserRole();
  const { alerts, badges } = useSmartAlerts();
  const toastShown = useRef(false);
  const [profile, setProfile] = useState<{ nome: string; avatar_url: string | null }>({ nome: "", avatar_url: null });
  const [points, setPoints] = useState(0);
  const [hoverFooter, setHoverFooter] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("nome, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile({ nome: data.nome, avatar_url: data.avatar_url });
      });
  }, [user]);

  useEffect(() => {
    if (toastShown.current || alerts.length === 0) return;
    toastShown.current = true;
    const critical = alerts.filter(a => a.severity === "critical");
    if (critical.length > 0) {
      setTimeout(() => {
        critical.forEach(a => {
          toast.warning(a.title, { description: a.description, duration: 8000 });
        });
      }, 1500);
    }
  }, [alerts]);

  const level = getLevel(points);
  const isCorretor = !isAdmin && !isGestor;

  // "Minha Rotina" special item (corretor only, above groups)
  const topItem: NavItem | null = isCorretor
    ? { title: "Minha Rotina", url: "/corretor", icon: Home }
    : null;

  // ── Navigation structure by role ──

  const leadsItems: NavItem[] = isAdmin || isGestor
    ? [
        { title: "Pipeline de Leads", url: "/pipeline", icon: Kanban },
        { title: "Oferta Ativa", url: "/oferta-ativa", icon: Phone },
        { title: "Busca de Leads", url: "/busca-leads", icon: SearchCheck },
        { title: "Roleta de Leads", url: "/disponibilidade", icon: LayoutDashboard },
      ]
    : [
        { title: "Pipeline de Leads", url: "/pipeline", icon: Kanban },
        { title: "Oferta Ativa", url: "/oferta-ativa", icon: Phone },
      ];

  const negociosItems: NavItem[] = [
    { title: "Pipeline Negócios", url: "/meus-negocios", icon: Kanban },
    { title: "Agenda de Visitas", url: "/agenda-visitas", icon: CalendarDays },
    ...(isAdmin || isGestor ? [{ title: "Pós-Vendas", url: "/pos-vendas", icon: Heart }] : []),
  ];

  const performanceItems: NavItem[] = isAdmin
    ? [
        { title: "Início", url: "/ceo", icon: Home },
        { title: "Checkpoint e Metas", url: "/checkpoint", icon: ClipboardCheck },
        { title: "Rankings", url: "/ranking", icon: Trophy },
      ]
    : isGestor
    ? [
        { title: "Início", url: "/", icon: Home },
        { title: "Checkpoint e Metas", url: "/checkpoint", icon: ClipboardCheck },
        { title: "Rankings", url: "/ranking", icon: Trophy },
      ]
    : [
        { title: "Meu Desempenho", url: "/corretor/resumo", icon: BarChart3 },
        { title: "Rankings", url: "/ranking", icon: Trophy },
        { title: "Conquistas", url: "/conquistas", icon: Award },
      ];

  const ferramentasItems: NavItem[] = isAdmin
    ? [
        { title: "HOMI CEO", url: "/homi-ceo", icon: Bot },
        { title: "Scripts", url: "/scripts", icon: FileEdit },
        { title: "Marketplace", url: "/marketplace", icon: BookOpen },
        { title: "Automações", url: "/automacoes", icon: Workflow },
        { title: "Notificações", url: "/notificacoes", icon: Bell },
      ]
    : isGestor
    ? [
        { title: "HOMI Gerencial", url: "/homi-gerente", icon: Bot },
        { title: "Scripts", url: "/scripts", icon: FileEdit },
        { title: "Marketplace", url: "/marketplace", icon: BookOpen },
        { title: "Automações", url: "/automacoes", icon: Workflow },
        { title: "Notificações", url: "/notificacoes", icon: Bell },
      ]
    : [
        { title: "HOMI Assistente", url: "/homi", icon: Bot },
        { title: "Meus Scripts", url: "/scripts", icon: FileEdit },
        { title: "Marketplace", url: "/marketplace", icon: BookOpen },
        { title: "Notificações", url: "/notificacoes", icon: Bell },
      ];

  const equipeItems: NavItem[] = isAdmin || isGestor
    ? [
        { title: "Meu Time", url: "/meu-time", icon: Users },
        { title: "Relatórios 1:1", url: "/relatorios", icon: FileBarChart },
      ]
    : [];

  const inteligenciaItems: NavItem[] = isAdmin
    ? [
        { title: "Central de Dados", url: "/central-dados", icon: BarChart3 },
        { title: "Inteligência Marketing", url: "/marketing", icon: TrendingUp },
        { title: "Auditoria & Saúde", url: "/auditoria", icon: Shield },
      ]
    : [];

  const sistemaItems: NavItem[] = isAdmin
    ? [
        { title: "Recuperação de Leads", url: "/gestao", icon: LayoutDashboard },
        { title: "Administração", url: "/admin", icon: Shield },
      ]
    : [];

  const configItems: NavItem[] = [
    { title: "Configurações", url: "/configuracoes", icon: Settings },
  ];

  const groups = [
    { label: "Leads", items: leadsItems },
    { label: "Negócios", items: negociosItems },
    { label: "Performance", items: performanceItems },
    ...(equipeItems.length > 0 ? [{ label: "Equipe", items: equipeItems }] : []),
    { label: "Ferramentas", items: ferramentasItems },
    ...(inteligenciaItems.length > 0 ? [{ label: "Inteligência", items: inteligenciaItems }] : []),
    ...(sistemaItems.length > 0 ? [{ label: "Sistema", items: sistemaItems }] : []),
    { label: "Conta", items: configItems },
  ];

  // Footer initials
  const initials = (profile.nome || user?.email || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join("");

  const roleLabel = isAdmin ? "Admin" : isGestor ? "Gestor" : "Corretor";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="scrollbar-thin">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-sidebar-border/40 shrink-0">
          {collapsed ? (
            <div className="flex h-9 w-9 items-center justify-center shrink-0">
              <img src={homiMascot} alt="Homi" className="h-8 w-8 object-contain" />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 animate-slide-in-left">
              <img src={homiMascot} alt="Homi AI" className="h-9 w-9 object-contain shrink-0" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-sidebar-accent-foreground tracking-tight leading-tight">
                  Uhome<span className="text-sidebar-primary">Sales</span>
                </span>
                <span className="text-[9px] font-medium text-sidebar-foreground/40 tracking-wider">
                  Powered by Homi AI
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Minha Rotina — special top item (corretor only) */}
        {topItem && (
          <SidebarMenu className="px-1 pt-3 pb-0">
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to={topItem.url}
                  end
                  className="group/nav text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-foreground/5 transition-all duration-150 rounded-r-lg relative py-2.5 px-3 font-medium"
                  activeClassName="!text-sidebar-foreground font-semibold !bg-sidebar-foreground/[0.08] border-l-2 !border-l-primary rounded-l-none"
                >
                  <topItem.icon className="mr-2.5 h-4 w-4 shrink-0" />
                  {!collapsed && <span className="text-sm">{topItem.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}

        {groups.map((g, i) => (
          <SidebarNavGroup
            key={g.label}
            label={g.label}
            items={g.items}
            badges={badges}
            collapsed={collapsed}
            index={i}
          />
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div
          className="flex items-center gap-2.5 p-3 border-t border-sidebar-border/40 group/footer"
          onMouseEnter={() => setHoverFooter(true)}
          onMouseLeave={() => setHoverFooter(false)}
        >
          {/* Avatar with initials */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/80 text-primary-foreground text-xs font-bold shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-accent-foreground truncate">
                {profile.nome || user?.email}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 font-medium flex items-center gap-1">
                {roleLabel} · <span>{level.emoji} {level.label}</span>
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className={`h-7 w-7 shrink-0 text-sidebar-foreground/40 hover:text-danger-500 hover:bg-danger-500/10 transition-all duration-150 rounded-lg ${
              hoverFooter ? "opacity-100" : "opacity-0"
            }`}
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
