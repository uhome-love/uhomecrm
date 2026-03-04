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
  Filter,
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

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isGestor, isAdmin } = useUserRole();

  const mainItems = [
    { title: "Início", url: "/", icon: Home },
    ...(isGestor
      ? [
          { title: "Recuperação de Leads", url: "/gestao", icon: LayoutDashboard },
          { title: "Checkpoint", url: "/checkpoint", icon: ClipboardCheck },
          { title: "Scripts & Follow Ups", url: "/scripts", icon: FileEdit },
          { title: "Relatórios 1:1", url: "/relatorios", icon: FileBarChart },
          { title: "Funil Comercial", url: "/funil", icon: Filter },
        ]
      : []),
  ];

  const adminItems = isAdmin
    ? [
        { title: "Dashboard CEO", url: "/ceo", icon: Crown },
        { title: "Administração", url: "/admin", icon: Shield },
      ]
    : [];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo Uhome */}
        <div className="flex items-center gap-2.5 p-4 border-b border-sidebar-border">
          <img src="/logo-uhome.svg" alt="Uhome Gestão e IA" className="h-8 w-auto shrink-0" />
          {!collapsed && (
            <span className="font-display text-xs font-medium text-sidebar-foreground/60 tracking-wide uppercase">
              Gestão e IA
            </span>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Sistema</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 p-3 border-t border-sidebar-border">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-accent shrink-0">
            <User className="h-3.5 w-3.5 text-sidebar-foreground" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {user?.email}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="h-7 w-7 p-0 shrink-0 text-sidebar-foreground hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
