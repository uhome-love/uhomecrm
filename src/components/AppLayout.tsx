import { cn } from "@/lib/utils";
import UhomeLogo from "@/components/UhomeLogo";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import Sidebar from "@/components/layout/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useTheme } from "@/hooks/useTheme";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { User, Settings, LogOut, ChevronDown, Loader2 } from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePendingLeadAlert } from "@/hooks/usePendingLeadAlert";
import { useVendaRealtimeNotification } from "@/hooks/useVendaRealtimeNotification";
import { useWhatsAppNotifications } from "@/hooks/useWhatsAppNotifications";

import LeadAcceptanceDialog from "@/components/pipeline/LeadAcceptanceDialog";

import NewLeadBanner from "@/components/notifications/NewLeadBanner";
import PushPromptBanner from "@/components/notifications/PushPromptBanner";
import GlobalSearch from "@/components/GlobalSearch";
import { Search } from "lucide-react";
import { HomiProvider } from "@/contexts/HomiContext";
import { useTabContext } from "@/contexts/TabContext";
import { PAGE_COMPONENTS } from "@/config/pageRegistry";
import TabBar from "@/components/layout/TabBar";
const homiMascot = "/images/homi-mascot-official.png";

const HomiPanel = lazy(() => import("@/components/homi/HomiPanel"));
const HomiAvatar = lazy(() => import("@/components/homi/HomiAvatar"));
const HomiProactiveAlert = lazy(() => import("@/components/homi/HomiProactiveAlert"));
const HomiGreeting = lazy(() => import("@/components/HomiGreeting"));

// Detect arena-mode or arena-session class on body reactively
function useArenaMode() {
  const isFullscreen = useSyncExternalStore(
    (cb) => {
      const observer = new MutationObserver(cb);
      observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    },
    () => document.body.classList.contains("arena-mode")
  );
  const isSession = useSyncExternalStore(
    (cb) => {
      const observer = new MutationObserver(cb);
      observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    },
    () => document.body.classList.contains("arena-session")
  );
  return { isFullscreen, isSession };
}

/** Arena auto-collapse removed — sidebar stays open during arena sessions */

type SidebarRole = "admin" | "gestor" | "corretor" | "backoffice" | "rh";

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const { isAdmin, isGestor, isBackoffice, isRh } = useUserRole();
  const { theme, toggle: onThemeToggle } = useTheme();
  useVendaRealtimeNotification();
  useWhatsAppNotifications();
  
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cargoLabel, setCargoLabel] = useState("");
  const { pendingLead, showDialog, closeDialog, refresh: refreshPending } = usePendingLeadAlert();
  const { isFullscreen, isSession } = useArenaMode();
  const { tabs, activeTabId } = useTabContext();

  // Derive role for the new Sidebar
  const sidebarRole: SidebarRole = isBackoffice
    ? "backoffice"
    : isAdmin
    ? "admin"
    : isRh
    ? "rh"
    : isGestor
    ? "gestor"
    : "corretor";

  const fetchProfile = useCallback(() => {
    if (!user) return;
    supabase.from("profiles").select("nome, avatar_url, avatar_gamificado_url, cargo").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.nome) setNome(data.nome);
      const url = data?.avatar_url || (data as any)?.avatar_gamificado_url || null;
      setAvatarUrl(url);
      // Use role from useUserRole as primary signal, profile.cargo as secondary
      if (isBackoffice) {
        setCargoLabel("Backoffice · 💜 Admin");
      } else if (isAdmin) {
        setCargoLabel("Admin · 👑 CEO");
      } else if (isRh) {
        setCargoLabel("RH · 💚 Carol");
      } else if (isGestor) {
        setCargoLabel("Gerente");
      } else {
        const c = (data as any)?.cargo || "";
        const labelMap: Record<string, string> = {
          backoffice: "Backoffice · 💜 Admin",
          admin: "Admin · 👑 CEO",
          gerente: "Gerente",
          corretor: "Corretor",
          rh: "RH · 💚 Carol",
        };
        setCargoLabel(labelMap[c] || c || "Corretor");
      }
    });
  }, [user, isAdmin, isGestor, isBackoffice, isRh]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    const handler = () => fetchProfile();
    window.addEventListener("profile-updated", handler);
    return () => window.removeEventListener("profile-updated", handler);
  }, [fetchProfile]);

  // Compute user initials
  const userInitials = nome
    ? nome.trim().split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || "U";

  return (
    <SidebarProvider defaultOpen>
      <HomiProvider>
        <div className="flex h-screen overflow-hidden w-full bg-[#f0f0f5] dark:bg-[#0e1525]">
          <Sidebar
              role={sidebarRole}
              userName={nome || user?.email?.split("@")[0] || "Usuário"}
              userRole={cargoLabel}
              userInitials={userInitials}
              theme={theme}
              onThemeToggle={onThemeToggle}
              showCampaigns={sidebarRole === "admin" || sidebarRole === "gestor"}
            />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <header
              className={cn(
                "h-14 flex items-center justify-between sticky top-0 z-50 px-4",
                theme === "dark"
                  ? "bg-[#0b1222] border-b border-white/[0.05]"
                  : "bg-[#f0f0f5] border-b border-[#e4e4e9]"
              )}
            >
              <div className="flex items-center gap-3">
                <SidebarTrigger className={theme === "dark" ? "text-[#71717a] hover:text-[#fafafa]" : "text-[#52525b] hover:text-[#0a0a0a]"} />
                <div className="hidden sm:flex items-center">
                  <UhomeLogo size="md" />
                </div>
                {(isFullscreen || isSession) && (
                  <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                    ⚡ Modo Arena
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex items-center gap-2 h-8 px-2.5 rounded-lg"
                style={theme === "dark"
                  ? { color: "#52525b", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }
                  : { color: "#52525b", background: "#f7f7fb", border: "1px solid #e8e8f0" }
                }
                onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              >
                <Search className="h-3.5 w-3.5" style={{ color: theme === "dark" ? "#71717a" : "#a1a1aa" }} />
                <span className="text-[11px]" style={{ color: theme === "dark" ? "#52525b" : "#a1a1aa" }}>Buscar...</span>
                <kbd className="pointer-events-none ml-1 inline-flex h-5 items-center gap-0.5 rounded px-1 font-mono text-[10px] font-medium" style={theme === "dark"
                  ? { color: "#52525b", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }
                  : { color: "#a1a1aa", background: "#f0f0f5", border: "1px solid #e8e8f0" }
                }>
                  ⌘K
                </kbd>
              </Button>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                   <Button variant="ghost" className={cn("flex items-center gap-2.5 h-9 px-3 rounded-xl", theme === "dark" ? "hover:bg-white/5" : "hover:bg-[#f0f0f5]")}>
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={nome || "Avatar"}
                        className="rounded-full object-cover shrink-0"
                        style={{ width: 36, height: 36, border: "2px solid #4969FF" }}
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center rounded-full font-bold text-white text-[11px] shrink-0"
                        style={{ width: 36, height: 36, background: "#4969FF", border: "2px solid #4969FF" }}
                      >
                        {nome ? nome.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : <User className="h-4 w-4" />}
                      </div>
                    )}
                    <div className="text-left hidden sm:block">
                      <p className="leading-tight" style={{ color: theme === "dark" ? "#fafafa" : "#0a0a0a", fontSize: 14, fontWeight: 600 }}>
                        {nome || user?.email?.split("@")[0]}
                      </p>
                      <p className="leading-tight" style={{ color: theme === "dark" ? "#52525b" : "#71717a", fontSize: 12 }}>{cargoLabel}</p>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 hidden sm:block" style={{ color: theme === "dark" ? "#71717a" : "#a1a1aa" }} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-3 py-2">
                    <p className="text-sm font-semibold">{nome || "Usuário"}</p>
                    <p className="text-xs text-muted-foreground">{cargoLabel}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate("/configuracoes")} className="text-xs gap-2 cursor-pointer">
                    <Settings className="h-3.5 w-3.5" /> Configurações
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={signOut} className="text-xs gap-2 text-destructive cursor-pointer">
                    <LogOut className="h-3.5 w-3.5" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            </header>
            <PushPromptBanner />
            <TabBar />
            
            <main className="flex-1 overflow-hidden min-w-0 min-h-0 relative bg-[#f0f0f5] dark:bg-[#0e1525]">
              {tabs.map(tab => {
                const Comp = PAGE_COMPONENTS[tab.componentKey];
                if (!Comp) return null;
                const isActiveTab = tab.id === activeTabId;
                return (
                  <div
                    key={tab.id}
                    className={cn(
                      "absolute inset-0 overflow-y-auto overflow-x-hidden",
                      !tab.noPadding && "p-4 sm:p-6 lg:p-8"
                    )}
                    style={{ display: isActiveTab ? 'block' : 'none' }}
                  >
                    <ErrorBoundary module={tab.componentKey}>
                      <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                        <Comp />
                      </Suspense>
                    </ErrorBoundary>
                  </div>
                );
              })}
            </main>
          </div>
        </div>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <HomiPanel />
            <HomiAvatar />
            <HomiProactiveAlert />
            <HomiGreeting />
          </Suspense>
        </ErrorBoundary>
        <LeadAcceptanceDialog
          lead={pendingLead}
          open={showDialog}
          onClose={closeDialog}
          onResult={refreshPending}
        />
        <NewLeadBanner />
        <GlobalSearch />
      </HomiProvider>
    </SidebarProvider>
  );
}
