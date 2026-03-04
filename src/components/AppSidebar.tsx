import { useEffect, useRef } from "react";
import {
  LayoutDashboard,
  ClipboardCheck,
  Shield,
  LogOut,
  User,
  Crown,
  Home,
  FileEdit,
  FileBarChart,
  TrendingUp,
  FileSpreadsheet,
  BarChart3,
  CalendarDays,
  Trophy,
  Phone,
} from "lucide-react";
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
import logoUhomeFull from "@/assets/logo-uhome-full.png";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { isGestor, isAdmin } = useUserRole();
  const { alerts, badges } = useSmartAlerts();
  const toastShown = useRef(false);

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
      ];

  const gestorItems = isGestor
    ? [
        { title: "Checkpoint", url: "/checkpoint", icon: ClipboardCheck },
        { title: "PDN", url: "/pdn", icon: FileSpreadsheet },
        { title: "Central de Dados", url: "/central-dados", icon: BarChart3 },
        { title: "Scripts & Follow Ups", url: "/scripts", icon: FileEdit },
        { title: "Recuperação de Leads", url: "/gestao", icon: LayoutDashboard },
        { title: "Relatórios 1:1", url: "/relatorios", icon: FileBarChart },
        { title: "Ranking Comercial", url: "/ranking", icon: Trophy },
      ]
    : [];

  const ceoItems = isAdmin
    ? [
        { title: "Dashboard CEO", url: "/ceo", icon: Crown },
        { title: "Oferta Ativa", url: "/oferta-ativa", icon: Phone },
        { title: "Inteligência Marketing", url: "/marketing", icon: BarChart3 },
        { title: "Auditoria & Saúde", url: "/auditoria", icon: Shield },
      ]
    : [];

  const adminItems = isAdmin
    ? [
        { title: "Administração", url: "/admin", icon: Shield },
      ]
    : [];

  const renderGroup = (label: string, items: typeof homeItems) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-widest font-semibold mb-1">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const badgeCount = badges[item.url] || 0;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.url}
                    end
                    className="hover:bg-sidebar-accent/60 transition-colors rounded-lg relative"
                    activeClassName="bg-sidebar-primary/15 text-sidebar-primary font-semibold border-l-2 border-sidebar-primary"
                  >
                    <item.icon className="mr-2.5 h-4 w-4 shrink-0" />
                    {!collapsed && <span className="text-[13px]">{item.title}</span>}
                    {badgeCount > 0 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
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

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo Section */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          {collapsed ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary/15 shrink-0">
              <img src={logoUhomeFull} alt="UHome" className="h-6 w-auto brightness-0 invert opacity-80" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <img src={logoUhomeFull} alt="UHome" className="h-8 w-auto brightness-0 invert opacity-90" />
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-sidebar-primary tracking-wider uppercase">Gestão & IA</span>
              </div>
            </div>
          )}
        </div>

        {renderGroup("Principal", homeItems)}
        {gestorItems.length > 0 && renderGroup("Gestão Comercial", gestorItems)}
        {ceoItems.length > 0 && renderGroup("Inteligência CEO", ceoItems)}
        {adminItems.length > 0 && renderGroup("Sistema", adminItems)}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2.5 p-3 border-t border-sidebar-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary/20 shrink-0">
            <User className="h-3.5 w-3.5 text-sidebar-primary" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-sidebar-foreground truncate">
                {user?.email}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="h-7 w-7 p-0 shrink-0 text-sidebar-foreground/50 hover:text-destructive hover:bg-transparent"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
