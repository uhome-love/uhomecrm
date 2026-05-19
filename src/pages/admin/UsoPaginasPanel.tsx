import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useUsoPaginasStats,
  useUsoPaginasTable,
  type UsoPeriodo,
  type UsoRole,
} from "@/hooks/useUsoPaginasStats";
import { KpiCardsUso } from "@/components/admin/uso-paginas/KpiCardsUso";
import { TabelaRotas } from "@/components/admin/uso-paginas/TabelaRotas";
import { SidebarUso } from "@/components/admin/uso-paginas/SidebarUso";

export default function UsoPaginasPanel() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [periodo, setPeriodo] = useState<UsoPeriodo>("7d");
  const [role, setRole] = useState<UsoRole>("all");
  const [paused, setPaused] = useState(false);

  const stats = useUsoPaginasStats(periodo, role, paused);
  const table = useUsoPaginasTable(periodo, role, paused);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Uso de Páginas</h1>
          <p className="text-sm text-muted-foreground">
            Rastreamento de page views por usuário, role e rota canônica · retenção 90d
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as UsoPeriodo)}>
            <SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7d</SelectItem>
              <SelectItem value="30d">Últimos 30d</SelectItem>
              <SelectItem value="90d">Últimos 90d</SelectItem>
            </SelectContent>
          </Select>
          <Select value={role} onValueChange={(v) => setRole(v as UsoRole)}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="gestor">Gestor</SelectItem>
              <SelectItem value="corretor">Corretor</SelectItem>
              <SelectItem value="backoffice">Backoffice</SelectItem>
              <SelectItem value="rh">RH</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaused((p) => !p)}
            className="gap-1.5"
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
            {paused ? "Retomar" : "Pausar"}
          </Button>
        </div>
      </div>

      <KpiCardsUso
        stats={stats.data}
        zeroAccessCount={table.data?.zeroAccess.length ?? 0}
        loading={stats.isLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TabelaRotas rows={table.data?.rows} loading={table.isLoading} />
        </div>
        <SidebarUso stats={stats.data} zeroAccess={table.data?.zeroAccess ?? []} />
      </div>
    </div>
  );
}
