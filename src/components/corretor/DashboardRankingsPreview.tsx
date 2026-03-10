import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Trophy, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import RankingOfertaAtivaTab from "@/components/ranking/RankingOfertaAtivaTab";
import RankingVGVTab from "@/components/ranking/RankingVGVTab";
import RankingGestaoLeadsTab from "@/components/ranking/RankingGestaoLeadsTab";

export default function DashboardRankingsPreview() {
  const navigate = useNavigate();

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-foreground">Rankings</span>
          </div>
          <Button variant="link" size="sm" className="h-auto p-0 text-[10px] text-primary" onClick={() => navigate("/corretor/ranking-equipes")}>
            Ver completo <ChevronRight className="h-3 w-3 inline" />
          </Button>
        </div>

        <Tabs defaultValue="oa" className="w-full">
          <TabsList className="h-8 w-full">
            <TabsTrigger value="oa" className="text-xs flex-1">📞 Oferta Ativa</TabsTrigger>
            <TabsTrigger value="vgv" className="text-xs flex-1">💰 VGV</TabsTrigger>
            <TabsTrigger value="gestao" className="text-xs flex-1">📋 Gestão</TabsTrigger>
          </TabsList>
          <TabsContent value="oa" className="mt-2">
            <RankingOfertaAtivaTab period="hoje" />
          </TabsContent>
          <TabsContent value="vgv" className="mt-2">
            <RankingVGVTab period="semana" />
          </TabsContent>
          <TabsContent value="gestao" className="mt-2">
            <RankingGestaoLeadsTab period="semana" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
