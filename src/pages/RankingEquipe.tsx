import { useState } from "react";
import { Trophy, Phone, DollarSign, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RankingOfertaAtivaTab from "@/components/ranking/RankingOfertaAtivaTab";
import RankingVGVTab from "@/components/ranking/RankingVGVTab";
import RankingGestaoLeadsTab from "@/components/ranking/RankingGestaoLeadsTab";

type Period = "hoje" | "semana" | "mes";

const periodLabels: Record<Period, string> = {
  hoje: "Hoje",
  semana: "Esta Semana",
  mes: "Este Mês",
};

export default function RankingEquipe() {
  const [period, setPeriod] = useState<Period>("hoje");

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Trophy className="h-6 w-6 text-warning" /> Rankings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Compare sua performance com o time em 3 categorias
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(Object.entries(periodLabels) as [Period, string][]).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={period === key ? "default" : "outline"}
              className="text-xs"
              onClick={() => setPeriod(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="oferta-ativa" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="oferta-ativa" className="gap-1.5 text-xs sm:text-sm">
            <Phone className="h-3.5 w-3.5" /> Oferta Ativa
          </TabsTrigger>
          <TabsTrigger value="vgv" className="gap-1.5 text-xs sm:text-sm">
            <DollarSign className="h-3.5 w-3.5" /> VGV
          </TabsTrigger>
          <TabsTrigger value="gestao" className="gap-1.5 text-xs sm:text-sm">
            <ClipboardList className="h-3.5 w-3.5" /> Gestão de Leads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="oferta-ativa">
          <RankingOfertaAtivaTab period={period} />
        </TabsContent>
        <TabsContent value="vgv">
          <RankingVGVTab period={period} />
        </TabsContent>
        <TabsContent value="gestao">
          <RankingGestaoLeadsTab period={period} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
