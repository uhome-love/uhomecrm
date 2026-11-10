import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTabNavigation } from "@/hooks/useTabNavigation";
import { resolveRoute } from "@/config/pageRegistry";
import {
  LayoutGrid, CheckCircle, FileText, Target, AlignLeft,
  CalendarDays, Home, Phone, Search, Megaphone,
  BarChart3, TrendingUp, Heart, Star, Mail,
  MessageSquare, Sparkles, Bot, BookOpen,
  Users, UsersRound, Video, ChevronRight,
  Sun, Moon, ShieldCheck, ClipboardList, Wrench,
  Trophy, GraduationCap, Lightbulb, Layers,
  Building2, Wallet, ListTodo, CheckSquare, Database,
  BarChart2, GitBranch, Award, BellRing,
  UserCheck, Clock, LineChart, PieChart, Link2, Smartphone, FolderOpen, Plug, RefreshCw, Activity, FileSignature, AlarmClock, Calculator, CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import UhomeLogo from "@/components/UhomeLogo";
import { withNatalMenu } from "@/natal/central/menuNatal";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import MobileMaisMenu from "@/components/layout/mobile/MobileMaisMenu";

import { NAV_BY_ROLE, GRUPO_TOPO, GRUPOS_RECOLHIDOS, type NavGroup, type UserRole } from "@/components/layout/navConfig";
import { useMenuContadores } from "@/hooks/useMenuContadores";

const CAMPAIGNS: { label: string; path: string; color: string }[] = [];

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────

// Gestores que também operam como corretor (se credenciam na roleta, recebem
// e aceitam leads). Enquanto a equipe é pequena, eles veem o grupo "Modo
// Corretor". Ao crescer, basta remover o auth_id daqui.
const CORRETOR_MODE_GESTORES: string[] = [
  // 12/08/2026: Junior Padilha removido — perfil 100% gerente (igual Bruno/Gabriel).
];

// Diretoria que também atende leads repassados pela Fila CEO (ex.: disparos).
const CORRETOR_MODE_DIRETORES: string[] = [
  "7882d73e-ff5c-4b23-9b08-2adeadcd1800", // Gabrielle Rodrigues
];

const MODO_CORRETOR_GROUP: NavGroup = {
  title: "Modo Corretor",
  items: [
    { label: "Minha rotina",       path: "/corretor",          icon: <LayoutGrid   size={15} strokeWidth={1.5} /> },
    { label: "Agenda", path: "/minhas-tarefas",    icon: <ListTodo     size={15} strokeWidth={1.5} /> },
    { label: "Tarefas", path: "/tarefas", icon: <CheckSquare size={15} strokeWidth={1.5} /> },
    { label: "Aceite de leads",    path: "/aceite",            icon: <UserCheck    size={15} strokeWidth={1.5} /> },
    { label: "Oferta ativa (corretor)", path: "/corretor/call", icon: <Phone      size={15} strokeWidth={1.5} /> },
  ],
};

interface SidebarProps {
  role?: UserRole;
  userId?: string;
  userName?: string;
  userRole?: string;
  userInitials?: string;
  theme?: "light" | "dark";
  onThemeToggle?: () => void;
  showCampaigns?: boolean;
}

export default function Sidebar({
  role = "admin",
  userId,
  userName = "Lucas Sarmento",
  userRole = "CEO · Admin",
  userInitials = "LS",
  theme = "light",
  onThemeToggle,
  showCampaigns = true,
}: SidebarProps) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { openTab } = useTabNavigation();
  // Standalone full-page routes (rendered outside the tab shell in App.tsx) are not
  // in pageRegistry, so openTab() can't resolve them. Fall back to direct navigation.
  const go = (path: string) => {
    if (resolveRoute(path.split("?")[0].split("#")[0])) openTab(path);
    else navigate(path);
  };
  const [campOpen, setCampOpen] = useState(false);
  const isDark    = theme === "dark";
  const isManagerRole = role === "admin" || role === "diretor" || role === "gestor";

  // WhatsApp unread badge — only for corretores (not managers/admins)
  const [whatsappUnread, setWhatsappUnread] = useState(() => {
    if (isManagerRole) return 0;
    const v = localStorage.getItem("whatsapp_unread");
    return v ? parseInt(v, 10) || 0 : 0;
  });

  useEffect(() => {
    if (isManagerRole) return;
    const handler = (e: StorageEvent) => {
      if (e.key === "whatsapp_unread") {
        setWhatsappUnread(parseInt(e.newValue || "0", 10) || 0);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [isManagerRole]);

  const baseGroups = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.admin;
  const showCorretorMode =
    !!userId &&
    ((role === "gestor" && CORRETOR_MODE_GESTORES.includes(userId)) ||
      (role === "diretor" && CORRETOR_MODE_DIRETORES.includes(userId)));
  const rawGroups = showCorretorMode
    ? [baseGroups[0], MODO_CORRETOR_GROUP, ...baseGroups.slice(1)]
    : baseGroups;
  const comNatal = withNatalMenu(rawGroups, role);
  const natalItem = comNatal.flatMap(g => g.items).find(i => i.path === "/campanha-natal");
  const { data: contadores } = useMenuContadores(userId);
  const contador = (path: string) => {
    const n = path === "/tarefas" ? contadores?.tarefas : path === "/agenda-visitas" ? contadores?.visitas : undefined;
    return n ? (n > 99 ? "99+" : n) : undefined;
  };
  const groups = comNatal.map(g => ({
    ...g,
    items: g.items.filter(i => i.path !== "/campanha-natal").map(item =>
      item.path === "/whatsapp" && !isManagerRole && whatsappUnread > 0
        ? { ...item, badge: whatsappUnread > 9 ? "9+" : whatsappUnread }
        : contador(item.path) !== undefined ? { ...item, badge: contador(item.path) } : item
    ),
  }));
  const isActive  = (path: string) => location.pathname === path;
  const isMobile  = useIsMobile();

  // Track which groups are collapsed (by title). "Principal" always open.
  const NON_COLLAPSIBLE = [GRUPO_TOPO, "Principal"];
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const salvo = localStorage.getItem("menu_grupos_recolhidos");
      if (salvo) return JSON.parse(salvo) as Record<string, boolean>;
    } catch { /* ignora */ }
    return Object.fromEntries(GRUPOS_RECOLHIDOS.map(t => [t, true]));
  });
  const toggleGroup = (title: string) => {
    setCollapsedGroups(prev => {
      const next = { ...prev, [title]: !prev[title] };
      try { localStorage.setItem("menu_grupos_recolhidos", JSON.stringify(next)); } catch { /* ignora */ }
      return next;
    });
  };

  // Integration with shadcn SidebarProvider for collapse
  const { state: sidebarState, openMobile, setOpenMobile } = useSidebar();
  const collapsed = sidebarState === "collapsed";

  // ── tokens ──
  const sb    = "shell-nav";
  const tx    = "text-foreground";
  const txm   = "text-muted-foreground";
  const txd   = "text-muted-foreground/70";
  const div   = "shell-divider";
  const foot  = "border-t border-[hsl(var(--shell-nav-border))]";
  const camp  = isDark
    ? "bg-card border border-border hover:bg-accent"
    : "bg-card border border-border hover:bg-accent";
  const itemBase  = "shell-nav-item";
  const itemOn  = "shell-nav-item-active";
  const iconDef   = "text-muted-foreground group-hover/item:text-primary";
  const iconOn    = "text-current";

  // Render full nav content (reused in both aside and mobile sheet)
  const renderFullNav = () => (
    <>
      <div className="px-5 pt-5 pb-4">
        <div className="relative inline-block">
          <UhomeLogo size="md" />
        </div>
      </div>
      {natalItem && (
        <div className="px-3 mb-2">
          <button
            onClick={() => { go(natalItem.path); if (isMobile) setOpenMobile(false); }}
            className={cn("natal-chip-ouro w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left text-[12.5px] font-semibold transition-opacity hover:opacity-90",
              isActive(natalItem.path) && "ring-2 ring-primary/30")}
          >
            <span className="flex-shrink-0">{natalItem.icon}</span>
            <span className="flex-1 truncate">{natalItem.label}</span>
          </button>
        </div>
      )}
      {showCampaigns && CAMPAIGNS.length > 0 && (
        <div className="px-3 mb-2">
          <button
            onClick={() => setCampOpen(v => !v)}
            className={cn("w-full flex items-center gap-2.5 px-3 py-[9px] rounded-[9px] transition-all text-left", camp)}
          >
            <div className="w-[7px] h-[7px] rounded-full bg-primary flex-shrink-0" />
            <span className={cn("text-[12px] font-medium flex-1 tracking-[-0.1px]", tx)}>
              Campanhas ativas
            </span>
            <span className="text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-[7px] py-px">
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
                  onClick={() => { openTab(c.path); if (isMobile) setOpenMobile(false); }}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-left transition-colors",
                    "hover:bg-[hsl(var(--shell-nav-hover))]")}
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
            <div className={cn("px-3", gi > 0 ? "pt-3" : "pt-0.5")}>
              {canCollapse ? (
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-center justify-between px-2 mb-[3px] group/label"
                >
                  <p className="text-[10px] font-semibold tracking-[0.1em] uppercase shell-nav-label opacity-80">
                    {group.title}
                  </p>
                  <ChevronRight
                    size={10} strokeWidth={2}
                    className={cn(
                      "transition-transform duration-200 shell-nav-label opacity-60 group-hover/label:opacity-100",
                      !isGroupCollapsed && "rotate-90"
                    )}
                  />
                </button>
              ) : group.title ? (
                <p className="text-[10px] font-semibold tracking-[0.1em] uppercase px-2 mb-1 shell-nav-label opacity-80">
                  {group.title}
                </p>
              ) : null}
              {(!isGroupCollapsed || hasActiveItem) && group.items.map(item => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => { go(item.path); if (isMobile) setOpenMobile(false); }}
                    className={cn(
                      "group/item relative w-full flex items-center gap-[10px] px-2.5 h-[30px] rounded-[8px] mb-px",
                      "text-[13px] tracking-[-0.1px] transition-colors duration-150 text-left",
                      active ? itemOn : itemBase
                    )}
                  >
                    {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-primary" />}
                    <span className={cn("w-[18px] flex items-center justify-center flex-shrink-0",
                      active ? iconOn : iconDef)}>
                      {item.icon}
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className={cn("text-[10px] font-semibold rounded-full px-1.5 py-px",
                        item.path === "/campanha-natal"
                          ? "natal-chip-ouro"
                          : item.path === "/whatsapp"
                          ? isManagerRole
                            ? "bg-warning text-warning-foreground"
                            : "bg-destructive text-destructive-foreground"
                          : "bg-primary text-primary-foreground min-w-[18px] text-center")}>
                        {item.path === "/whatsapp" && isManagerRole ? `⚠️ ${item.badge}` : item.badge}
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
        <div className="w-[28px] h-[28px] rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-primary-foreground text-[10px] font-bold ring-2 ring-primary/15">
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
              "text-muted-foreground hover:bg-[hsl(var(--shell-nav-hover))] hover:text-foreground")}
          >
            {isDark ? <Sun size={12} strokeWidth={1.5} /> : <Moon size={12} strokeWidth={1.5} />}
          </button>
        )}
      </div>
    </>
  );

  // Mobile: tela "Mais" (estilo Ajustes do iPhone), aberta pela barra de baixo
  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent side="bottom" className="h-[94dvh] rounded-t-3xl border-0 bg-background p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <SheetTitle className="sr-only">Mais</SheetTitle>
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted-foreground/30" />
          <div className="h-full overflow-y-auto pt-2" style={{ scrollbarWidth: "none" }}>
            <MobileMaisMenu
              groups={natalItem ? [{ title: "Campanha", items: [natalItem] }, ...groups] : groups}
              activePath={location.pathname}
              userName={userName}
              userRole={userRole}
              userInitials={userInitials}
              isDark={isDark}
              onThemeToggle={onThemeToggle}
              go={(path) => { go(path); setOpenMobile(false); }}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Collapsed mode: show only icons
  if (collapsed) {
    return (
      <aside
        className={cn("hidden md:flex flex-col h-screen w-[64px] min-w-[64px] overflow-y-auto transition-all duration-200", sb)}
      >
        {/* Logo icon */}
        <div className="flex items-center justify-center pt-5 pb-4">
          <div className="relative">
            <UhomeLogo size="sm" />
          </div>
        </div>

        {/* Nav icons only */}
        {groups.map((group, gi) => [
          gi > 0 ? <div key={`sep-${group.title}`} className={cn("h-px w-8 mx-auto my-1.5", div)} /> : null,
          ...group.items.map(item => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                title={item.label}
                className={cn(
                  "group/item mx-auto mb-1 w-10 h-10 flex items-center justify-center rounded-[10px] transition-all",
                  active ? itemOn : itemBase
                )}
              >
                <span className={cn("relative flex items-center justify-center", active ? iconOn : iconDef)}>
                  {item.icon}
                  {item.badge !== undefined && <span className="absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-primary" />}
                </span>
              </button>
            );
          }),
        ])}

        {/* Footer avatar */}
        <div className={cn("mt-auto py-3 flex flex-col items-center gap-2", foot)}>
          {onThemeToggle && (
            <button
              onClick={onThemeToggle}
              className={cn("w-[26px] h-[26px] flex items-center justify-center rounded-[7px] transition-colors",
                "text-muted-foreground hover:bg-[hsl(var(--shell-nav-hover))] hover:text-foreground")}
            >
              {isDark ? <Sun size={12} strokeWidth={1.5} /> : <Moon size={12} strokeWidth={1.5} />}
            </button>
          )}
          <div className="w-[28px] h-[28px] rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-bold">
            {userInitials}
          </div>
        </div>
      </aside>
    );
  }

  // Expanded desktop sidebar
  return (
    <aside
      className={cn("hidden md:flex flex-col h-screen w-[244px] min-w-[244px] overflow-y-auto transition-all duration-200 shell-nav-scroll", sb)}
    >
      {renderFullNav()}
    </aside>
  );
}
