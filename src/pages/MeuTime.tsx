import { useUserRole } from "@/hooks/useUserRole";
import TeamManagement from "@/components/checkpoint/TeamManagement";
import CeoTeamPanel from "@/components/ceo/CeoTeamPanel";

export default function MeuTime() {
  const { isAdmin, loading } = useUserRole();

  if (loading) return null;

  return (
    <div className="space-y-4">
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
      {isAdmin ? <CeoTeamPanel /> : <TeamManagement />}
    </div>
  );
}
