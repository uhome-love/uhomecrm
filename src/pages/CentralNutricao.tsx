import { RefreshCw, Shield, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReengajamentoTab from "@/components/central-nutricao/ReengajamentoTab";
import AuditoriaWebhookTab from "@/components/central-nutricao/AuditoriaWebhookTab";
import VisitaAmanhaTab from "@/components/central-nutricao/VisitaAmanhaTab";

export default function CentralNutricaoPage() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Central de Nutrição</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Disparos automáticos via WhatsApp para reengajar descartados ou convidar leads ativos para visitas.
        </p>
      </div>

      <Tabs defaultValue="reengajamento">
        <TabsList>
          <TabsTrigger value="reengajamento" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Reengajamento Descartados
          </TabsTrigger>
          <TabsTrigger value="visita-amanha" className="gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Visita Amanhã
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Auditoria Webhook
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reengajamento" className="mt-4">
          <ReengajamentoTab />
        </TabsContent>
        <TabsContent value="visita-amanha" className="mt-4">
          <VisitaAmanhaTab />
        </TabsContent>
        <TabsContent value="auditoria" className="mt-4">
          <AuditoriaWebhookTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

