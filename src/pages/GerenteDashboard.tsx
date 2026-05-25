import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Users, TrendingUp, CalendarCheck, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";

import { useDashboardGerenteV3, type PeriodoV3, type CorretorRowV3 } from "@/hooks/useDashboardGerenteV3";
import { DashboardHeader } from "@/components/gerente/dashboard-v3/DashboardHeader";
import { HeadlineVendasCard } from "@/components/gerente/dashboard-v3/HeadlineVendasCard";
import { SecondaryMetricCard } from "@/components/gerente/dashboard-v3/SecondaryMetricCard";
import { TeamPerformanceTable } from "@/components/gerente/dashboard-v3/TeamPerformanceTable";
import { EditarMetasModal } from "@/components/gerente/dashboard-v3/EditarMetasModal";

const STORAGE_KEY = "uhome:dashboard-gerente:periodo";

function loadPeriodo(): PeriodoV3 {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    if (v === "hoje" || v === "semana" || v === "mes") return v;
  } catch {}
  return "mes";
}

function periodoLabel(p: PeriodoV3) {
  return p === "hoje" ? "Hoje" : p === "semana" ? "Esta semana" : "Este mês";
}

export default function GerenteDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isGestor, isAdmin, loading: roleLoading } = useUserRole();

  const [periodo, setPeriodo] = useState<PeriodoV3>(() => loadPeriodo());
  const [metasOpen, setMetasOpen] = useState(false);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, periodo); } catch {}
  }, [periodo]);

  useEffect(() => {
    if (roleLoading) return;
    if (!isGestor && !isAdmin) navigate("/corretor", { replace: true });
  }, [isGestor, isAdmin, roleLoading, navigate]);

  // Perfil do gerente (nome + avatar para o header)
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

  const { data, isLoading, refetch } = useDashboardGerenteV3(user?.id, periodo);

  if (roleLoading || (!data && isLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const kpis = data?.kpis_top;
  const corretores: CorretorRowV3[] = data?.corretores ?? [];
  const mesKey = data?.mes_key ?? new Date().toISOString().slice(0, 7);

  const avatarSrc = profile?.avatar_gamificado_url ?? profile?.avatar_url ?? null;

  function handleRowClick(row: CorretorRowV3) {
    navigate("/pipeline", { state: { corretorFilter: row.user_id } });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-5">
      <DashboardHeader
        nome={profile?.nome ?? "Gerente"}
        avatarUrl={avatarSrc}
        periodo={periodo}
        onPeriodoChange={setPeriodo}
        onEditarMetas={() => setMetasOpen(true)}
      />

      {corretores.length === 0 && (
        <div className="rounded-xl border border-border bg-muted/30 p-5 flex items-center gap-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Nenhum corretor ativo no time</p>
            <p className="text-xs text-muted-foreground">
              Quando seus corretores forem adicionados, os KPIs aparecerão aqui.
            </p>
          </div>
        </div>
      )}

      {kpis && (
        <>
          {/* Headline + 3 secundários — grid responsivo */}
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <HeadlineVendasCard
                vendas={Number(kpis.vendas) || 0}
                meta={Number(kpis.meta_vendas) || 0}
                vendasQtd={kpis.vendas_qtd}
                delta={kpis.delta_vendas}
                periodoLabel={periodoLabel(periodo)}
              />
            </div>
            <SecondaryMetricCard
              label="Leads recebidos"
              value={kpis.leads}
              meta={kpis.meta_leads}
              delta={kpis.delta_leads}
              icon={TrendingUp}
              tone="primary"
            />
            <SecondaryMetricCard
              label="Visitas realizadas"
              value={kpis.visitas}
              meta={kpis.meta_visitas}
              delta={kpis.delta_visitas}
              icon={CalendarCheck}
              tone="warning"
            />
          </div>

          {/* Negócios ativos — linha cheia compacta */}
          <div className="grid gap-4 lg:grid-cols-4">
            <SecondaryMetricCard
              label="Negócios ativos no funil"
              value={kpis.negocios}
              meta={kpis.meta_negocios}
              delta={null}
              icon={Briefcase}
              tone="success"
              hideProgress={false}
            />
            <div className="lg:col-span-3 rounded-2xl border border-border bg-card/50 p-5 flex items-center text-sm text-muted-foreground">
              Clique em um corretor abaixo para abrir o Pipeline filtrado pela carteira dele.
            </div>
          </div>

          {/* Tabela do time */}
          <TeamPerformanceTable rows={corretores} onRowClick={handleRowClick} />
        </>
      )}

      {user?.id && (
        <EditarMetasModal
          open={metasOpen}
          onOpenChange={setMetasOpen}
          gestorId={user.id}
          mesKey={mesKey}
          initial={{
            meta_vgv_assinado: kpis?.meta_vendas ?? 0,
            meta_leads: kpis?.meta_leads ?? 400,
            meta_visitas_realizadas: kpis?.meta_visitas ?? 0,
            meta_negocios: kpis?.meta_negocios ?? 90,
          }}
          onSaved={() => refetch()}
        />
      )}
    </div>
  );
}
