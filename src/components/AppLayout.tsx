import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { User, Settings, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const UhomeIaAssistant = lazy(() => import("@/components/UhomeIaAssistant"));
const HomiGreeting = lazy(() => import("@/components/HomiGreeting"));

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { isAdmin, isGestor } = useUserRole();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const cargo = isAdmin ? "CEO" : isGestor ? "Gerente" : "Corretor";

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.nome) setNome(data.nome);
    });
  }, [user]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border/50 bg-card/80 backdrop-blur-xl sticky top-0 z-50 px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
            </div>

            {/* Right side — user menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2.5 h-9 px-3 hover:bg-accent/50 rounded-xl">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20">
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
              <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/60 shadow-elevated">
                <div className="px-3 py-2">
                  <p className="text-sm font-bold">{nome || "Usuário"}</p>
                  <p className="text-xs text-muted-foreground">{cargo}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="text-xs gap-2 cursor-pointer rounded-lg">
                  <Settings className="h-3.5 w-3.5" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-xs gap-2 text-destructive cursor-pointer rounded-lg">
                  <LogOut className="h-3.5 w-3.5" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
      <ErrorBoundary>
        <Suspense fallback={null}>
          <UhomeIaAssistant />
          <HomiGreeting />
        </Suspense>
      </ErrorBoundary>
    </SidebarProvider>
  );
}
