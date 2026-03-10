import { useState, lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListChecks, Palette, Lightbulb, Loader2 } from "lucide-react";

const TarefasPage = lazy(() => import("@/pages/TarefasPage"));
const MarketingAgenda = lazy(() => import("@/components/marketing/MarketingAgendaTab"));
const HomiIdeiasChat = lazy(() => import("@/components/marketing/HomiIdeiasChat"));

function TabLoader() {
  return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
}

export default function BackofficeCentral() {
  const [tab, setTab] = useState("tarefas");

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="tarefas" className="gap-1.5 text-xs">
            <ListChecks className="h-3.5 w-3.5" /> Tarefas
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-1.5 text-xs">
            <Palette className="h-3.5 w-3.5" /> Marketing
          </TabsTrigger>
          <TabsTrigger value="ideias" className="gap-1.5 text-xs">
            <Lightbulb className="h-3.5 w-3.5" /> Ideias IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tarefas" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <TarefasPage />
          </Suspense>
        </TabsContent>

        <TabsContent value="agenda" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <MarketingAgenda />
          </Suspense>
        </TabsContent>

        <TabsContent value="ideias" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <HomiIdeiasChat />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
