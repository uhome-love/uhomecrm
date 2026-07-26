import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu } from "lucide-react";
import SaudeMotorCard from "./SaudeMotorCard";
import WarmupCard from "./WarmupCard";
import FilaVivaCard from "./FilaVivaCard";
import ControlesCard from "./ControlesCard";
import RespostasRecebidasHoje from "@/components/central-nutricao/RespostasRecebidasHoje";
import PeriodFilter, { buildRange, type PeriodRange } from "@/components/central-nutricao/PeriodFilter";
import { useState } from "react";

export default function MotorTab() {
  const [period, setPeriod] = useState<PeriodRange>(() => buildRange("hoje"));
  return (
    <div className="space-y-4">
      <Card className="bg-muted/30 border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            Motor de reengajamento
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Painel único de saúde, warm-up, fila e controles do motor. A saúde combina o worker (está vivo?) e a entrega/qualidade do número (é seguro continuar?).
          </p>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SaudeMotorCard />
        <WarmupCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FilaVivaCard />
        <ControlesCard />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Últimas respostas</CardTitle>
            <PeriodFilter value={period} onChange={setPeriod} />
          </div>
        </CardHeader>
        <CardContent>
          <RespostasRecebidasHoje from={period.from} to={period.to} periodLabel={period.label} />
        </CardContent>
      </Card>
    </div>
  );
}
