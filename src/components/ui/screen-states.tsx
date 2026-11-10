import { Loader2, AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ScreenStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: { label: string; onClick: () => void };
  className?: string;
  children?: React.ReactNode;
}

/**
 * Standardized loading state — explains what's loading, never an orphan spinner.
 */
export function LoadingState({
  title = "Carregando...",
  description,
  icon,
  className,
}: ScreenStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-20 gap-3 text-center px-4", className)}>
      {icon ?? <Loader2 className="h-8 w-8 animate-spin text-primary" />}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground max-w-xs">{description}</p>}
    </div>
  );
}

/**
 * Standardized empty state — explains why no data is shown.
 */
export function EmptyState({
  title = "Nenhum dado encontrado",
  description,
  icon,
  action,
  className,
  children,
}: ScreenStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 gap-3 text-center px-4", className)}>
      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1 [&_svg]:h-5 [&_svg]:w-5">{icon ?? <Inbox />}</div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground max-w-sm">{description}</p>}
      {action && (
        <Button variant="outline" size="sm" className="gap-1.5 mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}

/**
 * Standardized error state — shows a safe retry path.
 */
export function ErrorState({
  title = "Algo deu errado",
  description = "Não foi possível carregar os dados. Tente novamente.",
  icon,
  action,
  className,
}: ScreenStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 gap-3 text-center px-4", className)}>
      <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-1 [&_svg]:h-5 [&_svg]:w-5">{icon ?? <AlertTriangle />}</div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground max-w-sm">{description}</p>}
      {action && (
        <Button variant="outline" size="sm" className="gap-1.5 mt-2" onClick={action.onClick}>
          <RefreshCw className="h-3.5 w-3.5" />
          {action.label}
        </Button>
      )}
    </div>
  );
}
