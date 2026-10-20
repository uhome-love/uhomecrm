import { formatBRT } from "@/lib/formatBRT";

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
  let entrou: string | null = null;
  if (entrouEm) { try { entrou = formatBRT(entrouEm, "dd/MM/yyyy 'às' HH:mm"); } catch { entrou = null; } }
  const rows = [
    { k: "Origem", v: origem },
    { k: "Plataforma", v: plataforma },
    { k: "Campanha", v: campanha },
    { k: "Conjunto", v: conjunto },
    { k: "Anúncio", v: anuncio },
    { k: "Formulário", v: formulario },
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
