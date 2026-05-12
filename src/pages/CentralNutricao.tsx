import { RefreshCw, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReengajamentoTab from "@/components/central-nutricao/ReengajamentoTab";
import AuditoriaWebhookTab from "@/components/central-nutricao/AuditoriaWebhookTab";

export default function CentralNutricaoPage() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Reengajamento de Descartados</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Disparo automático via WhatsApp para leads descartados nos últimos 60 dias. Quem responder "SIM" volta para a roleta marcado como REATIVADO.
        </p>
      </div>

      <Tabs defaultValue="reengajamento">
        <TabsList>
          <TabsTrigger value="reengajamento" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Disparos
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Auditoria Webhook
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reengajamento" className="mt-4">
          <ReengajamentoTab />
        </TabsContent>
        <TabsContent value="auditoria" className="mt-4">
          <AuditoriaWebhookTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
