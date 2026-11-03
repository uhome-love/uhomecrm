import { PageHeader } from "@/components/ui/PageHeader";
import { UsersRound } from "lucide-react";
import UsuariosTable from "@/components/team/UsuariosTable";
import { useUserRole } from "@/hooks/useUserRole";

export default function MeuTime() {
  const { isAdmin, isDiretor } = useUserRole();
  const ehGerente = !isAdmin && !isDiretor;
  return (
    <div className="space-y-4">
      <PageHeader
        title={ehGerente ? "Meu time" : "Usuários"}
        subtitle={ehGerente ? "Corretores da sua equipe" : "Criação, edição, perfis, equipes e transferência de dados do CRM"}
        icon={<UsersRound size={18} strokeWidth={1.5} />}
      />

      <UsuariosTable />
    </div>
  );
}
