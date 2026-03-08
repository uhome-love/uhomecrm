import { BarChart3 } from "lucide-react";
import CorretorWeeklySummary from "@/components/corretor/CorretorWeeklySummary";

export default function CorretorResumo() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-black text-foreground flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-primary" /> 📊 Resumo Semanal
        </h1>
        <p className="text-sm text-gray-500 mt-1">Acompanhe sua evolução semana a semana</p>
      </div>
      <CorretorWeeklySummary />
    </div>
  );
}
