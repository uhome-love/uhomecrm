import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarCheck, Clock, MapPin, Phone, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { todayBRT } from "@/lib/utils";

export default function DashboardAgendaPreview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = todayBRT();

  const { data: visitas = [] } = useQuery({
    queryKey: ["dash-visitas-preview", user?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("visitas")
        .select("id, nome_cliente, empreendimento, hora_visita, status, telefone, tipo")
        .eq("corretor_id", user!.id)
        .eq("data_visita", today)
        .in("status", ["marcada", "confirmada", "realizada", "reagendada"])
        .order("hora_visita", { ascending: true })
        .limit(5);
      return data || [];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const visitasImoveis = visitas.filter((v: any) => !v.tipo || v.tipo !== "reuniao_negocio");
  const reunioes = visitas.filter((v: any) => v.tipo === "reuniao_negocio");

  const STATUS_EMOJI: Record<string, string> = {
    marcada: "📅", confirmada: "✅", realizada: "🏠", reagendada: "🔄",
  };

  const renderList = (items: any[], emptyMsg: string) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-4 space-y-1">
          <p className="text-sm text-muted-foreground">😴 {emptyMsg}</p>
        </div>
      );
    }
    return (
      <div className="space-y-1.5">
        {items.slice(0, 4).map((v: any) => (
          <div key={v.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/60">
            <span className="text-sm shrink-0">{STATUS_EMOJI[v.status] || "📅"}</span>
            <span className="text-xs font-bold text-primary shrink-0 w-12">
              {v.hora_visita?.slice(0, 5) || "–"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">{v.nome_cliente}</p>
              {v.empreendimento && (
                <p className="text-[10px] text-muted-foreground truncate flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5" /> {v.empreendimento}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Agenda do Dia</span>
          </div>
          <Badge variant={visitas.length > 0 ? "default" : "secondary"} className="text-xs">
            {visitas.length} hoje
          </Badge>
        </div>

        <Tabs defaultValue="visitas" className="w-full">
          <TabsList className="h-8 w-full">
            <TabsTrigger value="visitas" className="text-xs flex-1">🏠 Visitas</TabsTrigger>
            <TabsTrigger value="reunioes" className="text-xs flex-1">🤝 Reuniões</TabsTrigger>
          </TabsList>
          <TabsContent value="visitas" className="mt-2">
            {renderList(visitasImoveis, "Nenhuma visita hoje")}
          </TabsContent>
          <TabsContent value="reunioes" className="mt-2">
            {renderList(reunioes, "Nenhuma reunião hoje")}
          </TabsContent>
        </Tabs>

        <Button variant="ghost" size="sm" className="w-full text-xs text-primary gap-1" onClick={() => navigate("/agenda-visitas")}>
          Ver agenda completa <ChevronRight className="h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
