import { RefreshCw } from "lucide-react";
import ReengajamentoTab from "@/components/central-nutricao/ReengajamentoTab";

export default function CentralNutricaoPage() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Reengajamento de Descartados</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Disparo automático via WhatsApp para leads descartados nos últimos 60 dias. Quem responder "SIM" volta para a roleta marcado como REATIVADO.
        </p>
      </div>

      <ReengajamentoTab />
    </div>
  );
}
