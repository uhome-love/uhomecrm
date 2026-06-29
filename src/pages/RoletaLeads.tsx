import { useUserRole } from "@/hooks/useUserRole";
import { CentralRoletaCeo } from "@/components/roleta/ceo/CentralRoletaCeo";
import { RoletaCorretorView } from "@/components/roleta/corretor/RoletaCorretorView";

// ─── Main Page ───
export default function RoletaLeads() {
  const { isAdmin } = useUserRole();

  if (isAdmin) {
    return <CentralRoletaCeo />;
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto overflow-x-hidden">
      <RoletaCorretorView />
    </div>
  );
}
