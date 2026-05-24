/**
 * CaminhosCards — Bloco "O que fazer agora" (6 cards de ação).
 * Desktop: grid 3x2. Mobile: grid 2x3. Modo Foco destacado dark gradient.
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Target, LayoutGrid, CalendarDays, ListChecks, Phone, Trophy } from "lucide-react";
import { logDashboard } from "@/lib/dashboardTelemetry";
import { useCorretorKpisCarteira } from "@/hooks/useCorretorKpisCarteira";
import { useCorretorKpisConquistas } from "@/hooks/useCorretorKpisConquistas";
import { useTarefasHoje } from "@/hooks/useTarefasHoje";
import FocusModeModal from "@/components/pipeline/FocusModeModal";

export default function CaminhosCards() {
  const navigate = useNavigate();
  const [focusOpen, setFocusOpen] = useState(false);
  const { data: carteira } = useCorretorKpisCarteira();
  const { data: conquistas } = useCorretorKpisConquistas();
  const { data: tarefas } = useTarefasHoje();

  const priorit = (carteira?.atrasado ?? 0) + (carteira?.para_hoje ?? 0);
  const totalLeads = carteira?.total ?? 0;
  const visitas7d = conquistas?.visitasProximas7d ?? 0;
  const tarefasCount = tarefas?.length ?? 0;
  const vendasMes = conquistas?.vendas ?? 0;

  const click = (action: string, fn: () => void) => {
    logDashboard("dashboard_action_click", { action });
    fn();
  };

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">O que fazer agora</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <ActionCard
          highlight
          icon={<Target className="h-5 w-5" />}
          title="Modo Foco"
          subtitle={`${priorit} prioritário${priorit === 1 ? "" : "s"}`}
          onClick={() => click("modo_foco", () => setFocusOpen(true))}
        />
        <ActionCard
          icon={<LayoutGrid className="h-5 w-5 text-indigo-600" />}
          title="Pipeline"
          subtitle={`${totalLeads} lead${totalLeads === 1 ? "" : "s"}`}
          onClick={() => click("pipeline", () => navigate("/pipeline-leads"))}
        />
        <ActionCard
          icon={<CalendarDays className="h-5 w-5 text-emerald-600" />}
          title="Agenda"
          subtitle={`${visitas7d} visita${visitas7d === 1 ? "" : "s"}`}
          onClick={() => click("agenda", () => navigate("/agenda-visitas"))}
        />
        <ActionCard
          icon={<ListChecks className="h-5 w-5 text-blue-600" />}
          title="Tarefas"
          subtitle={`${tarefasCount} hoje`}
          onClick={() => click("tarefas", () => navigate("/minhas-tarefas"))}
        />
        <ActionCard
          icon={<Phone className="h-5 w-5 text-rose-600" />}
          title="Oferta Ativa"
          subtitle="Ligar agora"
          onClick={() => click("oferta_ativa", () => navigate("/corretor/call"))}
        />
        <ActionCard
          icon={<Trophy className="h-5 w-5 text-amber-600" />}
          title="Vendas"
          subtitle={`${vendasMes} venda${vendasMes === 1 ? "" : "s"}`}
          onClick={() => click("vendas", () => navigate("/vendas-realizadas"))}
        />
      </div>

      <FocusModeModal
        open={focusOpen}
        onClose={() => setFocusOpen(false)}
        pipelineTipo="leads"
        initialCriteria={["all"]}
      />
    </section>
  );
}

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  highlight?: boolean;
}

function ActionCard({ icon, title, subtitle, onClick, highlight }: ActionCardProps) {
  if (highlight) {
    return (
      <Card
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
        className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary border-0"
        style={{ background: "linear-gradient(180deg, #1e1b4b, #0f0f23)", color: "white" }}
      >
        <div className="p-4 flex flex-col gap-2">
          <div className="text-white">{icon}</div>
          <div className="text-sm font-bold text-white">{title}</div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>{subtitle}</div>
        </div>
      </Card>
    );
  }
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <div className="p-4 flex flex-col gap-2">
        <div>{icon}</div>
        <div className="text-sm font-bold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </Card>
  );
}
