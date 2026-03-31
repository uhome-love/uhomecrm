import { useState, lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, BarChart3, ListChecks, Volume2, Mail, Workflow } from "lucide-react";
import NurturingDashboard from "@/components/automations/NurturingDashboard";
import SequenceTemplates from "@/components/automations/SequenceTemplates";
import CampanhasVozContent from "@/components/central-nutricao/CampanhasVozContent";
import EmailMarketingContent from "@/components/central-nutricao/EmailMarketingContent";
import AutomacoesContent from "@/components/central-nutricao/AutomacoesContent";

const TabLoader = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

export default function CentralNutricaoPage() {
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Central de Nutrição</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Orquestração multicanal inteligente — WhatsApp, Email, Voz IA e Automações
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full grid grid-cols-5 h-auto">
          <TabsTrigger value="visao-geral" className="text-[11px] gap-1 py-2 flex-col sm:flex-row">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Visão Geral</span>
            <span className="sm:hidden">Geral</span>
          </TabsTrigger>
          <TabsTrigger value="sequencias" className="text-[11px] gap-1 py-2 flex-col sm:flex-row">
            <ListChecks className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sequências</span>
            <span className="sm:hidden">Seq.</span>
          </TabsTrigger>
          <TabsTrigger value="voz" className="text-[11px] gap-1 py-2 flex-col sm:flex-row">
            <Volume2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Voz IA</span>
            <span className="sm:hidden">Voz</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="text-[11px] gap-1 py-2 flex-col sm:flex-row">
            <Mail className="h-3.5 w-3.5" />
            <span>Email</span>
          </TabsTrigger>
          <TabsTrigger value="automacoes" className="text-[11px] gap-1 py-2 flex-col sm:flex-row">
            <Workflow className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Automações</span>
            <span className="sm:hidden">Auto.</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          <NurturingDashboard />
        </TabsContent>

        <TabsContent value="sequencias">
          <SequenceTemplates onCreated={() => setReloadKey(k => k + 1)} />
        </TabsContent>

        <TabsContent value="voz">
          <CampanhasVozContent />
        </TabsContent>

        <TabsContent value="email">
          <EmailMarketingContent />
        </TabsContent>

        <TabsContent value="automacoes">
          <AutomacoesContent key={reloadKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
