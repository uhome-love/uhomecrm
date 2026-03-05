import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Database, FileText } from "lucide-react";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy load heavy sub-panels
const FunilContent = lazy(() => import("@/components/central/FunilContent"));
const ForecastContent = lazy(() => import("@/components/central/ForecastContent"));
const ReportsContent = lazy(() => import("@/components/central/ReportsContent"));

function TabLoader() {
  return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
}

export default function CentralDados() {
  const [tab, setTab] = useState("funil");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          Central de Dados
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Funil comercial, previsão de vendas e relatórios em um só lugar
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto max-w-lg">
          <TabsTrigger value="funil" className="gap-1.5 text-xs py-2.5">
            <BarChart3 className="h-3.5 w-3.5" /> Funil Comercial
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-1.5 text-xs py-2.5">
            <TrendingUp className="h-3.5 w-3.5" /> Forecast IA
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1.5 text-xs py-2.5">
            <FileText className="h-3.5 w-3.5" /> Relatórios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="funil" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <FunilContent />
          </Suspense>
        </TabsContent>

        <TabsContent value="forecast" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <ForecastContent />
          </Suspense>
        </TabsContent>

        <TabsContent value="relatorios" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <ReportsContent />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
