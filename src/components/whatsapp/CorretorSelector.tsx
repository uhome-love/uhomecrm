import { useState, useMemo } from "react";
import { Eye, Check, ChevronsUpDown, Search, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup, CommandSeparator } from "@/components/ui/command";
import { differenceInHours } from "date-fns";
import type { ConversationItem } from "./ConversationList";

export interface CorretorInfo {
  id: string;
  nome: string;
  userId: string;
}

interface CorretorSelectorProps {
  corretores: CorretorInfo[];
  selectedCorretorId: string | null;
  onSelect: (corretorId: string | null) => void;
  conversations: ConversationItem[];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
  "bg-pink-500", "bg-orange-500",
];

function getAvatarColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export default function CorretorSelector({
  corretores,
  selectedCorretorId,
  onSelect,
  conversations,
}: CorretorSelectorProps) {
  const [open, setOpen] = useState(false);

  // Pre-compute per-corretor stats from conversations
  const corretorStats = useMemo(() => {
    const stats = new Map<string, { count: number; hasCriticalSLA: boolean }>();
    
    const now = new Date();
    for (const conv of conversations) {
      if (!conv.corretorId) continue;
      const existing = stats.get(conv.corretorId) || { count: 0, hasCriticalSLA: false };
      existing.count++;
      if (conv.lastReceivedTs && differenceInHours(now, new Date(conv.lastReceivedTs)) >= 2) {
        existing.hasCriticalSLA = true;
      }
      stats.set(conv.corretorId, existing);
    }
    return stats;
  }, [conversations]);

  // Sort corretores: SLA critical → has conversations → alphabetical
  const sortedCorretores = useMemo(() => {
    return [...corretores].sort((a, b) => {
      const sa = corretorStats.get(a.id);
      const sb = corretorStats.get(b.id);
      const aCrit = sa?.hasCriticalSLA ? 1 : 0;
      const bCrit = sb?.hasCriticalSLA ? 1 : 0;
      if (aCrit !== bCrit) return bCrit - aCrit;
      const aCount = sa?.count || 0;
      const bCount = sb?.count || 0;
      if (aCount !== bCount) return bCount - aCount;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [corretores, corretorStats]);

  const selectedCorretor = corretores.find(c => c.id === selectedCorretorId);
  const selectedLabel = selectedCorretor ? selectedCorretor.nome : "Todos os corretores";
  const totalConversas = conversations.length;

  if (corretores.length === 0) return null;

  return (
    <div className="px-3 pt-2.5 pb-2 border-b border-border bg-muted/20 flex-shrink-0 space-y-1.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Eye size={12} />
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          Visualizando
        </span>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="w-full flex items-center justify-between h-9 px-3 rounded-lg border border-border bg-background text-sm font-medium hover:bg-accent/50 transition-colors"
            role="combobox"
            aria-expanded={open}
          >
            <div className="flex items-center gap-2 min-w-0">
              {selectedCorretor ? (
                <>
                  <Avatar className="h-5 w-5 text-[9px]">
                    <AvatarFallback className={`${getAvatarColor(corretores.indexOf(selectedCorretor))} text-white text-[9px] font-bold`}>
                      {getInitials(selectedCorretor.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{selectedCorretor.nome}</span>
                </>
              ) : (
                <>
                  <Search size={14} className="text-muted-foreground shrink-0" />
                  <span className="truncate text-muted-foreground">
                    Todos os corretores
                    <span className="ml-1 text-xs opacity-60">({totalConversas})</span>
                  </span>
                </>
              )}
            </div>
            <ChevronsUpDown size={14} className="text-muted-foreground shrink-0 ml-1" />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar corretor..." />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>Nenhum corretor encontrado.</CommandEmpty>
              <CommandGroup>
                {/* Todos option */}
                <CommandItem
                  value="__todos__"
                  onSelect={() => { onSelect(null); setOpen(false); }}
                  className="flex items-center gap-2"
                >
                  <Search size={14} className="text-muted-foreground shrink-0" />
                  <span className="flex-1">Todos os corretores</span>
                  <span className="text-xs text-muted-foreground">({totalConversas})</span>
                  {selectedCorretorId === null && <Check size={14} className="text-primary shrink-0" />}
                </CommandItem>

                <CommandSeparator />

                {/* Corretores */}
                {sortedCorretores.map((c, idx) => {
                  const stats = corretorStats.get(c.id);
                  const count = stats?.count || 0;
                  const hasCritical = stats?.hasCriticalSLA || false;
                  const originalIdx = corretores.indexOf(c);

                  return (
                    <CommandItem
                      key={c.id}
                      value={c.nome}
                      onSelect={() => { onSelect(c.id); setOpen(false); }}
                      className="flex items-center gap-2"
                    >
                      <Avatar className="h-6 w-6 text-[10px] shrink-0">
                        <AvatarFallback className={`${getAvatarColor(originalIdx)} text-white text-[10px] font-bold`}>
                          {getInitials(c.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">{c.nome}</span>
                      {hasCritical && (
                        <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" title="SLA crítico (>2h)" />
                      )}
                      {count > 0 && (
                        <span className="text-xs text-muted-foreground">({count})</span>
                      )}
                      {selectedCorretorId === c.id && <Check size={14} className="text-primary shrink-0" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
