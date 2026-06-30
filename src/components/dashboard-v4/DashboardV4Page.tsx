import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { DashboardHeader } from "@/components/gerente/dashboard-v3/DashboardHeader";
import { EditarMetasModal } from "@/components/gerente/dashboard-v3/EditarMetasModal";
import { useDashboardGerenteV4Kpis } from "@/hooks/useDashboardGerenteV4Kpis";
import { V4KpisGrid } from "./V4KpisGrid";
import { V4QuickActions } from "./V4QuickActions";
import { V4PanelVisitas } from "./V4PanelVisitas";
import { V4PanelNegocios } from "./V4PanelNegocios";
import { V4PanelAlertas } from "./V4PanelAlertas";
import { V4PanelRoleta } from "./V4PanelRoleta";

export function DashboardV4Page() {
  const { user } = useAuth();
  const [metasOpen, setMetasOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile-self", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nome, avatar_url, avatar_gamificado_url")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data, error, isLoading, refetch } = useDashboardGerenteV4Kpis(user?.id);

  const avatarSrc = profile?.avatar_gamificado_url ?? profile?.avatar_url ?? null;
  const kpis = data?.kpis_top;
  const mesKey = new Date().toISOString().slice(0, 7);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-5">
      <DashboardHeader
        nome={profile?.nome ?? "Gerente"}
        avatarUrl={avatarSrc}
        periodo="mes"
        onPeriodoChange={() => { /* sem toggle no v4 */ }}
        onEditarMetas={() => setMetasOpen(true)}
        hidePeriodoToggle
      />

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <p className="text-sm font-medium text-foreground">Não foi possível carregar os KPIs</p>
            <p className="text-xs text-muted-foreground">
              {error.message || "Erro ao buscar os indicadores."}
            </p>
          </div>
        </div>
      )}

      <V4KpisGrid kpis={kpis} isLoading={isLoading} />

      <V4QuickActions />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <V4PanelVisitas gestorId={user?.id} />
        <V4PanelNegocios gestorId={user?.id} />
        <V4PanelAlertas alertas={data?.alertas_corretores ?? []} isLoading={isLoading} />
        <V4PanelRoleta gestorId={user?.id} />
        <V4PanelSemContato />
      </div>

      {user?.id && (
        <EditarMetasModal
          open={metasOpen}
          onOpenChange={setMetasOpen}
          gestorId={user.id}
          mesKey={mesKey}
          initial={{
            meta_vgv_assinado: Number(kpis?.vendas_meta_vgv) || 0,
            meta_leads: kpis?.leads_meta ?? 400,
            meta_visitas_realizadas: kpis?.visitas_meta ?? 0,
            meta_negocios: kpis?.negocios_meta ?? 90,
          }}
          onSaved={() => refetch()}
        />
      )}
    </div>
  );
}
