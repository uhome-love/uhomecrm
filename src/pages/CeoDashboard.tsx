import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Trophy, FileText, AlertTriangle, TrendingUp, CheckCircle, Phone, ClipboardCheck } from "lucide-react";
const homiMascot = "/images/homi-mascot-opt.png";
import CeoOverview from "@/components/ceo/CeoOverview";
import CeoRankings from "@/components/ceo/CeoRankings";
import CeoReports from "@/components/ceo/CeoReports";
import CeoAdvisor from "@/components/ceo/CeoAdvisor";
import CeoAlerts from "@/components/ceo/CeoAlerts";
import CeoForecastPanel from "@/components/forecast/CeoForecastPanel";
import CeoVendasAssinadas from "@/components/ceo/CeoVendasAssinadas";
import RankingOfertaAtiva from "@/components/oferta-ativa/RankingOfertaAtiva";
import CeoCheckpointViewer from "@/components/ceo/CeoCheckpointViewer";
import PerformanceLivePanel from "@/components/oferta-ativa/PerformanceLivePanel";

export default function CeoDashboard() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <img src={homiMascot} alt="Homi" className="h-10 w-10 object-contain" />
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Dashboard <span className="text-primary">CEO</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visão macro consolidada de todos os gerentes e corretores
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-9 h-auto">
          <TabsTrigger value="overview" className="gap-1.5 text-xs py-2">
            <BarChart3 className="h-3.5 w-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="checkpoints" className="gap-1.5 text-xs py-2">
            <ClipboardCheck className="h-3.5 w-3.5" /> Checkpoints
          </TabsTrigger>
          <TabsTrigger value="vendas" className="gap-1.5 text-xs py-2">
            <CheckCircle className="h-3.5 w-3.5" /> Vendas
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-1.5 text-xs py-2">
            <TrendingUp className="h-3.5 w-3.5" /> Forecast
          </TabsTrigger>
          <TabsTrigger value="rankings" className="gap-1.5 text-xs py-2">
            <Trophy className="h-3.5 w-3.5" /> Rankings
          </TabsTrigger>
          <TabsTrigger value="oferta-ativa" className="gap-1.5 text-xs py-2">
            <Phone className="h-3.5 w-3.5" /> Oferta Ativa
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5 text-xs py-2">
            <FileText className="h-3.5 w-3.5" /> Relatórios
          </TabsTrigger>
          <TabsTrigger value="advisor" className="gap-1.5 text-xs py-2">
            <img src={homiMascot} alt="Homi" className="h-4 w-4 object-contain" /> CEO Advisor
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5 text-xs py-2">
            <AlertTriangle className="h-3.5 w-3.5" /> Alertas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4"><CeoOverview /></TabsContent>
        <TabsContent value="checkpoints" className="mt-4"><CeoCheckpointViewer /></TabsContent>
        <TabsContent value="vendas" className="mt-4"><CeoVendasAssinadas /></TabsContent>
        <TabsContent value="forecast" className="mt-4"><CeoForecastPanel /></TabsContent>
        <TabsContent value="rankings" className="mt-4"><CeoRankings /></TabsContent>
        <TabsContent value="oferta-ativa" className="mt-4 space-y-6">
          <PerformanceLivePanel />
          <RankingOfertaAtiva />
        </TabsContent>
        <TabsContent value="reports" className="mt-4"><CeoReports /></TabsContent>
        <TabsContent value="advisor" className="mt-4"><CeoAdvisor /></TabsContent>
        <TabsContent value="alerts" className="mt-4"><CeoAlerts /></TabsContent>
      </Tabs>
    </div>
  );
}
