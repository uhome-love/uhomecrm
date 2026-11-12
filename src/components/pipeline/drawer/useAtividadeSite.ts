import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EventoSite {
  id: string;
  tipo: string;
  dados: Record<string, unknown>;
  pagina: string | null;
  created_at: string;
}

export function useAtividadeSite(leadId: string | undefined) {
  return useQuery({
    queryKey: ["atividade-site", leadId],
    enabled: !!leadId,
    staleTime: 60_000,
    queryFn: async (): Promise<EventoSite[]> => {
      const { data, error } = await supabase.rpc("atividade_site_lead", { p_lead_id: leadId as string });
      if (error) throw error;
      return (data ?? []).map((e) => ({ ...e, dados: (e.dados ?? {}) as Record<string, unknown> }));
    },
  });
}

const txt = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "");

export interface ResumoSite {
  imoveis: { nome: string; vezes: number }[];
  bairros: string[];
  buscas: string[];
  ultimaVisita: string | null;
  diasDistintos: number;
  clicouContato: boolean;
  esquentando: boolean;
  motivos: string[];
  resumoTexto: string | null;
}

/** Regra de temperatura: voltou em 2+ dias, viu o mesmo imóvel 2+ vezes ou clicou no contato. */
export function resumirAtividadeSite(evs: EventoSite[]): ResumoSite {
  const imoveis = new Map<string, number>();
  const bairros = new Map<string, number>();
  const buscas: string[] = [];
  const dias = new Set<string>();
  let clicouContato = false;
  let resumoTexto: string | null = null;
  for (const e of evs) {
    const d = e.dados;
    dias.add(new Date(new Date(e.created_at).getTime() - 3 * 3600e3).toISOString().slice(0, 10));
    if (e.tipo === "visitou_imovel" || e.tipo === "favoritou_imovel") {
      const n = txt(d.imovel_titulo) || txt(d.imovel_codigo);
      if (n) imoveis.set(n, (imoveis.get(n) || 0) + 1);
      const b = txt(d.imovel_bairro);
      if (b) bairros.set(b, (bairros.get(b) || 0) + 1);
    }
    if (e.tipo === "buscou_ia") {
      const q = txt(d.query);
      if (q && !buscas.includes(q)) buscas.push(q);
    }
    if (e.tipo === "clicou_contato") clicouContato = true;
    if (e.tipo === "historico_site" && !resumoTexto) {
      const r = d.resumo;
      resumoTexto = typeof r === "string" ? r : r && typeof r === "object" ? txt((r as Record<string, unknown>).texto) || null : null;
    }
  }
  const lista = [...imoveis.entries()].sort((a, b) => b[1] - a[1]).map(([nome, vezes]) => ({ nome, vezes }));
  const motivos: string[] = [];
  if (dias.size >= 2) motivos.push(`voltou em ${dias.size} dias`);
  if (lista[0] && lista[0].vezes >= 2) motivos.push(`viu ${lista[0].nome} ${lista[0].vezes}x`);
  if (clicouContato) motivos.push("clicou no contato");
  const ultima = evs.find((e) => e.tipo !== "historico_site") ?? evs[0];
  return {
    imoveis: lista.slice(0, 5),
    bairros: [...bairros.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b).slice(0, 5),
    buscas: buscas.slice(0, 5),
    ultimaVisita: ultima?.created_at ?? null,
    diasDistintos: dias.size,
    clicouContato,
    esquentando: motivos.length > 0,
    motivos,
    resumoTexto,
  };
}

export function descreverEvento(e: EventoSite): { titulo: string; detalhe?: string } {
  const d = e.dados;
  switch (e.tipo) {
    case "visitou_imovel":
      return { titulo: "Viu imóvel", detalhe: [txt(d.imovel_titulo) || txt(d.imovel_codigo), txt(d.imovel_bairro)].filter(Boolean).join(" · ") };
    case "favoritou_imovel":
      return { titulo: "Favoritou imóvel", detalhe: txt(d.imovel_titulo) || txt(d.imovel_codigo) };
    case "buscou_ia":
      return { titulo: "Buscou no site", detalhe: txt(d.query) ? `“${txt(d.query)}”` : undefined };
    case "clicou_contato":
      return { titulo: "Clicou para falar", detalhe: txt(d.canal) || txt(d.imovel_titulo) || undefined };
    case "formulario_enviado":
      return { titulo: "Enviou formulário", detalhe: txt(d.imovel_titulo) || txt(d.formulario) || undefined };
    case "historico_site":
      return { titulo: "Histórico do site recebido" };
    default:
      return { titulo: e.tipo };
  }
}
