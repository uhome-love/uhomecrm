import type { UseQueryResult } from "@tanstack/react-query";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  query: UseQueryResult<Record<string, unknown>>;
  label: string;
}

/**
 * Card de erro compacto para uma seção. Mostra mensagem e botão Retry.
 * Mensagens conhecidas (forbidden/unauthorized) ganham texto amigável.
 */
export function SectionError({ query, label }: Props) {
  const err = query.error as Error | undefined;
  const isForbidden = err?.message === "forbidden";

  return (
    <div className="central-card flex items-center justify-between gap-3 border-danger-500/40 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-danger-500">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>
          {isForbidden
            ? `Sem permissão para visualizar ${label}.`
            : `Não foi possível carregar ${label}.`}
        </span>
      </div>
      {!isForbidden && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
