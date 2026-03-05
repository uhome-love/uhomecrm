import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import UhomeIaAssistant from "@/components/UhomeIaAssistant";
import HomiGreeting from "@/components/HomiGreeting";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
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
import { supabase } from "@/integrations/supabase/client";
import homiMascot from "@/assets/homi-mascot.png";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { isAdmin, isGestor } = useUserRole();
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
          <header className="h-14 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-lg sticky top-0 z-50 px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              {/* Header brand marker */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                <img src={homiMascot} alt="Homi" className="h-5 w-5 object-contain opacity-60" />
                <span className="font-display font-bold text-foreground/70">Uhome<span className="text-primary">Sales</span></span>
              </div>
            </div>

            {/* Right side — user menu */}
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
                <DropdownMenuItem className="text-xs gap-2 cursor-pointer">
                  <Settings className="h-3.5 w-3.5" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-xs gap-2 text-destructive cursor-pointer">
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
      <UhomeIaAssistant />
      <HomiGreeting />
    </SidebarProvider>
  );
}
