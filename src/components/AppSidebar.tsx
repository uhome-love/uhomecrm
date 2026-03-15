import UhomeLogo from "@/components/UhomeLogo";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
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
  Brain,
  BookOpen,
  Award,
  PanelLeftOpen,
  PanelLeftClose,
  MessageSquare,
  Building2,
  Cog,
  GraduationCap,
  ListChecks,
  Inbox,
  MailCheck,
  Briefcase,
  Store,
  ListTodo,
  PhoneCall,
  PackageCheck,
  Zap,
  Radio,
  Megaphone,
  Terminal,
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
import { cn } from "@/lib/utils";
import CorretorAvatar from "@/components/corretor/CorretorAvatar";

const homiMascot = "/images/homi-48.png";

type NavItem = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

const COLLAPSED_BY_DEFAULT = new Set(["Visão Geral", "Gestão de Leads", "Gestão de Vendas", "Performance", "Marketing", "Financeiro", "Operacional", "RH & Recepção", "Ferramentas", "Campanhas Comerciais"]);

function SidebarNavGroup({ label, items, badges, collapsed, index }: {
  label: string;
  items: NavItem[];
  badges: Record<string, number>;
  collapsed: boolean;
  index: number;
}) {
  if (items.length === 0) return null;

  const location = useLocation();
  const currentPath = location.pathname;

  // Auto-expand group if any child route is active
  const hasActiveChild = items.some((item) => currentPath === item.url || currentPath.startsWith(item.url + "/"));

  const shouldCollapse = COLLAPSED_BY_DEFAULT.has(label);

  const menuContent = (
    <SidebarMenu className="gap-0.5">
      {items.map((item) => {
        const badgeCount = badges[item.url] || 0;
        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild tooltip={item.title}>
              <NavLink
                to={item.url}
                end={!item.url.includes("/backoffice/")}
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
  );

  if (shouldCollapse && !collapsed) {
    return (
      <SidebarGroup className="animate-fade-in mt-4 first:mt-0 py-0" style={{ animationDelay: `${index * 60}ms` }}>
        <Collapsible defaultOpen={hasActiveChild}>
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 mb-1 group/trigger">
            <span className={cn(
              "text-[10px] font-medium tracking-widest uppercase",
              hasActiveChild ? "text-blue-400" : "text-neutral-500"
            )}>
              {label}
            </span>
            <ChevronDown className="h-3 w-3 text-neutral-500 transition-transform duration-200 group-data-[state=open]/trigger:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarGroupContent>
              {menuContent}
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup key={label} className="animate-fade-in mt-4 first:mt-0 py-0" style={{ animationDelay: `${index * 60}ms` }}>
      {collapsed ? (
        index > 0 ? <div className="border-t border-white/10 my-1 mx-2" /> : null
      ) : (
        <SidebarGroupLabel className={cn(
          "text-[10px] font-medium tracking-widest uppercase px-3 mb-1",
          hasActiveChild ? "text-blue-400" : "text-neutral-500"
        )}>
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        {menuContent}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { isGestor, isAdmin, isBackoffice, isRh } = useUserRole();
  const { alerts, badges } = useSmartAlerts();
  const toastShown = useRef(false);
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ nome: string; avatar_url: string | null; avatar_preview_url: string | null }>({ nome: "", avatar_url: null, avatar_preview_url: null });
  const [points, setPoints] = useState(0);
  const [hoverFooter, setHoverFooter] = useState(false);
  const [roletaPendentes, setRoletaPendentes] = useState(0);
  const [tarefasPendentes, setTarefasPendentes] = useState(0);
  const [aceiteLeadsPendentes, setAceiteLeadsPendentes] = useState(0);
  const [alertasPendentes, setAlertasPendentes] = useState(0);

  const fetchProfile = useCallback(() => {
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

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    const handler = () => fetchProfile();
    window.addEventListener("profile-updated", handler);
    return () => window.removeEventListener("profile-updated", handler);
  }, [fetchProfile]);

  // Fetch roleta pending approvals count for CEO
  const fetchRoletaPendentes = useCallback(async () => {
    if (!isAdmin) return;
    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const { count } = await supabase
      .from("roleta_credenciamentos")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente")
      .eq("data", hoje);
    setRoletaPendentes(count ?? 0);
  }, [isAdmin]);

  useEffect(() => {
    fetchRoletaPendentes();
    if (!isAdmin) return;
    const interval = setInterval(fetchRoletaPendentes, 30_000);
    return () => clearInterval(interval);
  }, [fetchRoletaPendentes, isAdmin]);

  // Fetch tarefas pendentes count for corretor badge
  const fetchTarefasPendentes = useCallback(async () => {
    if (!user) return;
    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const { count } = await supabase
      .from("pipeline_tarefas")
      .select("id", { count: "exact", head: true })
      .or(`responsavel_id.eq.${user.id},created_by.eq.${user.id}`)
      .eq("status", "pendente")
      .lte("vence_em", hoje);
    setTarefasPendentes(count ?? 0);
  }, [user]);

  useEffect(() => {
    fetchTarefasPendentes();
    const interval = setInterval(fetchTarefasPendentes, 60_000);
    return () => clearInterval(interval);
  }, [fetchTarefasPendentes]);

  // Fetch aceite leads pendentes for corretor
  const fetchAceitePendentes = useCallback(async () => {
    if (!user || isAdmin || isGestor || isBackoffice) return;
    const now = new Date().toISOString();
    const { count } = await supabase
      .from("pipeline_leads")
      .select("id", { count: "exact", head: true })
      .eq("corretor_id", user.id)
      .eq("aceite_status", "pendente")
      .gt("aceite_expira_em", now);
    setAceiteLeadsPendentes(count ?? 0);
  }, [user, isAdmin, isGestor, isBackoffice]);

  useEffect(() => {
    fetchAceitePendentes();
    const interval = setInterval(fetchAceitePendentes, 15_000);
    return () => clearInterval(interval);
  }, [fetchAceitePendentes]);

  // Fetch homi_alerts unread count for CEO/Gestor badge
  const fetchAlertasPendentes = useCallback(async () => {
    if (!user || (!isAdmin && !isGestor)) return;
    const { count } = await (supabase as any)
      .from("homi_alerts")
      .select("id", { count: "exact", head: true })
      .eq("destinatario_id", user.id)
      .eq("dispensada", false)
      .eq("lida", false)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    setAlertasPendentes(count ?? 0);
  }, [user, isAdmin, isGestor]);

  useEffect(() => {
    fetchAlertasPendentes();
    if (!isAdmin && !isGestor) return;
    const interval = setInterval(fetchAlertasPendentes, 60_000);
    return () => clearInterval(interval);
  }, [fetchAlertasPendentes, isAdmin, isGestor]);

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
  function getGroupsByRole(): { topItem: NavItem | null; groups: { label: string; items: NavItem[] }[]; roleLabel: string; extraBadges?: Record<string, number> } {
    // ── CEO / Admin ──
    if (isAdmin) {
      const alertasBadges: Record<string, number> = alertasPendentes > 0 ? { "/alertas": alertasPendentes } : {};
      const roletaBadges: Record<string, number> = { ...alertasBadges, ...(roletaPendentes > 0 ? { "/roleta": roletaPendentes } : {}) };
      return {
        topItem: { title: "Dashboard CEO", url: "/ceo", icon: Home },
        groups: [
          {
            label: "Visão Geral",
            items: [
              { title: "Alertas HOMI", url: "/alertas", icon: Bell },
              { title: "Meu Time", url: "/meu-time", icon: Users },
              { title: "Central do Gerente", url: "/central-do-gerente", icon: ClipboardCheck },
            ],
          },
          {
            label: "Gestão de Leads",
            items: [
              { title: "Roleta de Leads", url: "/roleta", icon: Cog },
              { title: "Pipeline de Leads", url: "/pipeline-leads", icon: Kanban },
              { title: "Anúncios no Ar", url: "/anuncios", icon: Radio },
              { title: "Imóveis", url: "/imoveis", icon: Building2 },
              { title: "Oferta Ativa", url: "/oferta-ativa", icon: Phone },
              { title: "Agenda de Visitas", url: "/agenda-visitas", icon: CalendarDays },
              { title: "Busca de Leads", url: "/busca-leads", icon: SearchCheck },
            ],
          },
          {
            label: "Gestão de Vendas",
            items: [
              { title: "Pipeline Negócios", url: "/pipeline-negocios", icon: Kanban },
              { title: "Vendas Realizadas", url: "/vendas-realizadas", icon: Trophy },
              { title: "Pós-Vendas", url: "/pos-vendas", icon: PackageCheck },
            ],
          },
          {
            label: "Performance",
            items: [
              { title: "Rankings", url: "/ranking", icon: Trophy },
              { title: "Relatórios 1:1", url: "/relatorios", icon: FileBarChart },
            ],
          },
          {
            label: "Operacional",
            items: [
              { title: "Central de Marketing", url: "/marketing", icon: TrendingUp },
              { title: "Tarefas & Marketing", url: "/backoffice/tarefas", icon: ClipboardCheck },
            ],
          },
          {
            label: "RH & Recepção",
            items: [
              { title: "Candidatos", url: "/rh/recrutamento", icon: Users },
              { title: "Entrevistas", url: "/rh/entrevistas", icon: CalendarDays },
              { title: "Conversas 1:1", url: "/rh/conversas", icon: MessageSquare },
              { title: "Sala de Reunião", url: "/rh/sala-reuniao", icon: CalendarDays },
            ],
          },
          {
            label: "Ferramentas",
            items: [
              { title: "HOMI CEO", url: "/homi-ceo", icon: Bot },
              { title: "Base HOMI", url: "/homi/base-conhecimento", icon: Brain },
              { title: "Integração", url: "/integracao", icon: Zap },
              { title: "Academia", url: "/academia/gerenciar", icon: GraduationCap },
              { title: "Dev AI", url: "/dev-ai", icon: Terminal },
              { title: "Usuários", url: "/admin", icon: Shield },
            ],
          },
        ],
        roleLabel: "Admin · 👑 CEO",
        extraBadges: roletaBadges,
      };
    }

    // ── Gestor ──
    if (isGestor) {
      return {
        topItem: { title: "Dashboard", url: "/gerente/dashboard", icon: Home },
        groups: [
          {
            label: "Visão Geral",
            items: [
              { title: "Alertas HOMI", url: "/alertas", icon: Bell },
              { title: "Central do Gerente", url: "/central-do-gerente", icon: ClipboardCheck },
            ],
          },
          {
            label: "Gestão de Leads",
            items: [
              { title: "Anúncios no Ar", url: "/anuncios", icon: Radio },
              { title: "Oferta Ativa", url: "/oferta-ativa", icon: Phone },
              { title: "Pipeline de Leads", url: "/pipeline-leads", icon: Kanban },
              { title: "Agenda de Visitas", url: "/agenda-visitas", icon: CalendarDays },
              { title: "Busca de Leads", url: "/busca-leads", icon: SearchCheck },
            ],
          },
          {
            label: "Gestão de Negócios",
            items: [
              { title: "Pipeline Negócios", url: "/pipeline-negocios", icon: Kanban },
              { title: "Vendas Realizadas", url: "/vendas-realizadas", icon: Trophy },
              { title: "Pós-Vendas", url: "/pos-vendas", icon: PackageCheck },
            ],
          },
          {
            label: "Performance",
            items: [
              { title: "Rankings", url: "/ranking", icon: Trophy },
              { title: "Relatórios 1:1", url: "/relatorios", icon: FileBarChart },
            ],
          },
          {
            label: "Ferramentas",
            items: [
              { title: "Meu Time", url: "/meu-time", icon: Users },
              { title: "HOMI Gerente", url: "/homi-gerente", icon: Bot },
              { title: "Imóveis", url: "/imoveis", icon: Building2 },
              { title: "Academia", url: "/academia/gerenciar", icon: Award },
              { title: "Templates", url: "/templates-comunicacao", icon: MessageSquare },
              { title: "Marketplace", url: "/marketplace", icon: BookOpen },
            ],
          },
        ],
        roleLabel: `Gerente · Time ${profile.nome?.split(" ")[0] || ""}`,
        extraBadges: alertasPendentes > 0 ? { "/alertas": alertasPendentes } : {},
      };
    }

    // ── Backoffice ──
    if (isBackoffice) {
      return {
        topItem: { title: "Dashboard", url: "/backoffice", icon: Home },
        groups: [
          {
            label: "Operacional",
            items: [
              { title: "Tarefas & Marketing", url: "/backoffice/tarefas", icon: ListChecks },
              { title: "HOMI Ana", url: "/backoffice/homi-ana", icon: Bot },
            ],
          },
          {
            label: "Financeiro",
            items: [
              { title: "Pagadorias", url: "/backoffice/pagadorias", icon: FileBarChart },
              { title: "Solicitações", url: "/backoffice/solicitacoes-pagadoria", icon: ListChecks },
              { title: "Cadastros", url: "/backoffice/cadastros", icon: Users },
            ],
          },
          {
            label: "Mais",
            items: [
              { title: "Marketplace", url: "/marketplace", icon: BookOpen },
            ],
          },
        ],
        roleLabel: "Backoffice · 💜 Admin",
      };
    }

    // ── RH ──
    if (isRh) {
      return {
        topItem: { title: "Dashboard RH", url: "/rh", icon: Home },
        groups: [
          {
            label: "Recrutamento",
            items: [
              { title: "Candidatos", url: "/rh/recrutamento", icon: Users },
              { title: "Entrevistas", url: "/rh/entrevistas", icon: CalendarDays },
            ],
          },
          {
            label: "RH",
            items: [
              { title: "Conversas 1:1", url: "/rh/conversas", icon: MessageSquare },
            ],
          },
          {
            label: "Recepção",
            items: [
              { title: "Sala de Reunião", url: "/rh/sala-reuniao", icon: CalendarDays },
            ],
          },
        ],
        roleLabel: "RH · 💙 Carol",
      };
    }

    // ── Corretor (default) ──

    return {
      topItem: { title: "Minha Rotina", url: "/corretor", icon: Home },
      groups: [
        {
          label: "Gestão Comercial",
          items: [
            { title: "Agenda de Tarefas", url: "/minhas-tarefas", icon: ListTodo },
            { title: "Anúncios no Ar", url: "/anuncios", icon: Megaphone },
            { title: "Pipeline de Leads", url: "/pipeline-leads", icon: Kanban },
            { title: "Agenda de Visitas", url: "/agenda-visitas", icon: CalendarDays },
            { title: "Pipeline Negócios", url: "/pipeline-negocios", icon: Briefcase },
            { title: "Vendas Realizadas", url: "/vendas-realizadas", icon: Trophy },
            { title: "Pós-Vendas", url: "/pos-vendas", icon: PackageCheck },
          ],
        },
        {
          label: "Prospecção",
          items: [
            { title: "Oferta Ativa", url: "/corretor/call", icon: PhoneCall },
            { title: "Aceite de Leads", url: "/aceite", icon: MailCheck },
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
            { title: "Imóveis", url: "/imoveis", icon: Home },
            { title: "HOMI Assistente", url: "/homi", icon: Bot },
            { title: "Academia", url: "/academia", icon: GraduationCap },
            { title: "Meus Scripts", url: "/scripts", icon: FileEdit },
            { title: "Marketplace", url: "/marketplace", icon: Store },
          ],
        },
      ],
      roleLabel: `Corretor · ${level.emoji} ${level.label}`,
    };
  }

  const { topItem, groups, roleLabel, extraBadges } = getGroupsByRole();
  const tarefaBadges: Record<string, number> = tarefasPendentes > 0 ? { "/minhas-tarefas": tarefasPendentes } : {};
  const aceiteBadges: Record<string, number> = aceiteLeadsPendentes > 0 ? { "/aceite": aceiteLeadsPendentes } : {};
  const mergedBadges = { ...badges, ...extraBadges, ...tarefaBadges, ...aceiteBadges };

  // Footer initials
  const initials = (profile.nome || user?.email || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join("");

  

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="flex flex-col [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Logo + Toggle */}
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-3 h-14 border-b border-white/10 shrink-0`}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleSidebar}
                  className="flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                >
                  <UhomeLogo size="sm" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-neutral-900 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg">
                Expandir sidebar
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              <div className="flex items-center animate-slide-in-left">
                <UhomeLogo size="md" showTagline />
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

        {/* Top item */}
        {topItem && (
          <div className={`border-b border-white/10 pb-3 mb-1 ${collapsed ? "px-1" : ""}`}>
            <SidebarMenu className="px-1 pt-3 gap-0.5">
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

        {/* Campanhas Comerciais - collapsible */}
        {!collapsed ? (
          <Collapsible defaultOpen className="border-b border-white/10 pb-2 mb-1">
            <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white/40 hover:text-white/60 transition-colors">
              <span>Campanhas Comerciais</span>
              <ChevronDown className="h-3 w-3 transition-transform duration-200 [&[data-state=open]]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="px-1 gap-0.5">
                {new Date() <= new Date("2026-03-31T23:59:59") && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Melnick Day">
                      <NavLink
                        to="/melnick-day"
                        end
                        className={`group/nav text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition-all duration-150 rounded-lg relative py-1.5 font-medium px-3`}
                        activeClassName="!text-amber-200 !font-semibold !bg-amber-500/15 border-l-2 !border-l-amber-400 !rounded-l-none rounded-r-lg"
                      >
                        <Zap className="mr-2.5 h-4 w-4 shrink-0 text-amber-400" />
                        <span className="text-sm">⚡ Melnick Day</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Orygem 60 dias">
                    <NavLink
                      to="/orygem-60"
                      end
                      className={`group/nav text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 transition-all duration-150 rounded-lg relative py-1.5 font-medium px-3`}
                      activeClassName="!text-emerald-200 !font-semibold !bg-emerald-500/15 border-l-2 !border-l-emerald-400 !rounded-l-none rounded-r-lg"
                    >
                      <Home className="mr-2.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span className="text-sm">🏠 Orygem 60 dias</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Mega da Cyrela">
                    <NavLink
                      to="/mega-cyrela"
                      end
                      className={`group/nav text-[#d4af37] hover:text-[#e5c04a] hover:bg-[#d4af37]/10 transition-all duration-150 rounded-lg relative py-1.5 font-medium px-3`}
                      activeClassName="!text-[#e5c04a] !font-semibold !bg-[#d4af37]/15 border-l-2 !border-l-[#d4af37] !rounded-l-none rounded-r-lg"
                    >
                      <Trophy className="mr-2.5 h-4 w-4 shrink-0 text-[#d4af37]" />
                      <span className="text-sm">⚽ Mega da Cyrela</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <div className="border-b border-white/10 pb-2 mb-1 px-1">
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Melnick Day">
                  <NavLink to="/melnick-day" end className="justify-center text-amber-300 hover:bg-amber-500/10 rounded-lg py-1.5" activeClassName="!bg-amber-500/15">
                    <Zap className="h-4 w-4 text-amber-400" />
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Orygem 60 dias">
                  <NavLink to="/orygem-60" end className="justify-center text-emerald-300 hover:bg-emerald-500/10 rounded-lg py-1.5" activeClassName="!bg-emerald-500/15">
                    <Home className="h-4 w-4 text-emerald-400" />
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Mega da Cyrela">
                  <NavLink to="/mega-cyrela" end className="justify-center text-[#d4af37] hover:bg-[#d4af37]/10 rounded-lg py-1.5" activeClassName="!bg-[#d4af37]/15">
                    <Trophy className="h-4 w-4 text-[#d4af37]" />
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {groups.map((g, i) => (
            <SidebarNavGroup
              key={g.label}
              label={g.label}
              items={g.items}
              badges={mergedBadges}
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
