import { useOAPendingQueue } from "@/hooks/useOAPendingQueue";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function PendingAttemptsBar() {
  const { pending, retryAll, hasPending } = useOAPendingQueue();

  if (!hasPending) return null;

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <span className="text-amber-800 font-medium">
          {pending.length} resultado(s) pendente(s) de sincronização
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1 border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
        onClick={retryAll}
      >
        <RefreshCw className="h-3 w-3" /> Reenviar agora
      </Button>
    </div>
  );
}
