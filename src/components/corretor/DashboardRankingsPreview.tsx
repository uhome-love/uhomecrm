import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Trophy, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { todayBRT } from "@/lib/utils";
import { useOARanking } from "@/hooks/useOfertaAtiva";

const medals = ["🥇", "🥈", "🥉"];

function MiniRankList({ items, userId, metric }: { items: { id: string; nome: string; value: number }[]; userId?: string; metric: string }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-3">Sem dados ainda</p>;
  }
  return (
    <div className="space-y-1">
      {items.slice(0, 5).map((item, i) => {
        const isMe = item.id === userId;
        return (
          <div key={item.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs ${isMe ? "bg-primary/10 font-bold" : "hover:bg-accent/30"} transition-colors`}>
            <span className="w-5 text-center shrink-0">{i < 3 ? medals[i] : `#${i + 1}`}</span>
            <span className="flex-1 text-foreground truncate">{item.nome}</span>
            <span className="font-bold text-foreground tabular-nums">{item.value}</span>
            <span className="text-[10px] text-muted-foreground">{metric}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardRankingsPreview() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // OA ranking
  const { ranking: oaRanking } = useOARanking("hoje");
  const oaItems = (oaRanking || []).map(r => ({ id: r.corretor_id, nome: r.nome, value: r.tentativas }));

  // VGV mini ranking (from negocios)
  const { data: vgvItems = [] } = useQuery({
    queryKey: ["mini-ranking-vgv"],
    queryFn: async () => {
      const { data } = await supabase
        .from("negocios")
        .select("corretor_id, vgv_final")
        .eq("fase", "assinado");
      if (!data) return [];
      const map: Record<string, number> = {};
      data.forEach(n => { if (n.corretor_id) map[n.corretor_id] = (map[n.corretor_id] || 0) + (n.vgv_final || 0); });
      const ids = Object.keys(map);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, nome").in("user_id", ids);
      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.nome || "—"]));
      return ids.map(id => ({ id, nome: nameMap.get(id) || "—", value: map[id] }))
        .sort((a, b) => b.value - a.value);
    },
    staleTime: 60_000,
  });

  // Gestão mini ranking (lead activity score)
  const { data: gestaoItems = [] } = useQuery({
    queryKey: ["mini-ranking-gestao"],
    queryFn: async () => {
      const today = todayBRT();
      const { data } = await supabase
        .from("oferta_ativa_tentativas")
        .select("corretor_id, pontos")
        .gte("created_at", today + "T00:00:00");
      if (!data) return [];
      const map: Record<string, number> = {};
      data.forEach(t => { map[t.corretor_id] = (map[t.corretor_id] || 0) + (t.pontos || 0); });
      const ids = Object.keys(map);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, nome").in("user_id", ids);
      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.nome || "—"]));
      return ids.map(id => ({ id, nome: nameMap.get(id) || "—", value: map[id] }))
        .sort((a, b) => b.value - a.value);
    },
    staleTime: 60_000,
  });

  const fmtVGV = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : `${v}`;
  const vgvFormatted = vgvItems.map(i => ({ ...i, value: i.value }));

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
            <TabsTrigger value="oa" className="text-xs flex-1">📞 OA</TabsTrigger>
            <TabsTrigger value="vgv" className="text-xs flex-1">💰 VGV</TabsTrigger>
            <TabsTrigger value="gestao" className="text-xs flex-1">📋 Gestão</TabsTrigger>
          </TabsList>
          <TabsContent value="oa" className="mt-2">
            <MiniRankList items={oaItems} userId={user?.id} metric="lig" />
          </TabsContent>
          <TabsContent value="vgv" className="mt-2">
            <MiniRankList items={vgvFormatted} userId={user?.id} metric="R$" />
          </TabsContent>
          <TabsContent value="gestao" className="mt-2">
            <MiniRankList items={gestaoItems} userId={user?.id} metric="pts" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
