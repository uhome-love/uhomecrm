import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Trophy, FileText, TrendingUp } from "lucide-react";
const homiMascot = "/images/homi-mascot-opt.png";
import CeoOverview from "@/components/ceo/CeoOverview";
import CeoReports from "@/components/ceo/CeoReports";
import CeoAdvisor from "@/components/ceo/CeoAdvisor";
import CeoForecastPanel from "@/components/forecast/CeoForecastPanel";
import CeoMonthlyReports from "@/components/ceo/CeoMonthlyReports";
import CeoTeamsRankings from "@/components/ceo/CeoTeamsRankings";

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
        <TabsList className="h-auto">
          <TabsTrigger value="overview" className="gap-1.5 text-xs py-2">
            <BarChart3 className="h-3.5 w-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-1.5 text-xs py-2">
            <Trophy className="h-3.5 w-3.5" /> Times & Rankings
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-1.5 text-xs py-2">
            <TrendingUp className="h-3.5 w-3.5" /> Forecast
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5 text-xs py-2">
            <FileText className="h-3.5 w-3.5" /> Relatórios
          </TabsTrigger>
          <TabsTrigger value="advisor" className="gap-1.5 text-xs py-2">
            <img src={homiMascot} alt="Homi" className="h-4 w-4 object-contain" /> CEO Advisor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4"><CeoOverview /></TabsContent>
        <TabsContent value="teams" className="mt-4"><CeoTeamsRankings /></TabsContent>
        <TabsContent value="forecast" className="mt-4"><CeoForecastPanel /></TabsContent>
        <TabsContent value="reports" className="mt-4 space-y-6">
          <CeoReports />
          <CeoMonthlyReports />
        </TabsContent>
        <TabsContent value="advisor" className="mt-4"><CeoAdvisor /></TabsContent>
      </Tabs>
    </div>
  );
}
