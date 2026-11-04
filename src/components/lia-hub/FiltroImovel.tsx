import { Button } from "@/components/ui/button";
import { produtoLabel } from "./useLiaHub";

/**
 * Filtro por imóvel (empreendimento) reutilizável em todas as abas do hub da LIA.
 * Só aparece quando há mais de um imóvel na base. "todos" = sem filtro.
 */
export default function FiltroImovel({
  produtos,
  valor,
  onChange,
  className,
}: {
  produtos: string[];
  valor: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  if (produtos.length <= 1) return null;
  return (
    <div className={`-mx-3 flex items-center gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&>*]:shrink-0 ${className ?? ""}`}>
      <span className="mr-1 text-xs font-medium text-muted-foreground">Imóvel:</span>
      <Button
        size="sm"
        variant={valor === "todos" ? "default" : "outline"}
        className="h-7 text-xs"
        onClick={() => onChange("todos")}
      >
        Todos
      </Button>
      {produtos.map((slug) => (
        <Button
          key={slug}
          size="sm"
          variant={valor === slug ? "default" : "outline"}
          className="h-7 text-xs"
          onClick={() => onChange(slug)}
        >
          {produtoLabel(slug)}
        </Button>
      ))}
    </div>
  );
}
