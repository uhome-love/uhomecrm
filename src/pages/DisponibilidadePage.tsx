import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DisponibilidadeGerencialPanel from "@/components/disponibilidade/DisponibilidadeGerencialPanel";
import PendingLeadsPanel from "@/components/pipeline/PendingLeadsPanel";
import DistributionDashboard from "@/components/pipeline/DistributionDashboard";
import { RotateCw, AlertTriangle, BarChart3 } from "lucide-react";

export default function DisponibilidadePage() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Motor de Distribuição de Leads
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Roleta inteligente, leads pendentes e performance de atendimento
        </p>
      </div>

      <Tabs defaultValue="roleta" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roleta" className="gap-1.5">
            <RotateCw className="h-3.5 w-3.5" />
            Roleta
          </TabsTrigger>
          <TabsTrigger value="pendentes" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Pendentes
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roleta">
          <DisponibilidadeGerencialPanel />
        </TabsContent>

        <TabsContent value="pendentes">
          <PendingLeadsPanel />
        </TabsContent>

        <TabsContent value="performance">
          <DistributionDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
