import { useOAListas, type OALista } from "@/hooks/useOfertaAtiva";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Settings, Play, Pause, StopCircle, Users, Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", color: "bg-muted text-muted-foreground", icon: <Settings className="h-3 w-3" /> },
  liberada: { label: "Liberada", color: "bg-emerald-500/15 text-emerald-600", icon: <Play className="h-3 w-3" /> },
  pausada: { label: "Pausada", color: "bg-amber-500/15 text-amber-600", icon: <Pause className="h-3 w-3" /> },
  encerrada: { label: "Encerrada", color: "bg-red-500/15 text-red-600", icon: <StopCircle className="h-3 w-3" /> },
};

function ListaStats({ listaId }: { listaId: string }) {
  const { data } = useQuery({
    queryKey: ["oa-lista-stats", listaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oferta_ativa_leads")
        .select("status")
        .eq("lista_id", listaId);
      if (error) return { na_fila: 0, aproveitado: 0, descartado: 0, total: 0 };
      const leads = data || [];
      return {
        total: leads.length,
        na_fila: leads.filter(l => l.status === "na_fila").length,
        aproveitado: leads.filter(l => l.status === "aproveitado" || l.status === "concluido").length,
        descartado: leads.filter(l => l.status === "descartado").length,
      };
    },
    staleTime: 30000,
  });

  if (!data) return null;
  return (
    <div className="flex gap-3 text-[11px]">
      <span>📋 {data.total} total</span>
      <span className="text-emerald-600">✅ {data.aproveitado} aprov.</span>
      <span>📞 {data.na_fila} na fila</span>
      <span className="text-muted-foreground">❌ {data.descartado} desc.</span>
    </div>
  );
}

export default function CampaignManager() {
  const { listas, isLoading, updateLista } = useOAListas();
  const { isAdmin } = useUserRole();

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (listas.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Settings className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhuma campanha criada</p>
          <p className="text-sm mt-1">Importe uma lista na aba "Importar" para começar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Campanhas / Listas ({listas.length})</h3>
      </div>

      {listas.map(lista => {
        const st = STATUS_CONFIG[lista.status] || STATUS_CONFIG.pendente;
        return (
          <Card key={lista.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-foreground truncate">{lista.empreendimento}</h4>
                    <Badge variant="outline" className={`text-[10px] h-5 gap-1 ${st.color}`}>
                      {st.icon} {st.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{lista.nome}</p>
                  {lista.campanha && <p className="text-xs text-muted-foreground">Campanha: {lista.campanha}</p>}
                  <div className="mt-2">
                    <ListaStats listaId={lista.id} />
                  </div>
                  <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span>Max tentativas: {lista.max_tentativas}</span>
                    <span>·</span>
                    <span>Cooldown: {lista.cooldown_dias}d</span>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {lista.status !== "liberada" && (
                      <Button size="sm" className="gap-1 text-xs h-7 bg-emerald-600 hover:bg-emerald-700" onClick={() => updateLista(lista.id, { status: "liberada" } as any)}>
                        <Play className="h-3 w-3" /> START
                      </Button>
                    )}
                    {lista.status === "liberada" && (
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-amber-600" onClick={() => updateLista(lista.id, { status: "pausada" } as any)}>
                        <Pause className="h-3 w-3" /> Pausar
                      </Button>
                    )}
                    {lista.status !== "encerrada" && (
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-red-600" onClick={() => updateLista(lista.id, { status: "encerrada" } as any)}>
                        <StopCircle className="h-3 w-3" /> Encerrar
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
