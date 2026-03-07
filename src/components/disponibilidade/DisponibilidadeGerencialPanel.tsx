import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Coffee, MapPin, WifiOff, Loader2, Users, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDisponibilidadeGerencial, type Disponibilidade, type DisponibilidadeStatus } from "@/hooks/useCorretorDisponibilidade";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_ICON: Record<DisponibilidadeStatus, { icon: React.ElementType; color: string; label: string }> = {
  offline: { icon: WifiOff, color: "text-muted-foreground", label: "Offline" },
  na_empresa: { icon: Building2, color: "text-emerald-600", label: "Na empresa" },
  em_pausa: { icon: Coffee, color: "text-amber-600", label: "Em pausa" },
  em_visita: { icon: MapPin, color: "text-blue-600", label: "Em visita" },
};

interface CorretorRow extends Disponibilidade {
  nome?: string;
}

export default function DisponibilidadeGerencialPanel() {
  const { corretores, loading } = useDisponibilidadeGerencial();
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  // Fetch profiles for all corretors
  useEffect(() => {
    if (corretores.length === 0) return;
    const userIds = corretores.map((c) => c.user_id);
    supabase
      .from("profiles")
      .select("user_id, nome")
      .in("user_id", userIds)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((p) => (map[p.user_id] = p.nome));
          setProfiles(map);
        }
      });
  }, [corretores]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("disponibilidade-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "corretor_disponibilidade" }, () => {
        // Query client handles refetch via staleTime
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const naRoleta = corretores.filter((c) => c.na_roleta);
  const naEmpresa = corretores.filter((c) => c.status === "na_empresa");

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Disponibilidade da Equipe
        </CardTitle>
        <div className="flex gap-3 mt-2">
          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-xs">
            <RotateCw className="h-3 w-3 mr-1" />
            {naRoleta.length} na roleta
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {naEmpresa.length} na empresa
          </Badge>
          <Badge variant="outline" className="text-xs">
            {corretores.length} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {corretores.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum corretor configurou a disponibilidade ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {corretores.map((c) => {
              const nome = profiles[c.user_id] || "Corretor";
              const st = STATUS_ICON[c.status as DisponibilidadeStatus] || STATUS_ICON.offline;
              const StIcon = st.icon;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    c.na_roleta
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    c.na_roleta ? "bg-emerald-500/15" : "bg-muted"
                  }`}>
                    <StIcon className={`h-4 w-4 ${st.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{nome}</p>
                      {c.na_roleta && (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-[9px] px-1.5">
                          ROLETA
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-medium ${st.color}`}>{st.label}</span>
                      {c.segmentos && c.segmentos.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          · {(c.segmentos as string[]).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {c.entrada_em && (
                      <p className="text-[10px] text-muted-foreground">
                        Entrada: {format(new Date(c.entrada_em), "HH:mm", { locale: ptBR })}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {c.leads_recebidos_turno} leads
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
