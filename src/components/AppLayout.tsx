import { cn } from "@/lib/utils";
import UhomeLogo from "@/components/UhomeLogo";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import Sidebar from "@/components/layout/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useTheme } from "@/hooks/useTheme";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { User, Settings, LogOut, ChevronDown } from "lucide-react";
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
import LeadAcceptanceDialog from "@/components/pipeline/LeadAcceptanceDialog";
import MelnickMetaBanner from "@/components/MelnickMetaBanner";
import NewLeadBanner from "@/components/notifications/NewLeadBanner";
import PushPromptBanner from "@/components/notifications/PushPromptBanner";
import GlobalSearch from "@/components/GlobalSearch";
import { Search } from "lucide-react";
import { HomiProvider } from "@/contexts/HomiContext";
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

/** Auto-collapse sidebar when arena session is active */
function ArenaAutoCollapse({ isSession }: { isSession: boolean }) {
  const { setOpen, open } = useSidebar();
  const prevOpenRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (isSession) {
      // Store previous state and collapse
      prevOpenRef.current = open;
      setOpen(false);
    } else if (prevOpenRef.current !== null) {
      // Restore previous state
      setOpen(prevOpenRef.current);
      prevOpenRef.current = null;
    }
  }, [isSession]); // intentionally not including open/setOpen to avoid loops

  return null;
}

type SidebarRole = "admin" | "gestor" | "corretor" | "backoffice" | "rh";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { isAdmin, isGestor, isBackoffice, isRh } = useUserRole();
  const { theme, toggle: onThemeToggle } = useTheme();
  useVendaRealtimeNotification();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cargoLabel, setCargoLabel] = useState("");
  const { pendingLead, showDialog, closeDialog, refresh: refreshPending } = usePendingLeadAlert();
  const { isFullscreen, isSession } = useArenaMode();

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
    <SidebarProvider defaultOpen={!isSession}>
      <HomiProvider>
        <ArenaAutoCollapse isSession={isSession} />
        <div className="flex h-screen overflow-hidden w-full bg-[#f0f0f5] dark:bg-[#0f0f12]">
          {!isSession && (
            <Sidebar
              role={sidebarRole}
              userName={nome || user?.email?.split("@")[0] || "Usuário"}
              userRole={cargoLabel}
              userInitials={userInitials}
              theme={theme}
              onThemeToggle={onThemeToggle}
              showCampaigns={sidebarRole === "admin"}
            />
          )}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <header
              className={cn(
                "h-14 flex items-center justify-between sticky top-0 z-50 px-4",
                theme === "dark"
                  ? "border-b border-white/[0.06]"
                  : "bg-white border-b border-[#e8e8f0]"
              )}
              style={theme === "dark" ? { background: "hsl(var(--sidebar-background))" } : undefined}
            >
              <div className="flex items-center gap-3">
                <SidebarTrigger className={theme === "dark" ? "text-gray-400 hover:text-white" : "text-[#52525b] hover:text-[#0a0a0a]"} />
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
                  ? { color: "#9CA3AF", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }
                  : { color: "#52525b", background: "#f7f7fb", border: "1px solid #e8e8f0" }
                }
                onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              >
                <Search className="h-3.5 w-3.5" style={{ color: theme === "dark" ? "#9CA3AF" : "#a1a1aa" }} />
                <span className="text-[11px]" style={{ color: theme === "dark" ? "#6B7280" : "#a1a1aa" }}>Buscar...</span>
                <kbd className="pointer-events-none ml-1 inline-flex h-5 items-center gap-0.5 rounded px-1 font-mono text-[10px] font-medium" style={theme === "dark"
                  ? { color: "#6B7280", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }
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
                        style={{ width: 36, height: 36, border: "2px solid #4F46E5" }}
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center rounded-full font-bold text-white text-[11px] shrink-0"
                        style={{ width: 36, height: 36, background: "#4F46E5", border: "2px solid #4F46E5" }}
                      >
                        {nome ? nome.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : <User className="h-4 w-4" />}
                      </div>
                    )}
                    <div className="text-left hidden sm:block">
                      <p className="leading-tight" style={{ color: theme === "dark" ? "#FFFFFF" : "#0a0a0a", fontSize: 14, fontWeight: 600 }}>
                        {nome || user?.email?.split("@")[0]}
                      </p>
                      <p className="leading-tight" style={{ color: theme === "dark" ? "#9CA3AF" : "#71717a", fontSize: 12 }}>{cargoLabel}</p>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 hidden sm:block" style={{ color: theme === "dark" ? "#6B7280" : "#a1a1aa" }} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-3 py-2">
                    <p className="text-sm font-semibold">{nome || "Usuário"}</p>
                    <p className="text-xs text-muted-foreground">{cargoLabel}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="text-xs gap-2 cursor-pointer">
                    <Settings className="h-3.5 w-3.5" /> Configurações
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-xs gap-2 text-destructive cursor-pointer">
                    <LogOut className="h-3.5 w-3.5" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            </header>
            <PushPromptBanner />
            
            <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 min-w-0 bg-[#f0f0f5] dark:bg-[#0f0f12]" style={{ minHeight: 0 }}>
              {children}
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
