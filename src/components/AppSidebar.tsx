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
  PanelLeftOpen,
  PanelLeftClose,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useSmartAlerts } from "@/hooks/useSmartAlerts";
import { toast } from "sonner";
import { getLevel } from "@/lib/gamification";
import { useNavigate } from "react-router-dom";
import CorretorAvatar from "@/components/corretor/CorretorAvatar";

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
    <SidebarGroup key={label} className="animate-fade-in mt-4 first:mt-0 py-0" style={{ animationDelay: `${index * 60}ms` }}>
      {collapsed ? (
        /* Collapsed: thin separator line instead of label */
        index > 0 ? <div className="border-t border-white/10 my-1 mx-2" /> : null
      ) : (
        <SidebarGroupLabel className="text-neutral-500 text-[10px] font-medium tracking-widest uppercase px-3 mb-1">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => {
            const badgeCount = badges[item.url] || 0;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title}>
                  <NavLink
                    to={item.url}
                    end
                    className={`group/nav text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-all duration-150 rounded-lg relative py-1.5 ${collapsed ? "px-0 justify-center" : "px-3"}`}
                    activeClassName="!text-white !font-semibold !bg-white/10 border-l-2 !border-l-blue-400 !rounded-l-none rounded-r-lg [&_svg]:!text-blue-400"
                  >
                    <item.icon className={`${collapsed ? "" : "mr-2.5"} h-4 w-4 shrink-0 text-neutral-400 group-[.active]/nav:text-blue-400 transition-colors duration-150`} />
                    {!collapsed && (
                      <span className="text-sm">{item.title}</span>
                    )}
                    {badgeCount > 0 && !collapsed && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger-500 text-[10px] font-bold text-white px-1 animate-pulse-soft">
                        {badgeCount}
                      </span>
                    )}
                    {badgeCount > 0 && collapsed && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 rounded-full bg-danger-500 animate-pulse-soft" />
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
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { isGestor, isAdmin, isBackoffice } = useUserRole();
  const { alerts, badges } = useSmartAlerts();
  const toastShown = useRef(false);
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ nome: string; avatar_url: string | null; avatar_preview_url: string | null }>({ nome: "", avatar_url: null, avatar_preview_url: null });
  const [points, setPoints] = useState(0);
  const [hoverFooter, setHoverFooter] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("nome, avatar_url, avatar_preview_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile({ nome: data.nome, avatar_url: data.avatar_url, avatar_preview_url: data.avatar_preview_url });
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

  // ── Build navigation groups by role ──
  function getGroupsByRole(): { topItem: NavItem | null; groups: { label: string; items: NavItem[] }[]; roleLabel: string } {
    // ── CEO / Admin ──
    if (isAdmin) {
      return {
        topItem: null,
        groups: [
          {
            label: "Visão Geral",
            items: [
              { title: "Dashboard CEO", url: "/ceo", icon: Home },
              { title: "Painel da Equipe", url: "/meu-time", icon: Users },
            ],
          },
          {
            label: "Leads & Vendas",
            items: [
              { title: "Pipeline de Leads", url: "/pipeline", icon: Kanban },
              { title: "Pipeline Negócios", url: "/meus-negocios", icon: Kanban },
              { title: "Busca de Leads", url: "/busca-leads", icon: SearchCheck },
              { title: "Roleta de Leads", url: "/disponibilidade", icon: LayoutDashboard },
            ],
          },
          {
            label: "Performance",
            items: [
              { title: "Rankings", url: "/ranking", icon: Trophy },
            ],
          },
          {
            label: "Financeiro",
            items: [
              { title: "Pagadorias", url: "/backoffice/pagadorias", icon: FileBarChart },
            ],
          },
          {
            label: "Marketing",
            items: [
              { title: "Central de Marketing", url: "/marketing", icon: TrendingUp },
            ],
          },
          {
            label: "Ferramentas",
            items: [
              { title: "HOMI CEO", url: "/homi-ceo", icon: Bot },
              { title: "Marketplace", url: "/marketplace", icon: BookOpen },
              { title: "Configurações", url: "/configuracoes", icon: Settings },
              { title: "Gerenciar Usuários", url: "/admin", icon: Shield },
            ],
          },
        ],
        roleLabel: "Admin · 👑 CEO",
      };
    }

    // ── Gestor ──
    if (isGestor) {
      return {
        topItem: null,
        groups: [
          {
            label: "Leads",
            items: [
              { title: "Pipeline de Leads", url: "/pipeline", icon: Kanban },
              { title: "Oferta Ativa", url: "/oferta-ativa", icon: Phone },
              { title: "Busca de Leads", url: "/busca-leads", icon: SearchCheck },
            ],
          },
          {
            label: "Negócios",
            items: [
              { title: "Pipeline Negócios", url: "/meus-negocios", icon: Kanban },
              { title: "Agenda de Visitas", url: "/agenda-visitas", icon: CalendarDays },
            ],
          },
          {
            label: "Equipe",
            items: [
              { title: "Meu Time", url: "/meu-time", icon: Users },
              { title: "Relatórios 1:1", url: "/relatorios", icon: FileBarChart },
            ],
          },
          {
            label: "Performance",
            items: [
              { title: "Rankings", url: "/ranking", icon: Trophy },
              { title: "Checkpoint e Metas", url: "/checkpoint", icon: ClipboardCheck },
            ],
          },
          {
            label: "Ferramentas",
            items: [
              { title: "HOMI Assistente", url: "/homi-gerente", icon: Bot },
              { title: "Marketplace", url: "/marketplace", icon: BookOpen },
            ],
          },
        ],
        roleLabel: `Gestor · ${level.emoji} ${level.label}`,
      };
    }

    // ── Backoffice ──
    if (isBackoffice) {
      return {
        topItem: null,
        groups: [
          {
            label: "Financeiro",
            items: [
              { title: "Pagadorias", url: "/backoffice/pagadorias", icon: FileBarChart },
            ],
          },
          {
            label: "Marketing",
            items: [
              { title: "Central de Marketing", url: "/backoffice/marketing", icon: BarChart3 },
            ],
          },
          {
            label: "Ferramentas",
            items: [
              { title: "HOMI Ana", url: "/backoffice/homi-ana", icon: Bot },
              { title: "Marketplace", url: "/marketplace", icon: BookOpen },
            ],
          },
        ],
        roleLabel: "Backoffice",
      };
    }

    // ── Corretor (default) ──
    return {
      topItem: { title: "Minha Rotina", url: "/corretor", icon: Home },
      groups: [
        {
          label: "Leads",
          items: [
            { title: "Pipeline de Leads", url: "/pipeline", icon: Kanban },
            { title: "Oferta Ativa", url: "/corretor/call", icon: Phone },
          ],
        },
        {
          label: "Negócios",
          items: [
            { title: "Pipeline Negócios", url: "/meus-negocios", icon: Kanban },
            { title: "Agenda de Visitas", url: "/agenda-visitas", icon: CalendarDays },
          ],
        },
        {
          label: "Performance",
          items: [
            { title: "Meu Desempenho", url: "/corretor/resumo", icon: BarChart3 },
            { title: "Rankings", url: "/corretor/ranking-equipes", icon: Trophy },
            { title: "Conquistas", url: "/conquistas", icon: Award },
          ],
        },
        {
          label: "Ferramentas",
          items: [
            { title: "HOMI Assistente", url: "/homi", icon: Bot },
            { title: "Meus Scripts", url: "/scripts", icon: FileEdit },
            { title: "Marketplace", url: "/marketplace", icon: BookOpen },
            { title: "Notificações", url: "/notificacoes", icon: Bell },
          ],
        },
      ],
      roleLabel: `Corretor · ${level.emoji} ${level.label}`,
    };
  }

  const { topItem, groups, roleLabel } = getGroupsByRole();

  // Footer initials
  const initials = (profile.nome || user?.email || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join("");

  

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="scrollbar-thin flex flex-col">
        {/* Logo + Toggle */}
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-3 h-14 border-b border-white/10 shrink-0`}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleSidebar}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-neutral-900 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg">
                Expandir sidebar
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              <div className="flex items-center gap-2.5 animate-slide-in-left">
                <img src={homiMascot} alt="Homi AI" className="h-9 w-9 object-contain shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white tracking-tight leading-tight">
                    Uhome<span className="text-blue-400">Sales</span>
                  </span>
                  <span className="text-[9px] font-medium text-neutral-500 tracking-wider">
                    Powered by Homi AI
                  </span>
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleSidebar}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-neutral-900 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg">
                  Recolher sidebar
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* Minha Rotina — special top item (corretor only) */}
        {topItem && (
          <div className={`border-b border-white/10 pb-3 mb-1 ${collapsed ? "px-1" : ""}`}>
            <SidebarMenu className="px-1 pt-3">
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={topItem.title}>
                  <NavLink
                    to={topItem.url}
                    end
                    className={`group/nav text-white hover:text-white hover:bg-white/[0.08] transition-all duration-150 rounded-lg relative py-1.5 font-medium ${collapsed ? "px-0 justify-center" : "px-3"}`}
                    activeClassName="!text-white !font-semibold !bg-white/10 border-l-2 !border-l-blue-400 !rounded-l-none rounded-r-lg"
                  >
                    <topItem.icon className={`${collapsed ? "" : "mr-2.5"} h-4 w-4 shrink-0 text-white/70`} />
                    {!collapsed && <span className="text-sm">{topItem.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
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
        </div>
      </SidebarContent>

      <SidebarFooter className="!p-0">
        <div
          className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5"} py-3 px-3 border-t border-white/10 group/footer sticky bottom-0 bg-sidebar`}
          onMouseEnter={() => setHoverFooter(true)}
          onMouseLeave={() => setHoverFooter(false)}
        >
          {collapsed ? (
            /* Collapsed: just the avatar circle with tooltip */
            <Tooltip>
              <TooltipTrigger asChild>
              <button onClick={() => navigate("/configuracoes")} className="shrink-0">
                  <CorretorAvatar
                    nome={profile.nome || user?.email || "U"}
                    avatarUrl={profile.avatar_url}
                    avatarPreviewUrl={profile.avatar_preview_url}
                    points={points}
                    size="sm"
                    showBadges={false}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-neutral-900 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg">
                <p className="font-medium">{profile.nome || user?.email}</p>
                <p className="text-xs text-neutral-400">{roleLabel}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              <CorretorAvatar
                nome={profile.nome || user?.email || "U"}
                avatarUrl={profile.avatar_url}
                avatarPreviewUrl={profile.avatar_preview_url}
                points={points}
                size="sm"
                showBadges={false}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {profile.nome || user?.email}
                </p>
                <p className="text-xs text-neutral-400 font-medium flex items-center gap-1">
                  {roleLabel}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className={`h-7 w-7 shrink-0 text-neutral-400 hover:text-danger-500 hover:bg-danger-500/10 transition-all duration-150 rounded-lg ${
                  hoverFooter ? "opacity-100" : "opacity-0"
                }`}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
