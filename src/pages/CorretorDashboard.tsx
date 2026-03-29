import { StatusElegibilidadeRoleta } from "@/components/roleta/StatusElegibilidadeRoleta";
import { OportunidadesDoDia } from "@/components/corretor/OportunidadesDoDia";

export default function CorretorDashboard() {
  return (
    <div className="space-y-4">
      <StatusElegibilidadeRoleta />
      <OportunidadesDoDia />
    </div>
  );
}
