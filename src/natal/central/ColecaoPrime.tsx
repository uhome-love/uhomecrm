import { useMemo, useState } from "react";
import { CardArquivo, Vazio } from "./Pecas";
import type { Material } from "./useMateriais";

type Formato = "feed" | "story";

/** Coleção Prime: 1 peça por empreendimento, em Feed (4:5) ou Stories (9:16). */
export function AbaColecaoPrime({ itens, urls }: { itens: Material[]; urls: Record<string, string> }) {
  const [formato, setFormato] = useState<Formato>("feed");
  const lista = useMemo(() => itens.filter((m) => m.chave.toLowerCase().endsWith(`-${formato}`)), [itens, formato]);
  if (!itens.length) return <Vazio />;
  const capa = lista.find((m) => m.chave.startsWith("PRIME-00"));
  const resto = lista.filter((m) => m !== capa);
  const proporcao = formato === "feed" ? "aspect-[4/5]" : "aspect-[9/16]";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="natal-secao-titulo">✨ Coleção Prime</h3>
          <p className="text-xs text-muted-foreground">Uma peça para cada empreendimento de alto padrão.</p>
        </div>
        <div role="tablist" className="inline-flex rounded-full border bg-card p-1">
          {(["feed", "story"] as Formato[]).map((f) => (
            <button key={f} role="tab" aria-selected={formato === f} onClick={() => setFormato(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${formato === f ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {f === "feed" ? "Feed" : "Stories"}
            </button>
          ))}
        </div>
      </div>
      {capa && <div className="max-w-xs"><CardArquivo m={capa} url={urls[capa.arquivo_path]} proporcao={proporcao} /></div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        {resto.map((m) => <CardArquivo key={m.id} m={m} url={urls[m.arquivo_path]} proporcao={proporcao} />)}
      </div>
    </div>
  );
}
