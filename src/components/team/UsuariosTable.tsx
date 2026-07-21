import { useEffect, useMemo, useState, useCallback } from "react";
import { Loader2, Search, Pencil, UserX, UserCheck, Trash2, UserPlus, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import UsuarioDrawer, { type UsuarioRow } from "./UsuarioDrawer";
import InativarOuExcluirDialog from "./InativarOuExcluirDialog";
import NovoUsuarioDialog from "./NovoUsuarioDialog";

const ROLE_LABEL: Record<string, string> = {
  admin: "CEO", diretor: "Diretor", gestor: "Gerente",
  corretor: "Corretor", backoffice: "Backoffice", rh: "RH",
};

export default function UsuariosTable() {
  const { isAdmin, isDiretor, userId } = useUserRole();
  const isPrivileged = isAdmin || isDiretor;

  const [rows, setRows] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroRole, setFiltroRole] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<"ativos" | "inativos" | "todos">("ativos");

  const [editing, setEditing] = useState<UsuarioRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"inactivate" | "delete" | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<UsuarioRow | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Profiles
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("user_id, nome, email, telefone, cpf, creci, jetimob_user_id, ativo")
        .order("nome");
      if (profErr) throw profErr;

      // 2) Roles
      const { data: rolesData } = await supabase.from("user_roles").select("user_id, role");
      const roleMap = new Map<string, string>();
      (rolesData || []).forEach((r) => {
        // Prefer stronger role if user has multiple
        const rank: Record<string, number> = { admin: 6, diretor: 5, gestor: 4, backoffice: 3, rh: 2, corretor: 1 };
        const cur = roleMap.get(r.user_id);
        if (!cur || (rank[r.role] || 0) > (rank[cur] || 0)) roleMap.set(r.user_id, r.role);
      });

      // 3) Team relations (gerente)
      const { data: tm } = await supabase.from("team_members").select("user_id, gerente_id, status");
      const gerenteByUser = new Map<string, string>();
      (tm || []).forEach((t: any) => { if (t.user_id && t.gerente_id) gerenteByUser.set(t.user_id, t.gerente_id); });

      const nomeById = new Map<string, string>();
      (profiles || []).forEach((p: any) => nomeById.set(p.user_id, p.nome || ""));

      let list: UsuarioRow[] = (profiles || []).map((p: any) => {
        const gid = gerenteByUser.get(p.user_id) || null;
        return {
          user_id: p.user_id,
          nome: p.nome || "-",
          email: p.email,
          telefone: p.telefone,
          cpf: p.cpf,
          creci: p.creci,
          jetimob_user_id: p.jetimob_user_id,
          role: roleMap.get(p.user_id) || "corretor",
          ativo: !!p.ativo,
          gerente_id: gid,
          gerente_nome: gid ? nomeById.get(gid) || null : null,
        };
      });

      // Scope: gestor não-privileged vê apenas seu time
      if (!isPrivileged && userId) {
        list = list.filter((u) => u.gerente_id === userId || u.user_id === userId);
      }

      setRows(list);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }, [isPrivileged, userId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((u) => {
      if (filtroStatus === "ativos" && !u.ativo) return false;
      if (filtroStatus === "inativos" && u.ativo) return false;
      if (filtroRole !== "todos" && u.role !== filtroRole) return false;
      if (busca.trim()) {
        const q = busca.trim().toLowerCase();
        if (
          !(u.nome || "").toLowerCase().includes(q) &&
          !(u.email || "").toLowerCase().includes(q) &&
          !(u.telefone || "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [rows, busca, filtroRole, filtroStatus]);

  const handleReactivate = async (u: UsuarioRow) => {
    try {
      const { data, error } = await supabase.functions.invoke("create-broker-user", {
        body: { action: "reactivate_user", target_user_id: u.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário reativado.");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao reativar.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, email ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="inativos">Inativos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroRole} onValueChange={setFiltroRole}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os perfis</SelectItem>
            {isPrivileged && <SelectItem value="admin">CEO</SelectItem>}
            {isPrivileged && <SelectItem value="diretor">Diretor</SelectItem>}
            <SelectItem value="gestor">Gerente</SelectItem>
            <SelectItem value="corretor">Corretor</SelectItem>
            {isPrivileged && <SelectItem value="backoffice">Backoffice</SelectItem>}
            {isPrivileged && <SelectItem value="rh">RH</SelectItem>}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={load} title="Recarregar">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button className="gap-2" onClick={() => setNovoOpen(true)}>
          <UserPlus className="h-4 w-4" /> Novo usuário
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Perfil</TableHead>
                {isPrivileged && <TableHead className="hidden lg:table-cell">Gerente</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline text-muted-foreground" />
                </TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell></TableRow>
              ) : filtered.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <div className="font-medium">{u.nome}</div>
                    <div className="text-xs text-muted-foreground md:hidden">{u.email}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{u.email || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{ROLE_LABEL[u.role] || u.role}</Badge>
                  </TableCell>
                  {isPrivileged && (
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {u.gerente_nome || (u.role === "gestor" || u.role === "admin" || u.role === "diretor" ? "-" : "—")}
                    </TableCell>
                  )}
                  <TableCell>
                    {u.ativo ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 border-emerald-500/30">Ativo</Badge>
                    ) : (
                      <Badge variant="destructive">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => { setEditing(u); setDrawerOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {u.ativo ? (
                        <Button variant="ghost" size="icon" title="Inativar"
                          onClick={() => { setConfirmTarget(u); setConfirmMode("inactivate"); }}>
                          <UserX className="h-4 w-4 text-warning" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" title="Reativar" onClick={() => handleReactivate(u)}>
                          <UserCheck className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                      {isPrivileged && (
                        <Button variant="ghost" size="icon" title="Excluir definitivamente"
                          onClick={() => { setConfirmTarget(u); setConfirmMode("delete"); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <UsuarioDrawer user={editing} open={drawerOpen} onOpenChange={setDrawerOpen} onSaved={load} />
      <InativarOuExcluirDialog
        mode={confirmMode || "inactivate"}
        user={confirmTarget}
        open={confirmMode !== null}
        onOpenChange={(o) => { if (!o) { setConfirmMode(null); setConfirmTarget(null); } }}
        onDone={load}
      />
      <NovoUsuarioDialog open={novoOpen} onOpenChange={setNovoOpen} onCreated={load} />
    </div>
  );
}
