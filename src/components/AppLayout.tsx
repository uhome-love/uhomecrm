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

// Detect arena-mode class on body reactively
function useArenaMode() {
  return useSyncExternalStore(
    (cb) => {
      const observer = new MutationObserver(cb);
      observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    },
    () => document.body.classList.contains("arena-mode")
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { isAdmin, isGestor } = useUserRole();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const { pendingLead, showDialog, closeDialog, refresh: refreshPending } = usePendingLeadAlert();
  const cargo = isAdmin ? "CEO" : isGestor ? "Gerente" : "Corretor";
  const isArenaMode = useArenaMode();

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
            <header className="h-14 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-lg sticky top-0 z-50 px-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                  <img src={homiMascot} alt="Homi" className="h-7 w-7 object-contain" />
                  <span className="font-display font-extrabold text-foreground/80 text-sm">Uhome<span className="text-primary">Sales</span></span>
                </div>
              </div>

              <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex items-center gap-2 h-8 px-2.5 text-muted-foreground hover:text-foreground rounded-lg border border-border/50 bg-muted/30"
                onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              >
                <Search className="h-3.5 w-3.5" />
                <span className="text-[11px]">Buscar...</span>
                <kbd className="pointer-events-none ml-1 inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </Button>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2.5 h-9 px-3 hover:bg-muted/50 rounded-xl">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="text-left hidden sm:block">
                      <p className="text-xs font-semibold text-foreground leading-tight">
                        {nome || user?.email?.split("@")[0]}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{cargo}</p>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
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
