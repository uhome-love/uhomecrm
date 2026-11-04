import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LiaLeituraAviso({ titulo, tentar }: { titulo: string; tentar: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 border-y border-border py-4 text-sm">
      <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
      <p className="min-w-0 flex-1 text-muted-foreground">{titulo}</p>
      <Button variant="outline" size="sm" onClick={tentar}><RefreshCw /> Tentar novamente</Button>
    </div>
  );
}