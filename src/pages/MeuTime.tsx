import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import TeamManagement from "@/components/checkpoint/TeamManagement";
import CeoTeamPanel from "@/components/ceo/CeoTeamPanel";
import CreateCorretorDialog from "@/components/checkpoint/CreateCorretorDialog";

export default function MeuTime() {
  const { isAdmin, isGestor, loading } = useUserRole();
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (loading) return null;

  const showCreateButton = isGestor && !isAdmin;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {isAdmin ? "Painel da " : "Meu "}
            <span className="text-primary">Equipe</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? "Estrutura completa da Uhome Negócios Imobiliários"
              : "Gerencie os corretores da sua equipe"}
          </p>
        </div>
        {showCreateButton && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" /> Criar Corretor
          </Button>
        )}
      </div>
      {isAdmin ? <CeoTeamPanel /> : <TeamManagement key={refreshKey} />}
      {showCreateButton && (
        <CreateCorretorDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
