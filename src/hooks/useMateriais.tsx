import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MaterialLink {
  id: string;
  empreendimento_id: string;
  categoria: string;
  titulo: string;
  url: string;
  descricao: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface MaterialEmpreendimento {
  id: string;
  nome: string;
  empreendimento_ref: string | null;
  logo_url: string | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  links: MaterialLink[];
}

export function useMateriais() {
  return useQuery({
    queryKey: ["materiais", "list"],
    queryFn: async (): Promise<MaterialEmpreendimento[]> => {
      const { data: emps, error } = await supabase
        .from("materiais_empreendimentos" as any)
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;

      const ids = (emps as any[] | null ?? []).map((e) => e.id);
      let links: any[] = [];
      if (ids.length) {
        const { data: linkData, error: linkErr } = await supabase
          .from("materiais_links" as any)
          .select("*")
          .in("empreendimento_id", ids)
          .order("ordem", { ascending: true })
          .order("created_at", { ascending: true });
        if (linkErr) throw linkErr;
        links = linkData ?? [];
      }

      return (emps as any[] ?? []).map((e) => ({
        ...e,
        links: links.filter((l) => l.empreendimento_id === e.id),
      })) as MaterialEmpreendimento[];
    },
    staleTime: 60 * 1000,
  });
}
