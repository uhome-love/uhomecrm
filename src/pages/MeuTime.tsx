import { useUserRole } from "@/hooks/useUserRole";
import UsuariosTable from "@/components/team/UsuariosTable";

export default function MeuTime() {
  const { isAdmin, isDiretor, loading } = useUserRole();

  if (loading) return null;
  const isPrivileged = isAdmin || isDiretor;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {isPrivileged ? "Central de " : "Minha "}
          <span className="text-primary">{isPrivileged ? "Usuários" : "Equipe"}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isPrivileged
            ? "Crie, edite, altere perfis, mova entre equipes, inative ou exclua usuários com transferência de dados."
            : "Gerencie os corretores da sua equipe — criação, edição e transferência de dados."}
        </p>
      </div>

      <UsuariosTable />
    </div>
  );
}
