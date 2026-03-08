import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, ClipboardCheck, Phone, BarChart3 } from "lucide-react";
import CeoRankings from "./CeoRankings";
import CeoCheckpointViewer from "./CeoCheckpointViewer";
import CeoTeamComparison from "./CeoTeamComparison";
import PerformanceLivePanel from "@/components/oferta-ativa/PerformanceLivePanel";
import RankingOfertaAtiva from "@/components/oferta-ativa/RankingOfertaAtiva";

export default function CeoTeamsRankings() {
  return (
    <Tabs defaultValue="rankings" className="space-y-4">
      <TabsList className="h-auto">
        <TabsTrigger value="rankings" className="gap-1.5 text-xs py-1.5">
          <Trophy className="h-3.5 w-3.5" /> Rankings
        </TabsTrigger>
        <TabsTrigger value="checkpoints" className="gap-1.5 text-xs py-1.5">
          <ClipboardCheck className="h-3.5 w-3.5" /> Checkpoints
        </TabsTrigger>
        <TabsTrigger value="comparar" className="gap-1.5 text-xs py-1.5">
          <BarChart3 className="h-3.5 w-3.5" /> Comparar Equipes
        </TabsTrigger>
        <TabsTrigger value="oferta-ativa" className="gap-1.5 text-xs py-1.5">
          <Phone className="h-3.5 w-3.5" /> Oferta Ativa
        </TabsTrigger>
      </TabsList>

      <TabsContent value="rankings"><CeoRankings /></TabsContent>
      <TabsContent value="checkpoints"><CeoCheckpointViewer /></TabsContent>
      <TabsContent value="comparar"><CeoTeamComparison /></TabsContent>
      <TabsContent value="oferta-ativa" className="space-y-6">
        <PerformanceLivePanel />
        <RankingOfertaAtiva />
      </TabsContent>
    </Tabs>
  );
}
