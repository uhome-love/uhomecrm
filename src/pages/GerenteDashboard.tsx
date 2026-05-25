import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { DashboardV4Page } from "@/components/dashboard-v4/DashboardV4Page";

export default function GerenteDashboard() {
  const navigate = useNavigate();
  const { isGestor, isAdmin, loading: roleLoading } = useUserRole();

  useEffect(() => {
    if (roleLoading) return;
    if (!isGestor && !isAdmin) navigate("/corretor", { replace: true });
  }, [isGestor, isAdmin, roleLoading, navigate]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <DashboardV4Page />;
}
