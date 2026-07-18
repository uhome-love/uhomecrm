import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCategoriasForStage } from "@/lib/stageToCategoria";
import { CATEGORY_ICONS, type MarketplaceCategory } from "@/hooks/useMarketplace";

export type FocusScriptSource = "marketplace" | "team" | "default";

export interface FocusScript {
  key: string;              // id único no card
  label: string;
  emoji: string;
  content: string;          // texto pronto (com placeholders {nome}/{empreendimento}/{corretor})
  source: FocusScriptSource;
  marketplaceId?: string;   // para incrementar total_usos
}

interface UseFocusScriptsArgs {
  leadStage: string;
  empreendimento?: string;
}

export function useFocusScripts({ leadStage, empreendimento }: UseFocusScriptsArgs) {
  const categorias = getCategoriasForStage(leadStage);

  const marketplaceQ = useQuery({
    queryKey: ["focus-scripts-marketplace", leadStage, categorias.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_items")
        .select("id, titulo, conteudo, categoria, media_avaliacao, total_usos")
        .eq("status", "aprovado")
        .in("categoria", categorias as string[])
        .order("media_avaliacao", { ascending: false })
        .order("total_usos", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 5 * 60_000,
  });

  const teamQ = useQuery({
    queryKey: ["focus-scripts-team", empreendimento || "*"],
    queryFn: async () => {
      let q = supabase
        .from("team_scripts")
        .select("id, titulo, empreendimento, script_ligacao, script_whatsapp, script_email, ativo")
        .eq("ativo", true);
      if (empreendimento) q = q.or(`empreendimento.eq.${empreendimento},empreendimento.is.null`);
      const { data, error } = await q.limit(20);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 5 * 60_000,
  });

  const marketplaceScripts: FocusScript[] = (marketplaceQ.data || []).map((it) => ({
    key: `mkt-${it.id}`,
    label: it.titulo?.slice(0, 32) || "Script",
    emoji: CATEGORY_ICONS[it.categoria as MarketplaceCategory] || "⭐",
    content: it.conteudo || "",
    source: "marketplace" as const,
    marketplaceId: it.id,
  }));

  const teamScripts: FocusScript[] = (teamQ.data || []).flatMap((ts) => {
    const base = ts.titulo || ts.empreendimento || "Script do time";
    const out: FocusScript[] = [];
    if (ts.script_ligacao) out.push({ key: `team-${ts.id}-lig`, label: `${base} — Ligação`, emoji: "📞", content: ts.script_ligacao, source: "team" });
    if (ts.script_whatsapp) out.push({ key: `team-${ts.id}-wa`, label: `${base} — WhatsApp`, emoji: "💬", content: ts.script_whatsapp, source: "team" });
    if (ts.script_email) out.push({ key: `team-${ts.id}-em`, label: `${base} — Email`, emoji: "✉️", content: ts.script_email, source: "team" });
    return out;
  });

  const isLoading = marketplaceQ.isLoading || teamQ.isLoading;

  // Cascata: Marketplace → Time → default (hardcode via caller).
  let scripts: FocusScript[] = [];
  let source: FocusScriptSource = "default";
  if (marketplaceScripts.length > 0) {
    scripts = marketplaceScripts;
    source = "marketplace";
  } else if (teamScripts.length > 0) {
    scripts = teamScripts;
    source = "team";
  }

  return { scripts, source, isLoading };
}
