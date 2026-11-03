import { PageHeader } from "@/components/ui/PageHeader";
import { UsersRound } from "lucide-react";
import UsuariosTable from "@/components/team/UsuariosTable";

export default function MeuTime() {
  return (
    <div className="space-y-4">
      <PageHeader title="Usuários" subtitle="Criação, edição, perfis, equipes e transferência de dados do CRM" icon={<UsersRound size={18} strokeWidth={1.5} />} />

      <UsuariosTable />
    </div>
  );
}
