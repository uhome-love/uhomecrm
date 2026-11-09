import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Users, Plus, CheckSquare, Menu, Phone, CalendarDays, AlignLeft, ListTodo, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { useTabNavigation } from "@/hooks/useTabNavigation";
import { resolveRoute } from "@/config/pageRegistry";
import { useTarefasHoje } from "@/hooks/useTarefasHoje";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

type Role = "admin" | "diretor" | "gestor" | "corretor" | "backoffice" | "rh";

interface Item { label: string; path: string; icon: typeof Home }

function itensPorCargo(role: Role): [Item, Item, Item] {
  if (role === "corretor") {
    return [
      { label: "Início", path: "/corretor", icon: Home },
      { label: "Clientes", path: "/pipeline-leads", icon: Users },
      { label: "Tarefas", path: "/tarefas", icon: CheckSquare },
    ];
  }
  const painel = role === "gestor" ? "/gerente/cockpit" : "/ceo";
  return [
    { label: "Painel", path: painel, icon: Home },
    { label: "Pipeline", path: "/pipeline-leads", icon: AlignLeft },
    { label: "Tarefas", path: "/tarefas", icon: CheckSquare },
  ];
}

export default function MobileBottomNav({ role }: { role: Role }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { openTab } = useTabNavigation();
  const { setOpenMobile } = useSidebar();
  const [criarAberto, setCriarAberto] = useState(false);
  const tarefas = useTarefasHoje();
  const pendentes = tarefas.data?.length ?? 0;

  const go = (path: string) => {
    if (resolveRoute(path.split("?")[0])) openTab(path);
    else navigate(path);
  };

  const [a, b, c] = itensPorCargo(role);
  const ofertaAtiva = role === "corretor" ? "/corretor/call" : "/oferta-ativa";

  const atalhos: Item[] = [
    { label: "Oferta Ativa", path: ofertaAtiva, icon: Phone },
    { label: "Agenda de visitas", path: "/agenda-visitas", icon: CalendarDays },
    { label: "Minha agenda", path: "/minhas-tarefas", icon: ListTodo },
    role === "corretor"
      ? { label: "Meus clientes", path: "/pipeline-leads", icon: Users }
      : { label: "Meu time", path: "/meu-time", icon: UsersRound },
  ];

  const Botao = ({ item, badge }: { item: Item; badge?: number }) => {
    const ativo = location.pathname === item.path;
    const Icon = item.icon;
    return (
      <button
        type="button"
        onClick={() => go(item.path)}
        className={cn(
          "relative flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1 text-[10px] font-medium transition-transform active:scale-90",
          ativo ? "text-primary" : "text-muted-foreground",
        )}
      >
        <span className="relative">
          <Icon className="h-6 w-6" strokeWidth={ativo ? 2.2 : 1.7} />
          {!!badge && (
            <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </span>
        {item.label}
      </button>
    );
  };

  return (
    <>
      <nav
        className="mobile-glass fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border/60 md:hidden"
        style={{ paddingBottom: "var(--sab)" }}
        aria-label="Atalhos"
      >
        <Botao item={a} />
        <Botao item={b} />
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            aria-label="Criar ou abrir atalho"
            onClick={() => setCriarAberto(true)}
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 transition-transform active:scale-90"
          >
            <Plus className="h-7 w-7" strokeWidth={2.4} />
          </button>
        </div>
        <Botao item={c} badge={pendentes} />
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1 text-[10px] font-medium text-muted-foreground transition-transform active:scale-90"
        >
          <Menu className="h-6 w-6" strokeWidth={1.7} />
          Mais
        </button>
      </nav>

      <Drawer open={criarAberto} onOpenChange={setCriarAberto}>
        <DrawerContent className="pb-[calc(1rem+var(--sab))]">
          <DrawerTitle className="px-5 pt-3 text-lg font-bold">Atalhos rápidos</DrawerTitle>
          <div className="grid grid-cols-2 gap-3 p-5">
            {atalhos.map((at) => {
              const Icon = at.icon;
              return (
                <button
                  key={at.label}
                  type="button"
                  onClick={() => { setCriarAberto(false); go(at.path); }}
                  className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-transform active:scale-95"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">{at.label}</span>
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
