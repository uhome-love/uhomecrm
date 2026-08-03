import { type ReactNode } from "react";
import { Inbox, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/screen-states";

export type SkeletonVariant = "kpis" | "list" | "page";

interface StateWrapperProps {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  /** Dados podem estar desatualizados/parciais — mostra banner acima do conteúdo. */
  stale?: boolean;
  staleMessage?: string;
  onRetry?: () => void;

  skeleton?: ReactNode;
  skeletonVariant?: SkeletonVariant;

  errorTitle?: string;
  errorDescription?: string;

  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };

  className?: string;
  children?: ReactNode;
}

function DefaultSkeleton({ variant }: { variant: SkeletonVariant }) {
  if (variant === "kpis") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-[12px] p-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-12 mt-2" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-[12px] p-3">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2 mt-2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-[12px]" />
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-[12px]" />
    </div>
  );
}

/**
 * Casca padrão de estados de tela: loading (skeleton), erro (com retry),
 * vazio (EmptyState) e parcial/desatualizado (banner).
 * Precedência: error > loading > empty > conteúdo.
 */
export function StateWrapper({
  loading,
  error,
  empty,
  stale,
  staleMessage = "Alguns dados podem estar desatualizados.",
  onRetry,
  skeleton,
  skeletonVariant = "page",
  errorTitle,
  errorDescription,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  className,
  children,
}: StateWrapperProps) {
  if (error) {
    return (
      <div className={className}>
        <ErrorState
          title={errorTitle}
          description={errorDescription}
          action={onRetry ? { label: "Tentar de novo", onClick: onRetry } : undefined}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={className}>{skeleton ?? <DefaultSkeleton variant={skeletonVariant} />}</div>
    );
  }

  if (empty) {
    return (
      <div className={className}>
        <EmptyState
          icon={emptyIcon ?? <Inbox className="h-6 w-6" />}
          title={emptyTitle ?? "Nenhum dado encontrado"}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className={cn(className)}>
      {stale && (
        <div className="mb-3 flex items-center gap-2 rounded-[10px] border border-warning-500/30 bg-warning-500/10 px-3 py-2 text-[12px] text-foreground">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning-500" />
          <span>{staleMessage}</span>
        </div>
      )}
      {children}
    </div>
  );
}

export default StateWrapper;
