import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Workflow, Users, History } from "lucide-react";
import CadenciasTab from "@/components/nutricao/CadenciasTab";
import LeadsNutricaoTab from "@/components/nutricao/LeadsNutricaoTab";
import HistoricoEnviosTab from "@/components/nutricao/HistoricoEnviosTab";

export default function NutricaoPage() {
  const [activeTab, setActiveTab] = useState("cadencias");

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Nutrição Automática</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Gestão de cadências de reengajamento e acompanhamento de envios
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full grid grid-cols-3 h-auto">
          <TabsTrigger value="cadencias" className="text-xs gap-1.5 py-2">
            <Workflow className="h-3.5 w-3.5" />
            Cadências
          </TabsTrigger>
          <TabsTrigger value="leads" className="text-xs gap-1.5 py-2">
            <Users className="h-3.5 w-3.5" />
            Leads em Nutrição
          </TabsTrigger>
          <TabsTrigger value="historico" className="text-xs gap-1.5 py-2">
            <History className="h-3.5 w-3.5" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cadencias">
          <CadenciasTab />
        </TabsContent>
        <TabsContent value="leads">
          <LeadsNutricaoTab />
        </TabsContent>
        <TabsContent value="historico">
          <HistoricoEnviosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
