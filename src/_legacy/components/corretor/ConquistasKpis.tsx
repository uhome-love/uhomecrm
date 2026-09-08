/**
 * ConquistasKpis — Bloco "Conquistas do mês" (2 KPIs de resultado).
 */
import { Card } from "@/components/ui/card";
import { useCorretorKpisConquistas } from "@/hooks/useCorretorKpisConquistas";
import { logDashboard } from "@/lib/dashboardTelemetry";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, Trophy } from "lucide-react";

export default function ConquistasKpis() {
  const { data, isLoading } = useCorretorKpisConquistas();
  const navigate = useNavigate();
  const visitas = data?.visitasRealizadas ?? 0;
  const vendas = data?.vendas ?? 0;

  const go = (kpi: string, path: string, extra?: Record<string, unknown>) => {
    logDashboard("dashboard_kpi_click", { kpi, ...extra });
    navigate(path);
  };

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conquistas do mês</h2>
      <div className="grid grid-cols-2 gap-2">
        <ConquistaBox
          value={visitas}
          label="Visitas realizadas"
          icon={<CalendarCheck className="h-4 w-4 text-emerald-600" />}
          onClick={() => go("visitas", "/agenda-visitas?status=realizadas", { destination: "agenda", status: "realizadas" })}
          loading={isLoading}
        />
        <ConquistaBox
          value={vendas}
          label="Vendas"
          icon={<Trophy className="h-4 w-4 text-amber-600" />}
          onClick={() => go("vendas", "/vendas-realizadas")}
          loading={isLoading}
        />
      </div>
    </section>
  );
}

function ConquistaBox({ value, label, icon, onClick, loading }: { value: number; label: string; icon: React.ReactNode; onClick: () => void; loading?: boolean }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <div className="p-4 flex items-center gap-3">
        <div className="shrink-0">{icon}</div>
        <div className="min-w-0">
          <div className="text-2xl sm:text-3xl font-black text-foreground leading-none">{loading ? "—" : value}</div>
          <div className="text-xs font-medium text-muted-foreground mt-1.5 truncate">{label}</div>
        </div>
      </div>
    </Card>
  );
}
