import { ChevronRight, LogOut, Moon, Sun, Settings, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface Item { label: string; path: string; icon: React.ReactNode; badge?: string | number }
interface Group { title: string; items: Item[] }

interface Props {
  groups: Group[];
  activePath: string;
  userName: string;
  userRole: string;
  userInitials: string;
  isDark: boolean;
  onThemeToggle?: () => void;
  go: (path: string) => void;
}

/** Tela "Mais" do celular — lista agrupada no estilo dos Ajustes do iPhone. */
export default function MobileMaisMenu({ groups, activePath, userName, userRole, userInitials, isDark, onThemeToggle, go }: Props) {
  const { signOut } = useAuth();

  const Linha = ({ icon, label, onClick, badge, ativo, perigo }: {
    icon: React.ReactNode; label: string; onClick: () => void; badge?: string | number; ativo?: boolean; perigo?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted"
    >
      <span className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        perigo ? "bg-destructive/10 text-destructive" : ativo ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
      )}>
        {icon}
      </span>
      <span className={cn("flex-1 truncate text-[16px]", perigo ? "text-destructive" : "text-foreground", ativo && "font-semibold")}>{label}</span>
      {badge !== undefined && (
        <span className="rounded-full bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground">{badge}</span>
      )}
      {!perigo && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
    </button>
  );

  const Bloco = ({ children }: { children: React.ReactNode }) => (
    <div className="overflow-hidden rounded-2xl bg-card shadow-sm [&>*+*]:border-t [&>*+*]:border-border/60">{children}</div>
  );

  return (
    <div className="flex flex-col gap-6 px-4 pb-[calc(2rem+var(--sab))] pt-2">
      <h2 className="px-1 text-[32px] font-bold tracking-tight text-foreground">Mais</h2>

      <button
        type="button"
        onClick={() => go("/configuracoes")}
        className="flex items-center gap-4 rounded-2xl bg-card p-4 text-left shadow-sm active:bg-muted"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
          {userInitials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold text-foreground">{userName}</span>
          <span className="block truncate text-sm text-muted-foreground">{userRole}</span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground/60" />
      </button>

      {groups.map((g) => (
        <section key={g.title} className="space-y-2">
          <h3 className="px-4 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">{g.title}</h3>
          <Bloco>
            {g.items.map((i) => (
              <Linha key={i.path} icon={i.icon} label={i.label} badge={i.badge} ativo={activePath === i.path} onClick={() => go(i.path)} />
            ))}
          </Bloco>
        </section>
      ))}

      <section className="space-y-2">
        <h3 className="px-4 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">Conta</h3>
        <Bloco>
          <Linha icon={<Bell size={16} />} label="Notificações" onClick={() => go("/notificacoes")} />
          <Linha icon={<Settings size={16} />} label="Configurações" onClick={() => go("/configuracoes")} />
          {onThemeToggle && (
            <Linha icon={isDark ? <Sun size={16} /> : <Moon size={16} />} label={isDark ? "Modo claro" : "Modo escuro"} onClick={onThemeToggle} />
          )}
        </Bloco>
        <Bloco>
          <Linha icon={<LogOut size={16} />} label="Sair" onClick={signOut} perigo />
        </Bloco>
      </section>
    </div>
  );
}
