import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  Kanban, CalendarDays, Phone, Users, Search,
  ArrowRight, Clock, Flame, Snowflake, Thermometer,
} from "lucide-react";

interface SearchResult {
  id: string;
  type: "lead" | "negocio" | "visita" | "corretor";
  title: string;
  subtitle: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  url: string;
}

const QUICK_ACTIONS = [
  { label: "Pipeline de Leads", url: "/pipeline-leads", icon: Kanban },
  { label: "Agenda de Visitas", url: "/agenda-visitas", icon: CalendarDays },
  { label: "Oferta Ativa", url: "/oferta-ativa", icon: Phone },
  { label: "Meu Time", url: "/meu-time", icon: Users },
];

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { isGestor, isAdmin } = useUserRole();
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const search = useCallback(async (term: string) => {
    if (!user || term.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const all: SearchResult[] = [];

    try {
      // Search pipeline_leads
      const { data: leads } = await supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, email, empreendimento, temperatura, stage_id, oportunidade_score")
        .or(`nome.ilike.%${term}%,telefone.ilike.%${term}%,email.ilike.%${term}%,empreendimento.ilike.%${term}%`)
        .limit(6);

      // Fetch stage names for badge
      const stageIds = [...new Set((leads || []).map(l => l.stage_id))];
      let stageMap: Record<string, string> = {};
      if (stageIds.length > 0) {
        const { data: stages } = await supabase
          .from("pipeline_stages")
          .select("id, nome")
          .in("id", stageIds);
        (stages || []).forEach(s => { stageMap[s.id] = s.nome; });
      }

      (leads || []).forEach(l => {
        all.push({
          id: l.id,
          type: "lead",
          title: l.nome,
          subtitle: [l.empreendimento, stageMap[l.stage_id], l.oportunidade_score ? `Score ${l.oportunidade_score}` : ""].filter(Boolean).join(" · "),
          badge: stageMap[l.stage_id] || "Lead",
          url: `/pipeline?lead=${l.id}`,
        });
      });

      // Search negócios
      const { data: negocios } = await supabase
        .from("negocios")
        .select("id, nome_cliente, empreendimento, fase, vgv_estimado")
        .eq("status", "ativo")
        .or(`nome_cliente.ilike.%${term}%,empreendimento.ilike.%${term}%`)
        .limit(6);

      (negocios || []).forEach(n => {
        const vgvStr = n.vgv_estimado ? `R$${(n.vgv_estimado / 1000).toFixed(0)}k` : "";
        all.push({
          id: n.id,
          type: "negocio",
          title: n.nome_cliente,
          subtitle: [n.empreendimento, n.fase, vgvStr].filter(Boolean).join(" · "),
          badge: "Negócio",
          url: `/pipeline-negocios?negocio=${n.id}`,
        });
      });

      // Search visitas
      const { data: visitas } = await supabase
        .from("visitas")
        .select("id, nome_cliente, empreendimento, data_visita, hora_visita, status")
        .or(`nome_cliente.ilike.%${term}%,empreendimento.ilike.%${term}%`)
        .order("data_visita", { ascending: false })
        .limit(6);

      (visitas || []).forEach(v => {
        const dateStr = v.data_visita ? new Date(v.data_visita).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
        all.push({
          id: v.id,
          type: "visita",
          title: v.nome_cliente || "Visita",
          subtitle: [v.empreendimento, dateStr, v.hora_visita, v.status].filter(Boolean).join(" · "),
          badge: v.status || "Visita",
          url: `/agenda-visitas?visita=${v.id}`,
        });
      });

      // Search corretores (only for gestor/admin)
      if (isGestor || isAdmin) {
        const { data: corretores } = await supabase
          .from("team_members")
          .select("id, nome, user_id, status")
          .ilike("nome", `%${term}%`)
          .eq("status", "ativo")
          .limit(5);

        (corretores || []).forEach(c => {
          all.push({
            id: c.id,
            type: "corretor",
            title: c.nome,
            subtitle: c.status === "ativo" ? "Ativo" : "Inativo",
            badge: "Corretor",
            url: `/meu-time?corretor=${c.user_id}`,
          });
        });
      }
    } catch (err) {
      console.error("Global search error:", err);
    }

    setResults(all);
    setLoading(false);
  }, [user, isGestor, isAdmin]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  const handleSelect = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  const leads = results.filter(r => r.type === "lead");
  const negocios = results.filter(r => r.type === "negocio");
  const visitas = results.filter(r => r.type === "visita");
  const corretores = results.filter(r => r.type === "corretor");
  const hasResults = results.length > 0;
  const showQuickActions = query.length < 2;

  const typeIcon = (type: string) => {
    switch (type) {
      case "lead": return <Kanban className="h-3.5 w-3.5 text-destructive shrink-0" />;
      case "negocio": return <Flame className="h-3.5 w-3.5 text-primary shrink-0" />;
      case "visita": return <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />;
      case "corretor": return <Users className="h-3.5 w-3.5 text-primary shrink-0" />;
      default: return <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar leads, negócios, visitas, corretores..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {showQuickActions && (
          <CommandGroup heading="Ações rápidas">
            {QUICK_ACTIONS.map(a => (
              <CommandItem key={a.url} onSelect={() => handleSelect(a.url)} className="gap-2.5 cursor-pointer">
                <a.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{a.label}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!showQuickActions && !hasResults && !loading && (
          <CommandEmpty>Nenhum resultado para "{query}"</CommandEmpty>
        )}

        {loading && !hasResults && (
          <div className="py-6 text-center text-sm text-muted-foreground">Buscando...</div>
        )}

        {leads.length > 0 && (
          <CommandGroup heading="🔴 Leads">
            {leads.map(r => (
              <CommandItem key={r.id} onSelect={() => handleSelect(r.url)} className="gap-2.5 cursor-pointer">
                {typeIcon(r.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.subtitle}</p>
                </div>
                {r.badge && (
                  <Badge variant="outline" className="text-[9px] shrink-0">{r.badge}</Badge>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {negocios.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="🟦 Negócios">
              {negocios.map(r => (
                <CommandItem key={r.id} onSelect={() => handleSelect(r.url)} className="gap-2.5 cursor-pointer">
                  {typeIcon(r.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{r.subtitle}</p>
                  </div>
                  {r.badge && (
                    <Badge variant="outline" className="text-[9px] shrink-0">{r.badge}</Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {visitas.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="📅 Visitas">
              {visitas.map(r => (
                <CommandItem key={r.id} onSelect={() => handleSelect(r.url)} className="gap-2.5 cursor-pointer">
                  {typeIcon(r.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{r.subtitle}</p>
                  </div>
                  {r.badge && (
                    <Badge variant="outline" className="text-[9px] shrink-0">{r.badge}</Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {corretores.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="👤 Corretores">
              {corretores.map(r => (
                <CommandItem key={r.id} onSelect={() => handleSelect(r.url)} className="gap-2.5 cursor-pointer">
                  {typeIcon(r.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{r.subtitle}</p>
                  </div>
                  {r.badge && (
                    <Badge variant="outline" className="text-[9px] shrink-0">{r.badge}</Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>

      <div className="border-t border-border px-3 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>↑↓ navegar · Enter selecionar · Esc fechar</span>
        <kbd className="pointer-events-none inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </div>
    </CommandDialog>
  );
}
