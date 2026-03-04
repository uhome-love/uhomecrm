import PdnPanel from "@/components/pdn/PdnPanel";
import { FileSpreadsheet } from "lucide-react";

export default function PdnDashboard() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          PDN — <span className="text-primary">Planilha de Desenvolvimento de Negócios</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registre visitas, acompanhe negócios e gere planos de ação com IA
        </p>
      </div>
      <PdnPanel />
    </div>
  );
}
