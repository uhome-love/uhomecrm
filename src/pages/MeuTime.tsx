import { useState } from "react";
import { Users, Table as TableIcon } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TeamManagement from "@/components/checkpoint/TeamManagement";
import CeoTeamPanel from "@/components/ceo/CeoTeamPanel";
import UsuariosTable from "@/components/team/UsuariosTable";

export default function MeuTime() {
  const { isAdmin, isDiretor, isGestor, loading } = useUserRole();
  const [tab, setTab] = useState<"visao" | "usuarios">("visao");

  if (loading) return null;
  const isPrivileged = isAdmin || isDiretor;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {isPrivileged ? "Central de " : "Meu "}
          <span className="text-primary">{isPrivileged ? "Usuários" : "Equipe"}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isPrivileged
            ? "Gerencie todos os usuários do CRM — criação, edição, inativação e exclusão."
            : "Gerencie os corretores da sua equipe"}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="visao" className="gap-2">
            <Users className="h-4 w-4" /> Visão de Times
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-2">
            <TableIcon className="h-4 w-4" /> {isPrivileged ? "Todos os Usuários" : "Meu Time"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="m-0">
          {isPrivileged ? <CeoTeamPanel /> : (isGestor ? <TeamManagement /> : null)}
        </TabsContent>

        <TabsContent value="usuarios" className="m-0">
          <UsuariosTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
