import { useMemo, useState } from "react";
import { Loader2, Search, Pencil, UserX, UserCheck, Trash2, UserPlus, RefreshCw, Users as UsersIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { formatBRT } from "@/lib/brtTime";
import { useUsuariosCentral, type UsuarioCentralRow } from "@/hooks/useUsuariosCentral";
import UsuarioDrawer from "./UsuarioDrawer";
import InativarOuExcluirDialog from "./InativarOuExcluirDialog";
import NovoUsuarioWizard from "./NovoUsuarioWizard";
import { ROLE_META, type ProfileRole } from "./UserProfilePicker";

const ROLE_LABEL: Record<string, string> = {
  admin: "CEO", diretor: "Diretor", gestor: "Gerente",
  corretor: "Corretor", backoffice: "Backoffice", rh: "RH",
};

export default function UsuariosTable() {
  const { isAdmin, isDiretor } = useUserRole();
  const isPrivileged = isAdmin || isDiretor;
  const { rows, loading, reload } = useUsuariosCentral();

  const [busca, setBusca] = useState("");
  const [filtroRole, setFiltroRole] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<"ativos" | "inativos" | "todos">("ativos");

  const [editing, setEditing] = useState<UsuarioCentralRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"inactivate" | "delete" | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<UsuarioCentralRow | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);

  const stats = useMemo(() => {
    const s = { total: rows.length, ativos: 0, inativos: 0, gestores: 0, corretores: 0, outros: 0 };
    rows.forEach((u) => {
      if (u.ativo) s.ativos++; else s.inativos++;
      if (u.role === "gestor") s.gestores++;
      else if (u.role === "corretor") s.corretores++;
      else s.outros++;
    });
    return s;
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((u) => {
      if (filtroStatus === "ativos" && !u.ativo) return false;
      if (filtroStatus === "inativos" && u.ativo) return false;
      if (filtroRole !== "todos") {
        if (filtroRole === "adminstaff") { if (!["admin", "diretor", "backoffice", "rh"].includes(u.role)) return false; }
        else if (u.role !== filtroRole) return false;
      }
      if (busca.trim()) {
        const q = busca.trim().toLowerCase();
        if (![u.nome, u.email, u.telefone].some((v) => (v || "").toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [rows, busca, filtroRole, filtroStatus]);

  const handleReactivate = async (u: UsuarioCentralRow) => {
    try {
      const { data, error } = await supabase.functions.invoke("create-broker-user", {
        body: { action: "reactivate_user", target_user_id: u.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário reativado.");
      reload();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao reativar.");
    }
  };

  const openInactivate = (u: UsuarioCentralRow) => { setConfirmTarget(u); setConfirmMode("inactivate"); };
  const openDelete = (u: UsuarioCentralRow) => { setConfirmTarget(u); setConfirmMode("delete"); };

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Ativos" value={stats.ativos} tone="emerald" />
        <StatCard label="Inativos" value={stats.inativos} tone="slate" />
        <StatCard label="Gerentes" value={stats.gestores} tone="blue" />
        <StatCard label="Corretores" value={stats.corretores} tone="indigo" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, email ou telefone..."
            value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="inativos">Inativos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={reload} title="Recarregar">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button className="gap-2" onClick={() => setNovoOpen(true)}>
          <UserPlus className="h-4 w-4" /> Novo usuário
        </Button>
      </div>

      {/* Role tabs */}
      <Tabs value={filtroRole} onValueChange={setFiltroRole}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="corretor">Corretores</TabsTrigger>
          <TabsTrigger value="gestor">Gerentes</TabsTrigger>
          {isPrivileged && <TabsTrigger value="adminstaff">Admin / BO / RH</TabsTrigger>}
        </TabsList>
      </Tabs>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead className="hidden md:table-cell">Perfil</TableHead>
                {isPrivileged && <TableHead className="hidden lg:table-cell">Equipe</TableHead>}
                <TableHead className="hidden xl:table-cell">Último acesso</TableHead>
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
              ) : filtered.map((u) => {
                const meta = ROLE_META[u.role as ProfileRole] || ROLE_META.corretor;
                return (
                  <TableRow
                    key={u.user_id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => { setEditing(u); setDrawerOpen(true); }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                          {(u.nome || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{u.nome}</div>
                          <div className="text-xs text-muted-foreground truncate">{u.email || "—"}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={`text-xs ${meta.color}`}>{ROLE_LABEL[u.role]}</Badge>
                    </TableCell>
                    {isPrivileged && (
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {u.gerente_nome || (["gestor", "admin", "diretor"].includes(u.role) ? "—" : "não vinculado")}
                      </TableCell>
                    )}
                    <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                      {u.last_sign_in ? formatBRT(u.last_sign_in, "dd/MM/yyyy HH:mm") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${u.ativo ? "bg-emerald-500" : "bg-red-500"}`} />
                        <span className="text-xs">{u.ativo ? "Ativo" : "Inativo"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Editar" onClick={() => { setEditing(u); setDrawerOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {u.ativo ? (
                          <Button variant="ghost" size="icon" title="Inativar" onClick={() => openInactivate(u)}>
                            <UserX className="h-4 w-4 text-warning" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" title="Reativar" onClick={() => handleReactivate(u)}>
                            <UserCheck className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        {isPrivileged && (
                          <Button variant="ghost" size="icon" title="Excluir definitivamente" onClick={() => openDelete(u)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <UsuarioDrawer
        user={editing}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSaved={reload}
        onRequestInactivate={(u) => { setDrawerOpen(false); openInactivate(u); }}
        onRequestReactivate={(u) => { setDrawerOpen(false); handleReactivate(u); }}
      />
      <InativarOuExcluirDialog
        mode={confirmMode || "inactivate"}
        user={confirmTarget}
        open={confirmMode !== null}
        onOpenChange={(o) => { if (!o) { setConfirmMode(null); setConfirmTarget(null); } }}
        onDone={reload}
      />
      <NovoUsuarioWizard open={novoOpen} onOpenChange={setNovoOpen} onCreated={reload} />
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "emerald" | "slate" | "blue" | "indigo" }) {
  const toneClass = {
    emerald: "text-emerald-600 bg-emerald-500/5 border-emerald-500/20",
    slate: "text-slate-600 bg-slate-500/5 border-slate-500/20",
    blue: "text-blue-600 bg-blue-500/5 border-blue-500/20",
    indigo: "text-indigo-600 bg-indigo-500/5 border-indigo-500/20",
  }[tone];
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-2xl font-semibold mt-0.5">{value}</div>
    </div>
  );
}
