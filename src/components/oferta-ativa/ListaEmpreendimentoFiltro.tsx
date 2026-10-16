import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const KEY = (listaId: string) => `oa_lista_emps_${listaId}`;

export function lerFiltroLista(listaId: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY(listaId)) || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function salvarFiltroLista(listaId: string, v: string[]) {
  try {
    if (v.length) localStorage.setItem(KEY(listaId), JSON.stringify(v));
    else localStorage.removeItem(KEY(listaId));
  } catch {
    /* ignore */
  }
}

interface Props {
  listaId: string;
  value: string[];
  onChange: (v: string[]) => void;
}

/** Pílulas para o corretor escolher empreendimentos dentro da lista selecionada. */
export default function ListaEmpreendimentoFiltro({ listaId, value, onChange }: Props) {
  const { data } = useQuery({
    queryKey: ["oa-lista-empreendimentos", listaId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("oa_lista_empreendimentos", { p_lista_id: listaId });
      if (error) throw error;
      return (data ?? []) as { empreendimento: string; disponiveis: number }[];
    },
    staleTime: 60_000,
  });

  const opcoes = data ?? [];
  if (opcoes.length < 2 && value.length === 0) return null;

  const total = opcoes.reduce((s, o) => s + Number(o.disponiveis), 0);
  const toggle = (emp: string) =>
    onChange(value.includes(emp) ? value.filter((e) => e !== emp) : [...value, emp]);

  const pill = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-card text-foreground border-border hover:bg-muted",
    );

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2">
      <span className="mr-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" /> Empreendimentos:
      </span>
      <button type="button" className={pill(value.length === 0)} onClick={() => onChange([])}>
        Todos <span className="opacity-70 tabular-nums">{total}</span>
      </button>
      {opcoes.map((o) => (
        <button key={o.empreendimento} type="button" className={pill(value.includes(o.empreendimento))} onClick={() => toggle(o.empreendimento)}>
          {o.empreendimento || "Sem empreendimento"}
          <span className="opacity-70 tabular-nums">{o.disponiveis}</span>
        </button>
      ))}
    </div>
  );
}
