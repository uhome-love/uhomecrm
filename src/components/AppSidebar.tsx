import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  ClipboardCheck,
  Shield,
  LogOut,
  User,
  Crown,
  Home,
  FileEdit,
  Bot,
  FileBarChart,
  TrendingUp,
  FileSpreadsheet,
  BarChart3,
  CalendarDays,
  Trophy,
  Phone,
  Users,
  SearchCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AvatarUpload from "@/components/AvatarUpload";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
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
const homiMascot = "/images/homi-mascot-opt.png";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { isGestor, isAdmin } = useUserRole();
  const { alerts, badges } = useSmartAlerts();
  const toastShown = useRef(false);
  const [profile, setProfile] = useState<{ nome: string; avatar_url: string | null }>({ nome: "", avatar_url: null });

  // Fetch profile for avatar
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

  // Show toast for critical alerts on first load
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

  const homeItems = isGestor || isAdmin
    ? [
        { title: "Início", url: "/", icon: Home },
      ]
    : [
        { title: "Central do Corretor", url: "/corretor", icon: Phone },
        { title: "HOMI Assistente", url: "/homi", icon: Bot },
        { title: "Resumo Semanal", url: "/corretor/resumo", icon: BarChart3 },
        { title: "Ranking OA", url: "/corretor/ranking-equipes", icon: Trophy },
      ];

  const gestorItems = isGestor
    ? [
        { title: "Checkpoint", url: "/checkpoint", icon: ClipboardCheck },
        { title: "PDN", url: "/pdn", icon: FileSpreadsheet },
        { title: "Oferta Ativa", url: "/oferta-ativa", icon: Phone },
        { title: "Scripts", url: "/scripts", icon: FileEdit },
        { title: "Ranking Comercial", url: "/ranking", icon: Trophy },
        { title: "Central de Dados", url: "/central-dados", icon: BarChart3 },
        { title: "Relatórios 1:1", url: "/relatorios", icon: FileBarChart },
        { title: "Meu Time", url: "/meu-time", icon: Users },
        { title: "Busca de Leads", url: "/busca-leads", icon: SearchCheck },
      ]
    : [];

  const ceoItems = isAdmin
    ? [
        { title: "Dashboard CEO", url: "/ceo", icon: Crown },
        { title: "Recuperação de Leads", url: "/gestao", icon: LayoutDashboard },
        { title: "Inteligência Marketing", url: "/marketing", icon: BarChart3 },
        { title: "Auditoria & Saúde", url: "/auditoria", icon: Shield },
        { title: "Busca de Leads", url: "/busca-leads", icon: SearchCheck },
      ]
    : [];

  const adminItems = isAdmin
    ? [
        { title: "Administração", url: "/admin", icon: Shield },
      ]
    : [];

  const renderGroup = (label: string, items: typeof homeItems, index: number) => (
    <SidebarGroup key={label} className="animate-fade-in" style={{ animationDelay: `${index * 80}ms` }}>
      <SidebarGroupLabel className="text-sidebar-foreground/30 uppercase text-[10px] tracking-[0.15em] font-bold mb-1 px-3">
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
                    className="group/nav hover:bg-sidebar-accent/70 transition-all duration-200 rounded-lg relative py-2.5 px-3"
                    activeClassName="bg-sidebar-primary/15 text-sidebar-primary font-semibold border-l-[3px] border-sidebar-primary shadow-[inset_0_0_20px_hsl(229_100%_64%/0.06)]"
                  >
                    <item.icon className="mr-2.5 h-4 w-4 shrink-0 transition-transform duration-200 group-hover/nav:scale-110" />
                    {!collapsed && (
                      <span className="text-[13px] transition-colors duration-200">{item.title}</span>
                    )}
                    {badgeCount > 0 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 animate-pulse-soft">
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

  const groups = [
    { label: "Principal", items: homeItems },
    ...(gestorItems.length > 0 ? [{ label: "Gestão Comercial", items: gestorItems }] : []),
    ...(ceoItems.length > 0 ? [{ label: "Inteligência CEO", items: ceoItems }] : []),
    ...(adminItems.length > 0 ? [{ label: "Sistema", items: adminItems }] : []),
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="scrollbar-thin">
        {/* Logo Section — UhomeSales branding */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border/50">
          {collapsed ? (
            <div className="flex h-11 w-11 items-center justify-center shrink-0">
              <img src={homiMascot} alt="Homi" className="h-10 w-10 object-contain transition-transform duration-300 hover:scale-110" />
            </div>
          ) : (
            <div className="flex items-center gap-3 animate-slide-in-left">
              <img src={homiMascot} alt="Homi AI" className="h-12 w-12 object-contain shrink-0" />
              <div className="flex flex-col">
                <span className="text-[16px] font-display font-extrabold text-sidebar-foreground tracking-tight leading-tight">
                  Uhome<span className="text-sidebar-primary">Sales</span>
                </span>
                <span className="text-[9px] font-medium text-sidebar-foreground/40 tracking-wider">
                  Powered by Homi AI
                </span>
              </div>
            </div>
          )}
        </div>

        {groups.map((g, i) => renderGroup(g.label, g.items, i))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2.5 p-3 border-t border-sidebar-border/50 bg-sidebar-accent/20">
          <AvatarUpload
            avatarUrl={profile.avatar_url}
            nome={profile.nome || user?.email || ""}
            size="sm"
            onUploaded={(url) => setProfile(p => ({ ...p, avatar_url: url }))}
          />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-sidebar-foreground truncate">
                {profile.nome || user?.email}
              </p>
              <p className="text-[9px] text-sidebar-foreground/40 font-medium uppercase tracking-wider">
                {isAdmin ? "Admin" : isGestor ? "Gestor" : "Corretor"}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="h-7 w-7 p-0 shrink-0 text-sidebar-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all duration-200 rounded-lg"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
