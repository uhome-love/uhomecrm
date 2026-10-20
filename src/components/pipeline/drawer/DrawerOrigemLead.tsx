import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRT } from "@/lib/brtTime";

/** Nome do formulário Meta a partir do número (cache no servidor via resolve-meta-forms). */
function useNomeFormulario(formulario?: string | null) {
  const id = (formulario ?? "").trim();
  const numerico = /^\d{6,}$/.test(id);
  const { data } = useQuery({
    queryKey: ["meta-form-name", id],
    enabled: numerico,
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("resolve-meta-forms", { body: { ids: [id] } });
      if (error) return null;
      const names = (data as { names?: Record<string, string | null> } | null)?.names ?? {};
      return names[id] ?? null;
    },
  });
  if (!numerico) return id || null;
  return data ?? `Formulário nº ${id}`;
}

interface Props {
  origem?: string | null;
  campanha?: string | null;
  conjunto?: string | null;
  anuncio?: string | null;
  formulario?: string | null;
  plataforma?: string | null;
  entrouEm?: string | null;
}

/** Linhas da origem do lead (de onde veio, anúncio, formulário) — estilo lista do iPhone. */
export default function DrawerOrigemLead({ origem, campanha, conjunto, anuncio, formulario, plataforma, entrouEm }: Props) {
  const nomeFormulario = useNomeFormulario(formulario);
  let entrou: string | null = null;
  if (entrouEm) entrou = (() => { const d = formatBRT(entrouEm, "dd/MM/yyyy", ""); const h = formatBRT(entrouEm, "HH:mm", ""); return d ? `${d} às ${h}` : null; })();
  const rows = [
    { k: "Origem", v: origem },
    { k: "Plataforma", v: plataforma },
    { k: "Campanha", v: campanha },
    { k: "Conjunto", v: conjunto },
    { k: "Anúncio", v: anuncio },
    { k: "Formulário", v: nomeFormulario },
    { k: "Entrou em", v: entrou },
  ].filter((r) => r.v && String(r.v).trim());
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/50">
      {rows.map((r) => (
        <div key={r.k} className="flex items-start justify-between gap-3 px-3 py-2.5">
          <span className="text-[12px] text-muted-foreground shrink-0">{r.k}</span>
          <span className="text-[12.5px] font-medium text-foreground text-right break-words min-w-0">{r.v}</span>
        </div>
      ))}
    </div>
  );
}
