import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutGrid, CheckCircle, FileText, Target, AlignLeft,
  CalendarDays, Home, Phone, Search, Megaphone,
  BarChart3, TrendingUp, Heart, Star, Mail,
  MessageSquare, Sparkles, Bot, BookOpen,
  Users, Briefcase, Video, Zap, ChevronRight,
  Sun, Moon, ShieldCheck, ClipboardList, Wrench,
  Trophy, GraduationCap, Lightbulb, Layers,
  Building2, Wallet, ListTodo, Database,
  BarChart2, GitBranch, Award, BellRing,
  UserCheck, Clock, LineChart, PieChart, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import UhomeLogo from "@/components/UhomeLogo";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// ─── TYPES ───────────────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: string | number;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

type UserRole = "admin" | "gestor" | "corretor" | "backoffice" | "rh";

// ─── CAMPAIGN CONFIG ─────────────────────────────────────────────────────────

const CAMPAIGNS = [
  { label: "Melnick Day",      path: "/melnick-metas",      color: "#f59e0b" },
  { label: "Orygem 60 dias",   path: "/campanhas/orygem",   color: "#10b981" },
  { label: "Mega da Cyrela",   path: "/campanhas/cyrela",   color: "#8b5cf6" },
];

// ─── NAV CONFIG POR PERFIL ───────────────────────────────────────────────────

const NAV_BY_ROLE: Record<UserRole, NavGroup[]> = {

  // ── ADMIN / CEO ────────────────────────────────────────────────────────────
  admin: [
    {
      title: "Principal",
      items: [
        { label: "Dashboard",          path: "/ceo",               icon: <LayoutGrid   size={15} strokeWidth={1.5} /> },
        { label: "Relatório semanal",  path: "/relatorio-semanal", icon: <FileText     size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Leads",
      items: [
        { label: "Roleta",             path: "/roleta",            icon: <Target       size={15} strokeWidth={1.5} /> },
        { label: "Pipeline de leads",  path: "/pipeline-leads",    icon: <AlignLeft    size={15} strokeWidth={1.5} /> },
        { label: "Agenda de visitas",  path: "/agenda-visitas",    icon: <CalendarDays size={15} strokeWidth={1.5} /> },
        { label: "Imóveis",            path: "/imoveis",           icon: <Home         size={15} strokeWidth={1.5} /> },
        { label: "Oferta ativa",       path: "/oferta-ativa",      icon: <Phone        size={15} strokeWidth={1.5} /> },
        { label: "Busca de leads",     path: "/busca-leads",       icon: <Search       size={15} strokeWidth={1.5} /> },
        { label: "Anúncios no ar",     path: "/anuncios",          icon: <Megaphone    size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Vendas",
      items: [
        { label: "Pipeline negócios",  path: "/pipeline-negocios", icon: <BarChart3    size={15} strokeWidth={1.5} /> },
        { label: "Vendas realizadas",  path: "/vendas-realizadas", icon: <TrendingUp   size={15} strokeWidth={1.5} /> },
        { label: "Pós-vendas",         path: "/pos-vendas",        icon: <Heart        size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Performance",
      items: [
        { label: "Rankings",           path: "/ranking",           icon: <Star         size={15} strokeWidth={1.5} /> },
        { label: "Relatórios 1:1",     path: "/relatorios",        icon: <FileText     size={15} strokeWidth={1.5} /> },
        { label: "Placar do Dia",      path: "/placar-do-dia",     icon: <Star         size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Marketing",
      items: [
        { label: "Central",            path: "/marketing",         icon: <Zap          size={15} strokeWidth={1.5} /> },
        { label: "Email marketing",    path: "/email-marketing",   icon: <Mail         size={15} strokeWidth={1.5} /> },
        { label: "Disparo WhatsApp",   path: "/disparo-whatsapp",  icon: <MessageSquare size={15} strokeWidth={1.5} /> },
        { label: "Ligações IA",        path: "/disparador-ligacao-ia", icon: <Sparkles size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Operações",
      items: [
        { label: "Escala diária",      path: "/escala-diaria",     icon: <Clock        size={15} strokeWidth={1.5} /> },
        { label: "Integração Jetimob", path: "/integracao",        icon: <Layers       size={15} strokeWidth={1.5} /> },
        { label: "Central de dados",   path: "/central-dados",     icon: <Database     size={15} strokeWidth={1.5} /> },
        { label: "Admin",              path: "/admin",             icon: <Users        size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Ferramentas",
      items: [
        { label: "HOMI CEO",           path: "/homi-ceo",          icon: <Bot          size={15} strokeWidth={1.5} /> },
        { label: "Meus Links",         path: "/links-site",        icon: <Link2        size={15} strokeWidth={1.5} /> },
        { label: "Dev AI",             path: "/dev-ai",            icon: <Lightbulb    size={15} strokeWidth={1.5} /> },
        { label: "Base HOMI",          path: "/base-homi",         icon: <BookOpen     size={15} strokeWidth={1.5} /> },
      ],
    },
  ],

  // ── GESTOR ────────────────────────────────────────────────────────────────
  gestor: [
    {
      title: "Principal",
      items: [
        { label: "Dashboard",          path: "/gerente/dashboard", icon: <LayoutGrid   size={15} strokeWidth={1.5} /> },
        { label: "Meu time",           path: "/meu-time",          icon: <Users        size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Gestão de Leads",
      items: [
        { label: "Anúncios no ar",     path: "/anuncios",          icon: <Megaphone    size={15} strokeWidth={1.5} /> },
        { label: "Oferta ativa",       path: "/oferta-ativa",      icon: <Phone        size={15} strokeWidth={1.5} /> },
        { label: "Pipeline de leads",  path: "/pipeline-leads",    icon: <AlignLeft    size={15} strokeWidth={1.5} /> },
        { label: "Agenda de visitas",  path: "/agenda-visitas",    icon: <CalendarDays size={15} strokeWidth={1.5} /> },
        { label: "Busca de leads",     path: "/busca-leads",       icon: <Search       size={15} strokeWidth={1.5} /> },
        { label: "Imóveis",            path: "/imoveis",           icon: <Home         size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Gestão de Negócios",
      items: [
        { label: "Pipeline negócios",  path: "/pipeline-negocios", icon: <BarChart3    size={15} strokeWidth={1.5} /> },
        { label: "Vendas realizadas",  path: "/vendas-realizadas", icon: <TrendingUp   size={15} strokeWidth={1.5} /> },
        { label: "Pós-vendas",         path: "/pos-vendas",        icon: <Heart        size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Performance",
      items: [
        { label: "Rankings",           path: "/ranking",           icon: <Star         size={15} strokeWidth={1.5} /> },
        { label: "Relatórios 1:1",     path: "/relatorios",        icon: <FileText     size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Ferramentas",
      items: [
        { label: "HOMI Gerente",       path: "/homi-gerente",      icon: <Bot          size={15} strokeWidth={1.5} /> },
        { label: "Meus Links",         path: "/links-site",        icon: <Link2        size={15} strokeWidth={1.5} /> },
        { label: "Templates",          path: "/templates-comunicacao", icon: <ClipboardList size={15} strokeWidth={1.5} /> },
        { label: "Academia",           path: "/academia",          icon: <GraduationCap size={15} strokeWidth={1.5} /> },
      ],
    },
  ],

  // ── CORRETOR ──────────────────────────────────────────────────────────────
  corretor: [
    {
      title: "Principal",
      items: [
        { label: "Minha rotina",       path: "/corretor",          icon: <LayoutGrid   size={15} strokeWidth={1.5} /> },
        { label: "Aceite de leads",    path: "/aceite",            icon: <UserCheck    size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Leads & Visitas",
      items: [
        { label: "Central de tarefas", path: "/minhas-tarefas",    icon: <ListTodo     size={15} strokeWidth={1.5} /> },
        { label: "Pipeline de leads",  path: "/pipeline-leads",    icon: <AlignLeft    size={15} strokeWidth={1.5} /> },
        { label: "Agenda de visitas",  path: "/agenda-visitas",    icon: <CalendarDays size={15} strokeWidth={1.5} /> },
        { label: "Oferta ativa",       path: "/oferta-ativa",      icon: <Phone        size={15} strokeWidth={1.5} /> },
        { label: "Imóveis",            path: "/imoveis",           icon: <Home         size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Negócios",
      items: [
        { label: "Pipeline negócios",  path: "/pipeline-negocios", icon: <BarChart3    size={15} strokeWidth={1.5} /> },
        { label: "Vendas realizadas",  path: "/vendas-realizadas", icon: <TrendingUp   size={15} strokeWidth={1.5} /> },
        { label: "Pós-vendas",         path: "/pos-vendas",        icon: <Heart        size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Crescimento",
      items: [
        { label: "Rankings",           path: "/ranking",           icon: <Star         size={15} strokeWidth={1.5} /> },
        { label: "Conquistas",         path: "/conquistas",        icon: <Trophy       size={15} strokeWidth={1.5} /> },
        { label: "Academia",           path: "/academia",          icon: <GraduationCap size={15} strokeWidth={1.5} /> },
        { label: "Scripts",            path: "/scripts",           icon: <Lightbulb    size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Ferramentas",
      items: [
        { label: "Anúncios no ar",     path: "/anuncios",          icon: <Megaphone    size={15} strokeWidth={1.5} /> },
        { label: "HOMI Assistente",    path: "/homi",              icon: <Bot          size={15} strokeWidth={1.5} /> },
        { label: "Meus Links",         path: "/links-site",        icon: <Link2        size={15} strokeWidth={1.5} /> },
        { label: "Minhas vitrines",    path: "/minhas-vitrines",   icon: <Building2    size={15} strokeWidth={1.5} /> },
      ],
    },
  ],

  // ── BACKOFFICE ────────────────────────────────────────────────────────────
  backoffice: [
    {
      title: "Principal",
      items: [
        { label: "Dashboard",          path: "/backoffice",                       icon: <LayoutGrid   size={15} strokeWidth={1.5} /> },
        { label: "Tarefas",            path: "/backoffice/tarefas",               icon: <ListTodo     size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Financeiro",
      items: [
        { label: "Pagadorias",         path: "/backoffice/pagadorias",            icon: <Wallet       size={15} strokeWidth={1.5} /> },
        { label: "Solicitações",       path: "/backoffice/solicitacoes-pagadoria",icon: <ClipboardList size={15} strokeWidth={1.5} /> },
        { label: "Comissões",          path: "/backoffice/comissoes",             icon: <PieChart     size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Operações",
      items: [
        { label: "Cadastros",          path: "/backoffice/cadastros",             icon: <Database     size={15} strokeWidth={1.5} /> },
        { label: "HOMI Ana",           path: "/backoffice/homi-ana",             icon: <Bot          size={15} strokeWidth={1.5} /> },
      ],
    },
  ],

  // ── RH ────────────────────────────────────────────────────────────────────
  rh: [
    {
      title: "Principal",
      items: [
        { label: "Dashboard RH",       path: "/rh",                icon: <LayoutGrid   size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Recrutamento",
      items: [
        { label: "Candidatos",         path: "/rh/recrutamento",   icon: <Users        size={15} strokeWidth={1.5} /> },
        { label: "Entrevistas",        path: "/rh/entrevistas",    icon: <Briefcase    size={15} strokeWidth={1.5} /> },
      ],
    },
    {
      title: "Gestão",
      items: [
        { label: "Conversas 1:1",      path: "/rh/conversas",      icon: <MessageSquare size={15} strokeWidth={1.5} /> },
        { label: "Sala de reunião",    path: "/rh/sala-reuniao",   icon: <Video        size={15} strokeWidth={1.5} /> },
      ],
    },
  ],
};

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  role?: UserRole;
  userName?: string;
  userRole?: string;
  userInitials?: string;
  theme?: "light" | "dark";
  onThemeToggle?: () => void;
  showCampaigns?: boolean;
}

export default function Sidebar({
  role = "admin",
  userName = "Lucas Sarmento",
  userRole = "CEO · Admin",
  userInitials = "LS",
  theme = "light",
  onThemeToggle,
  showCampaigns = true,
}: SidebarProps) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const [campOpen, setCampOpen] = useState(false);
  const isDark    = theme === "dark";
  const groups    = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.admin;
  const isActive  = (path: string) => location.pathname === path;
  const isMobile  = useIsMobile();

  // Track which groups are collapsed (by title). "Principal" always open.
  const NON_COLLAPSIBLE = ["Principal"];
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (title: string) => {
    setCollapsedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  // Integration with shadcn SidebarProvider for collapse
  const { state: sidebarState, openMobile, setOpenMobile } = useSidebar();
  const collapsed = sidebarState === "collapsed";

  // ── tokens ──
  const sb    = isDark ? "bg-[#091020] border-r border-white/5"       : "bg-[#e8e8f0] border-r border-[#dddde8]";
  const tx    = isDark ? "text-[#fafafa]"     : "text-[#0a0a0a]";
  const txm   = isDark ? "text-[#a1a1aa]"     : "text-[#52525b]";
  const txd   = isDark ? "text-[#3f3f46]"     : "text-[#c4c4c7]";
  const div   = isDark ? "bg-white/5"         : "bg-[#f0f0f0]";
  const foot  = isDark ? "border-t border-white/5" : "border-t border-[#f0f0f0]";
  const camp  = isDark
    ? "bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.08]"
    : "bg-[#fafafa] border border-[#ebebeb] hover:bg-[#f3f3f3]";
  const itemBase  = isDark
    ? "text-[#a1a1aa] hover:bg-[rgba(99,102,241,0.08)] hover:text-[#818cf8]"
    : "text-[#3f3f46] hover:bg-[rgba(79,70,229,0.08)] hover:text-[#4F46E5]";
  const itemOn  = isDark
    ? "bg-[#4F46E5] text-white font-medium"
    : "bg-[#4F46E5] text-white font-medium";
  const iconDef   = isDark ? "text-[#818cf8]"  : "text-[#4F46E5]";
  const iconOn    = "text-white";

  // Render full nav content (reused in both aside and mobile sheet)
  const renderFullNav = () => (
    <>
      <div className="px-5 pt-5 pb-4">
        <UhomeLogo size="md" showTagline />
      </div>
      {showCampaigns && (
        <div className="px-3 mb-2">
          <button
            onClick={() => setCampOpen(v => !v)}
            className={cn("w-full flex items-center gap-2.5 px-3 py-[9px] rounded-[9px] transition-all text-left", camp)}
          >
            <div className="w-[7px] h-[7px] rounded-full bg-[#4F46E5] flex-shrink-0" />
            <span className={cn("text-[12px] font-medium flex-1 tracking-[-0.1px]", tx)}>
              Campanhas ativas
            </span>
            <span className="text-[10px] font-bold bg-[#4F46E5] text-white rounded-full px-[7px] py-px">
              {CAMPAIGNS.length}
            </span>
            <ChevronRight
              size={11} strokeWidth={2}
              className={cn("flex-shrink-0 transition-transform duration-200", txd, campOpen && "rotate-90")}
            />
          </button>
          {campOpen && (
            <div className="mt-1">
              {CAMPAIGNS.map(c => (
                <button
                  key={c.path}
                  onClick={() => { navigate(c.path); if (isMobile) setOpenMobile(false); }}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-left transition-colors",
                    isDark ? "hover:bg-white/[0.05]" : "hover:bg-[#f5f5f7]")}
                >
                  <div className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: c.color }} />
                  <span className={cn("text-[12.5px] tracking-[-0.1px]", txm)}>{c.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {groups.map((group, gi) => {
        const canCollapse = !NON_COLLAPSIBLE.includes(group.title);
        const isGroupCollapsed = canCollapse && !!collapsedGroups[group.title];
        // Auto-expand if active route is inside
        const hasActiveItem = group.items.some(item => isActive(item.path));

        return (
          <div key={group.title}>
            {gi > 0 && <div className={cn("h-px mx-3 my-[6px]", div)} />}
            <div className="px-3 pt-3 pb-1">
              {canCollapse ? (
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-center justify-between px-2 mb-[3px] group/label"
                >
                  <p className="text-[10px] font-[650] tracking-[0.07em] uppercase text-[rgba(79,70,229,0.6)]">
                    {group.title}
                  </p>
                  <ChevronRight
                    size={10} strokeWidth={2}
                    className={cn(
                      "transition-transform duration-200 text-[rgba(79,70,229,0.4)]",
                      !isGroupCollapsed && "rotate-90"
                    )}
                  />
                </button>
              ) : (
                <p className="text-[10px] font-[650] tracking-[0.07em] uppercase px-2 mb-[3px] text-[rgba(79,70,229,0.6)]">
                  {group.title}
                </p>
              )}
              {(!isGroupCollapsed || hasActiveItem) && group.items.map(item => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); if (isMobile) setOpenMobile(false); }}
                    className={cn(
                      "w-full flex items-center gap-[10px] px-2 py-[7px] rounded-[8px]",
                      "text-[13.5px] tracking-[-0.15px] transition-all text-left",
                      active ? itemOn : itemBase
                    )}
                  >
                    <span className={cn("w-[18px] flex items-center justify-center flex-shrink-0",
                      active ? iconOn : iconDef)}>
                      {item.icon}
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className={cn("text-[10px] font-semibold rounded-full px-1.5 py-px",
                        isDark ? "bg-white/10 text-[#71717a]" : "bg-[#f0f0f0] text-[#a1a1aa]")}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className={cn("mt-auto px-3 py-3 flex items-center gap-2.5", foot)}>
        <div className="w-[28px] h-[28px] rounded-full bg-[#4F46E5] flex items-center justify-center flex-shrink-0 text-white text-[9px] font-bold">
          {userInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn("text-[12px] font-semibold tracking-[-0.2px] truncate", tx)}>{userName}</div>
          <div className={cn("text-[10px] truncate", txd)}>{userRole}</div>
        </div>
        {onThemeToggle && (
          <button
            onClick={onThemeToggle}
            className={cn("w-[26px] h-[26px] flex items-center justify-center rounded-[7px] transition-colors flex-shrink-0",
              isDark ? "text-[#52525b] hover:bg-white/[0.07] hover:text-[#a1a1aa]"
                     : "text-[#c4c4c7] hover:bg-[#f5f5f5] hover:text-[#71717a]")}
          >
            {isDark ? <Sun size={12} strokeWidth={1.5} /> : <Moon size={12} strokeWidth={1.5} />}
          </button>
        )}
      </div>
    </>
  );

  // Mobile: render as Sheet drawer
  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          side="left"
          className={cn("w-[260px] p-0 flex flex-col", isDark ? "bg-[#0c0c0e]" : "bg-[#e8e8f0]")}
        >
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <div className="flex flex-col h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {renderFullNav()}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Collapsed mode: show only icons
  if (collapsed) {
    return (
      <aside
        className={cn("hidden md:flex flex-col h-screen w-[60px] min-w-[60px] overflow-hidden transition-all duration-200", sb)}
      >
        {/* Logo icon */}
        <div className="flex items-center justify-center pt-5 pb-4">
          <UhomeLogo size="sm" />
        </div>

        {/* Nav icons only */}
        {groups.map((group) =>
          group.items.map(item => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={item.label}
                className={cn(
                  "mx-auto mb-0.5 w-[38px] h-[38px] flex items-center justify-center rounded-[8px] transition-all",
                  active ? itemOn : itemBase
                )}
              >
                <span className={cn("flex items-center justify-center", active ? iconOn : iconDef)}>
                  {item.icon}
                </span>
              </button>
            );
          })
        )}

        {/* Footer avatar */}
        <div className={cn("mt-auto py-3 flex flex-col items-center gap-2", foot)}>
          {onThemeToggle && (
            <button
              onClick={onThemeToggle}
              className={cn("w-[26px] h-[26px] flex items-center justify-center rounded-[7px] transition-colors",
                isDark ? "text-[#52525b] hover:bg-white/[0.07] hover:text-[#a1a1aa]"
                       : "text-[#c4c4c7] hover:bg-[#f5f5f5] hover:text-[#71717a]")}
            >
              {isDark ? <Sun size={12} strokeWidth={1.5} /> : <Moon size={12} strokeWidth={1.5} />}
            </button>
          )}
          <div className="w-[28px] h-[28px] rounded-full bg-[#4F46E5] flex items-center justify-center text-white text-[9px] font-bold">
            {userInitials}
          </div>
        </div>
      </aside>
    );
  }

  // Expanded desktop sidebar
  return (
    <aside
      className={cn("hidden md:flex flex-col h-screen w-[228px] min-w-[228px] overflow-y-auto transition-all duration-200", sb)}
      style={{ scrollbarWidth: "none" }}
    >
      {renderFullNav()}
    </aside>
  );
}
