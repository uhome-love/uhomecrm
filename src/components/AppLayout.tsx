import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
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
import { useEffect, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePendingLeadAlert } from "@/hooks/usePendingLeadAlert";
import LeadAcceptanceDialog from "@/components/pipeline/LeadAcceptanceDialog";
import NewLeadBanner from "@/components/notifications/NewLeadBanner";
import GlobalSearch from "@/components/GlobalSearch";
import { Search } from "lucide-react";
import { HomiProvider } from "@/contexts/HomiContext";
const homiMascot = "/images/homi-mascot-opt.png";

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { isAdmin, isGestor } = useUserRole();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const { pendingLead, showDialog, closeDialog, refresh: refreshPending } = usePendingLeadAlert();
  const cargo = isAdmin ? "CEO" : isGestor ? "Gerente" : "Corretor";
  const { isFullscreen, isSession } = useArenaMode();

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.nome) setNome(data.nome);
    });
  }, [user]);

  return (
    <SidebarProvider>
      <HomiProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
            <header
              className="h-14 flex items-center justify-between sticky top-0 z-50 px-4"
              style={{
                background: "hsl(var(--sidebar-background))",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center gap-3">
                <SidebarTrigger className="text-gray-400 hover:text-white" />
                <div className="hidden sm:flex items-center gap-2 text-xs">
                  <img src={homiMascot} alt="Homi" className="h-7 w-7 object-contain" />
                  <span className="font-display font-extrabold text-sm">
                    <span style={{ color: "rgba(255,255,255,0.8)" }}>Uhome</span>
                    <span className="text-primary">Sales</span>
                  </span>
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
                style={{
                  color: "#9CA3AF",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              >
                <Search className="h-3.5 w-3.5" style={{ color: "#9CA3AF" }} />
                <span className="text-[11px]" style={{ color: "#6B7280" }}>Buscar...</span>
                <kbd className="pointer-events-none ml-1 inline-flex h-5 items-center gap-0.5 rounded px-1 font-mono text-[10px] font-medium" style={{ color: "#6B7280", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  ⌘K
                </kbd>
              </Button>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2.5 h-9 px-3 hover:bg-white/5 rounded-xl">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <User className="h-3.5 w-3.5" style={{ color: "#9CA3AF" }} />
                    </div>
                    <div className="text-left hidden sm:block">
                      <p className="text-xs font-medium leading-tight" style={{ color: "#fff" }}>
                        {nome || user?.email?.split("@")[0]}
                      </p>
                      <p className="text-[10px] leading-tight" style={{ color: "#9CA3AF" }}>{cargo}</p>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 hidden sm:block" style={{ color: "#6B7280" }} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-3 py-2">
                    <p className="text-sm font-semibold">{nome || "Usuário"}</p>
                    <p className="text-xs text-muted-foreground">{cargo}</p>
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
            <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 min-w-0">
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
