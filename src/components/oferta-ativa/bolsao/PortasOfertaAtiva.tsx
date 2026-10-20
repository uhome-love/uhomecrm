import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Porta = "estagnados" | "descartados" | "listas";

function useTotal(porta: "estagnados" | "descartados") {
  return useQuery({
    queryKey: ["bolsao-contagens", porta],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("bolsao_contagens", { p_porta: porta });
      if (error) throw error;
      return (data ?? []) as { empreendimento: string; total: number }[];
    },
    staleTime: 60_000,
    select: (rows) => rows.reduce((s, r) => s + Number(r.total), 0),
  });
}

export default function PortasOfertaAtiva({ value, onChange }: { value: Porta | null; onChange: (p: Porta) => void }) {
  const est = useTotal("estagnados");
  const desc = useTotal("descartados");
  const portas: { v: Porta; titulo: string; desc: string; n?: number }[] = [
    { v: "estagnados", titulo: "Estagnados recentes", desc: "Clientes que não tiveram sequência", n: est.data },
    { v: "descartados", titulo: "Descartados recentes", desc: "Descartados nos últimos 6 meses", n: desc.data },
    { v: "listas", titulo: "Listas de leads", desc: "Campanhas da Oferta Ativa" },
  ];
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {portas.map((p) => (
        <button
          key={p.v}
          onClick={() => onChange(p.v)}
          className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
            value === p.v ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted"
          }`}
        >
          <div className="min-w-0">
            <div className="text-sm font-semibold">{p.titulo}</div>
            <div className="text-xs text-muted-foreground">{p.desc}</div>
          </div>
          {p.n !== undefined && <div className="shrink-0 text-2xl font-bold">{p.n.toLocaleString("pt-BR")}</div>}
        </button>
      ))}
    </div>
  );
}
