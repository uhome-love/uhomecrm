import { useMemo, useState } from "react";
import { ChevronRight, Search, Shuffle, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface Contagem {
  empreendimento: string;
  total: number;
}

const LIMITE_PRINCIPAL = 10;

function ehAvulso(nome: string) {
  const n = nome.toLowerCase();
  return /\([A-Z0-9-]+\)\s*$/i.test(nome) || n === "avulso" || n === "sem empreendimento";
}

function Chip({ c, ativo, onClick, grande }: { c: Contagem; ativo: boolean; onClick: () => void; grande?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={c.empreendimento}
      className={`flex items-center justify-between gap-2 rounded-lg border text-left transition-colors ${
        grande ? "px-3 py-2.5" : "px-2.5 py-1.5"
      } ${ativo ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
    >
      <span className={`truncate ${grande ? "text-sm font-medium" : "text-xs"}`}>{c.empreendimento}</span>
      <span className={`shrink-0 text-xs font-semibold ${ativo ? "" : "text-muted-foreground"}`}>{c.total}</span>
    </button>
  );
}

function Grupo({ titulo, itens, sel, toggle, abertoInicial }: {
  titulo: string; itens: Contagem[]; sel: string[]; toggle: (e: string) => void; abertoInicial: boolean;
}) {
  const [aberto, setAberto] = useState<boolean | null>(null);
  if (!itens.length) return null;
  const marcados = itens.filter((i) => sel.includes(i.empreendimento)).length;
  const isMobile = useIsMobile();
  const aberto2 = abertoInicial || (aberto ?? (isMobile || marcados > 0));
  return (
    <Collapsible open={aberto2} onOpenChange={setAberto}>
      <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronRight className={`h-4 w-4 transition-transform ${aberto2 ? "rotate-90" : ""}`} />
        {titulo} ({itens.length}){marcados ? ` · ${marcados} selecionado(s)` : ""}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {itens.map((c) => (
          <Chip key={c.empreendimento} c={c} ativo={sel.includes(c.empreendimento)} onClick={() => toggle(c.empreendimento)} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function EmpreendimentoSeletor({ contagens, selecionados, setSelecionados }: {
  contagens: Contagem[]; selecionados: string[]; setSelecionados: (s: string[]) => void;
}) {
  const [busca, setBusca] = useState("");
  const total = contagens.reduce((s, c) => s + Number(c.total), 0);
  const toggle = (e: string) =>
    setSelecionados(selecionados.includes(e) ? selecionados.filter((x) => x !== e) : [...selecionados, e]);

  const { principais, outros, avulsos } = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = q ? contagens.filter((c) => c.empreendimento.toLowerCase().includes(q)) : contagens;
    const av = lista.filter((c) => ehAvulso(c.empreendimento));
    const resto = lista.filter((c) => !ehAvulso(c.empreendimento));
    return {
      principais: resto.filter((c) => Number(c.total) >= LIMITE_PRINCIPAL),
      outros: resto.filter((c) => Number(c.total) < LIMITE_PRINCIPAL),
      avulsos: av,
    };
  }, [contagens, busca]);

  const buscando = busca.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-base font-semibold">Escolha o empreendimento</div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empreendimento..." className="pl-8" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setSelecionados([])}
        className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left sm:w-auto sm:min-w-[260px] ${
          selecionados.length === 0 ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted"
        }`}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Shuffle className="h-4 w-4 text-primary" /> Aleatório (todos)
        </span>
        <span className="ml-4 text-lg font-bold">{total}</span>
      </button>

      {selecionados.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Escolhidos:</span>
          {selecionados.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => toggle(e)}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
            >
              {e} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {principais.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Principais</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {principais.map((c) => (
              <Chip key={c.empreendimento} c={c} grande ativo={selecionados.includes(c.empreendimento)} onClick={() => toggle(c.empreendimento)} />
            ))}
          </div>
        </div>
      )}

      <Grupo titulo="Outros empreendimentos" itens={outros} sel={selecionados} toggle={toggle} abertoInicial={buscando} />
      <Grupo titulo="Imóveis avulsos e sem empreendimento" itens={avulsos} sel={selecionados} toggle={toggle} abertoInicial={buscando} />

      {buscando && !principais.length && !outros.length && !avulsos.length && (
        <p className="text-sm text-muted-foreground">Nenhum empreendimento encontrado.</p>
      )}
    </div>
  );
}
