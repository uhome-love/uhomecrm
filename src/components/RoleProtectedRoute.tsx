import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
}

export default function RoleProtectedRoute({ children, allowedRoles }: RoleProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: roleLoading, isAdmin, isGestor, isCorretor, isBackoffice } = useUserRole();

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const hasAccess = allowedRoles.some((role) => roles.includes(role));

  if (!hasAccess) {
    if (isAdmin) return <Navigate to="/" replace />;
    if (isBackoffice) return <Navigate to="/backoffice" replace />;
    if (isGestor) return <Navigate to="/central-do-gerente" replace />;
    if (isCorretor) return <Navigate to="/corretor" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
