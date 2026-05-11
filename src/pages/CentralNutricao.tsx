import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, BarChart3, ListChecks, Volume2, Mail, Workflow, MessageCircle, RefreshCw } from "lucide-react";
import NurturingDashboard from "@/components/automations/NurturingDashboard";
import SequenceTemplates from "@/components/automations/SequenceTemplates";
import CampanhasVozContent from "@/components/central-nutricao/CampanhasVozContent";
import EmailMarketingContent from "@/components/central-nutricao/EmailMarketingContent";
import AutomacoesContent from "@/components/central-nutricao/AutomacoesContent";
import WhatsAppTemplatesManager from "@/components/central-nutricao/WhatsAppTemplatesManager";
import ReengajamentoTab from "@/components/central-nutricao/ReengajamentoTab";

export default function CentralNutricaoPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "reengajamento";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Central de Nutrição</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Reengajamento de descartados, sequências, templates e automações multicanal
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full grid grid-cols-7 h-auto">
          <TabsTrigger value="reengajamento" className="text-[11px] gap-1 py-2 flex-col sm:flex-row">
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reengajamento</span>
            <span className="sm:hidden">Reeng.</span>
          </TabsTrigger>
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
          <TabsTrigger value="templates" className="text-[11px] gap-1 py-2 flex-col sm:flex-row">
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Templates WA</span>
            <span className="sm:hidden">WA</span>
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

        <TabsContent value="reengajamento">
          <ReengajamentoTab />
        </TabsContent>

        <TabsContent value="visao-geral">
          <NurturingDashboard />
        </TabsContent>

        <TabsContent value="sequencias">
          <SequenceTemplates onCreated={() => setReloadKey(k => k + 1)} />
        </TabsContent>

        <TabsContent value="templates">
          <WhatsAppTemplatesManager />
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
