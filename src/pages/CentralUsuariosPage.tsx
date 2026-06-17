import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Loader2, Search, Users, CreditCard, Mail, BadgeCheck, Phone, Pencil, Save,
  Trash2, UsersRound, UserPlus, MoreVertical, KeyRound, UserX, UserCheck, ShieldAlert, Wrench,
} from "lucide-react";

const AdminPanel = lazy(() => import("@/pages/AdminPanel"));

type ManagedUser = {
  user_id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  creci: string | null;
  jetimob_user_id: string | null;
  role: string;
  equipe: string | null;
  gerente_id: string | null;
  gerente_nome: string | null;
  ativo: boolean | null;
  status: string | null;
};

const roleLabel = (r: string) =>
  ({ admin: "CEO / Admin", gestor: "Gerente", corretor: "Corretor", backoffice: "Backoffice", rh: "RH" } as Record<string, string>)[r] || r;

const roleColor = (r: string) =>
  ({
    admin: "bg-destructive/10 text-destructive border-destructive/20",
    gestor: "bg-primary/10 text-primary border-primary/20",
    corretor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    backoffice: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    rh: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  } as Record<string, string>)[r] || "bg-muted text-muted-foreground";

export default function CentralUsuariosPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [passwordFor, setPasswordFor] = useState<ManagedUser | null>(null);
  const [reassignFor, setReassignFor] = useState<{ user: ManagedUser; mode: "inactivate" | "delete" } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["central-usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_manageable_users");
      if (error) throw error;
      return (data || []) as ManagedUser[];
    },
    enabled: !!user,
  });

  const teams = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => { if (u.equipe) set.add(u.equipe); });
    return Array.from(set).sort();
  }, [users]);

  const showTeamFilter = teams.length > 1;

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (teamFilter !== "all" && u.equipe !== teamFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        u.nome?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.cpf?.toLowerCase().includes(q) ||
        u.creci?.toLowerCase().includes(q) ||
        roleLabel(u.role).toLowerCase().includes(q)
      );
    });
  }, [users, search, teamFilter]);

  // Active corretores available as reassignment destinations (same scope returned by RPC)
  const corretorDestinos = useMemo(
    () => users.filter((u) => u.role === "corretor" && u.ativo !== false),
    [users]
  );

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["central-usuarios"] });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Central de Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie, edite, inative e exclua usuários do CRM. Ao remover um corretor, escolha para quem repassar os dados.
          </p>
        </div>
      </div>

      <UsuariosTabsWrapper isAdmin={isAdmin}>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" /> Adicionar usuário
        </Button>
        <div className="relative max-w-md flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, CPF, CRECI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {showTeamFilter && (
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Equipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as equipes</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((u) => {
          const inactive = u.ativo === false || u.status === "inativo";
          return (
            <Card key={u.user_id} className={`relative overflow-hidden ${inactive ? "opacity-70" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-semibold truncate">{u.nome || "Sem nome"}</CardTitle>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${roleColor(u.role)}`}>
                        {roleLabel(u.role)}
                      </Badge>
                      {inactive && (
                        <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                          Inativo
                        </Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => setEditing(u)} className="gap-2 text-xs">
                        <Pencil className="h-3.5 w-3.5" /> Editar dados
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPasswordFor(u)} className="gap-2 text-xs">
                        <KeyRound className="h-3.5 w-3.5" /> Trocar senha
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {inactive ? (
                        <DropdownMenuItem
                          onClick={async () => {
                            setBusy(true);
                            try {
                              const { data, error } = await supabase.functions.invoke("create-broker-user", {
                                body: { action: "reactivate_user", target_user_id: u.user_id },
                              });
                              if (error) throw error;
                              if (data?.error) throw new Error(data.error);
                              toast.success(data?.message || "Usuário reativado!");
                              refresh();
                            } catch (e: any) {
                              toast.error(e?.message || "Erro ao reativar.");
                            } finally { setBusy(false); }
                          }}
                          className="gap-2 text-xs"
                        >
                          <UserCheck className="h-3.5 w-3.5" /> Reativar
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => setReassignFor({ user: u, mode: "inactivate" })} className="gap-2 text-xs">
                          <UserX className="h-3.5 w-3.5" /> Inativar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setReassignFor({ user: u, mode: "delete" })}
                        className="gap-2 text-xs text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row icon={<Mail className="h-3.5 w-3.5" />} value={u.email} empty="Email não cadastrado" />
                <Row icon={<Phone className="h-3.5 w-3.5" />} value={u.telefone} empty="Telefone não cadastrado" />
                <Row icon={<CreditCard className="h-3.5 w-3.5" />} value={u.cpf} empty="CPF não cadastrado" />
                <Row icon={<BadgeCheck className="h-3.5 w-3.5" />} value={u.creci} empty="CRECI não cadastrado" />
                <div className="flex items-center gap-2 pt-1 border-t border-border/50 mt-2">
                  <UsersRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {u.equipe || u.gerente_nome ? (
                    <span className="text-foreground text-xs">
                      {u.equipe && <span className="font-medium">{u.equipe}</span>}
                      {u.equipe && u.gerente_nome && <span className="text-muted-foreground"> · </span>}
                      {u.gerente_nome && <span className="text-muted-foreground">Gerente: {u.gerente_nome}</span>}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic text-xs">Sem equipe vinculada</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">Nenhum usuário encontrado.</div>
      )}

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} isAdmin={isAdmin} onDone={refresh} />

      <EditUserDialog editing={editing} onClose={() => setEditing(null)} onDone={refresh} />

      <PasswordDialog target={passwordFor} onClose={() => setPasswordFor(null)} />

      <ReassignDialog
        data={reassignFor}
        destinos={corretorDestinos}
        onClose={() => setReassignFor(null)}
        onDone={refresh}
        busy={busy}
        setBusy={setBusy}
      />
    </div>
  );
}

function Row({ icon, value, empty }: { icon: React.ReactNode; value: string | null; empty: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className={value ? "text-foreground truncate" : "text-muted-foreground italic"}>{value || empty}</span>
    </div>
  );
}

// ─── CREATE ──────────────────────────────────────────────────────────────────
function CreateUserDialog({
  open, onOpenChange, isAdmin, onDone,
}: { open: boolean; onOpenChange: (o: boolean) => void; isAdmin: boolean; onDone: () => void }) {
  const [form, setForm] = useState({ nome: "", email: "", senha: "", telefone: "", cpf: "", creci: "", jetimob: "" });
  const [role, setRole] = useState<"corretor" | "gestor" | "backoffice" | "rh">("corretor");
  const [gerente, setGerente] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: gestores = [] } = useQuery({
    queryKey: ["central-gestores"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["gestor", "admin"]);
      const ids = (roles || []).map((r) => r.user_id);
      if (ids.length === 0) return [] as { user_id: string; nome: string }[];
      const { data: profiles } = await supabase.from("profiles").select("user_id, nome").in("user_id", ids);
      return (profiles || []).map((p) => ({ user_id: p.user_id, nome: p.nome || p.user_id }));
    },
    enabled: open && isAdmin,
  });

  function reset() {
    setForm({ nome: "", email: "", senha: "", telefone: "", cpf: "", creci: "", jetimob: "" });
    setRole("corretor"); setGerente("");
  }

  async function handleCreate() {
    if (!form.nome.trim() || !form.email.trim() || !form.senha.trim()) {
      toast.error("Preencha nome, email e senha."); return;
    }
    if (form.senha.length < 6) { toast.error("A senha deve ter no mínimo 6 caracteres."); return; }
    if (isAdmin && role === "corretor" && !gerente) {
      toast.error("Selecione o gerente da equipe."); return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-broker-user", {
        body: {
          action: "create_user",
          nome: form.nome.trim(),
          email: form.email.trim(),
          senha: form.senha,
          telefone: form.telefone.trim() || null,
          cpf: form.cpf.trim() || null,
          creci: form.creci.trim() || null,
          jetimob_user_id: form.jetimob.trim() || null,
          role: isAdmin ? role : "corretor",
          gerente_id: isAdmin && role === "corretor" ? gerente : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || "Usuário criado!");
      reset();
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar usuário.");
    } finally { setCreating(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Adicionar usuário
          </DialogTitle>
          <DialogDescription>Crie um novo usuário do CRM com seus dados de cadastro.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1 max-h-[60vh] overflow-y-auto pr-1">
          <Field label="Nome completo *"><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: João Silva" /></Field>
          <Field label="Email *"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="joao@email.com" /></Field>
          <Field label="Senha *"><Input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} placeholder="Mínimo 6 caracteres" /></Field>
          <Field label="Telefone"><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" /></Field>
          <Field label="CPF"><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" /></Field>
          <Field label="CRECI"><Input value={form.creci} onChange={(e) => setForm({ ...form, creci: e.target.value })} placeholder="CRECI/RS 00000" /></Field>
          <Field label="ID Jetimob (opcional)"><Input value={form.jetimob} onChange={(e) => setForm({ ...form, jetimob: e.target.value })} placeholder="Ex: 12345" /></Field>

          {isAdmin && (
            <Field label="Papel">
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corretor">Corretor</SelectItem>
                  <SelectItem value="gestor">Gerente</SelectItem>
                  <SelectItem value="backoffice">Backoffice</SelectItem>
                  <SelectItem value="rh">RH</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          {isAdmin && role === "corretor" && (
            <Field label="Gerente da equipe *">
              <Select value={gerente} onValueChange={setGerente}>
                <SelectTrigger><SelectValue placeholder="Selecione o gerente" /></SelectTrigger>
                <SelectContent>
                  {gestores.map((g) => <SelectItem key={g.user_id} value={g.user_id}>{g.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={creating} className="gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── EDIT ────────────────────────────────────────────────────────────────────
function EditUserDialog({
  editing, onClose, onDone,
}: { editing: ManagedUser | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", cpf: "", creci: "", jetimob: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        nome: editing.nome || "", email: editing.email || "", telefone: editing.telefone || "",
        cpf: editing.cpf || "", creci: editing.creci || "", jetimob: editing.jetimob_user_id || "",
      });
    }
  }, [editing]);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-broker-user", {
        body: {
          action: "update_user",
          target_user_id: editing.user_id,
          nome: form.nome.trim(),
          email: form.email.trim(),
          telefone: form.telefone.trim() || null,
          cpf: form.cpf.trim() || null,
          creci: form.creci.trim() || null,
          jetimob_user_id: form.jetimob.trim() || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Cadastro atualizado!");
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar.");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar dados</DialogTitle>
          <DialogDescription>{editing?.nome || editing?.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Nome"><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
          <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Telefone"><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" /></Field>
          <Field label="CPF"><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" /></Field>
          <Field label="CRECI"><Input value={form.creci} onChange={(e) => setForm({ ...form, creci: e.target.value })} placeholder="CRECI/RS 00000" /></Field>
          <Field label="ID Jetimob"><Input value={form.jetimob} onChange={(e) => setForm({ ...form, jetimob: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── PASSWORD ────────────────────────────────────────────────────────────────
function PasswordDialog({ target, onClose }: { target: ManagedUser | null; onClose: () => void }) {
  const [senha, setSenha] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (target) setSenha(""); }, [target]);

  async function handleSave() {
    if (!target) return;
    if (senha.length < 6) { toast.error("A senha deve ter no mínimo 6 caracteres."); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-broker-user", {
        body: { action: "update_user", target_user_id: target.user_id, senha },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Senha redefinida com sucesso!");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao redefinir senha.");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Trocar senha</DialogTitle>
          <DialogDescription>{target?.nome || target?.email}</DialogDescription>
        </DialogHeader>
        <Field label="Nova senha">
          <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── REASSIGN (inactivate / delete) ──────────────────────────────────────────
function ReassignDialog({
  data, destinos, onClose, onDone, busy, setBusy,
}: {
  data: { user: ManagedUser; mode: "inactivate" | "delete" } | null;
  destinos: ManagedUser[];
  onClose: () => void;
  onDone: () => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
}) {
  const [destino, setDestino] = useState("");
  const [opts, setOpts] = useState({ leads: true, negocios: true, tarefas: true });

  useEffect(() => { if (data) { setDestino(""); setOpts({ leads: true, negocios: true, tarefas: true }); } }, [data]);

  const isDelete = data?.mode === "delete";
  const availableDestinos = useMemo(
    () => destinos.filter((d) => d.user_id !== data?.user.user_id),
    [destinos, data]
  );

  async function handleConfirm() {
    if (!data) return;
    // Delete always requires a destination; inactivate too (we reassign on the spot)
    if (!destino) { toast.error("Selecione o corretor que receberá os dados."); return; }
    setBusy(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("create-broker-user", {
        body: {
          action: isDelete ? "delete_user" : "inactivate_user",
          target_user_id: data.user.user_id,
          reassign_to: destino,
          reassign_leads: opts.leads,
          reassign_negocios: opts.negocios,
          reassign_tarefas: opts.tarefas,
        },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      toast.success(res?.message || "Concluído!");
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao processar.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDelete ? <Trash2 className="h-5 w-5 text-destructive" /> : <UserX className="h-5 w-5 text-amber-500" />}
            {isDelete ? "Excluir usuário" : "Inativar usuário"}
          </DialogTitle>
          <DialogDescription>
            {isDelete
              ? <>O usuário <strong>{data?.user.nome || data?.user.email}</strong> será removido permanentemente. Antes disso, escolha para quem repassar os dados.</>
              : <>O usuário <strong>{data?.user.nome || data?.user.email}</strong> será bloqueado e os dados repassados imediatamente.</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Repassar dados para o corretor *">
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger><SelectValue placeholder="Selecione o corretor destino" /></SelectTrigger>
              <SelectContent>
                {availableDestinos.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum corretor disponível</div>
                )}
                {availableDestinos.map((d) => (
                  <SelectItem key={d.user_id} value={d.user_id}>
                    {d.nome}{d.equipe ? ` · ${d.equipe}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-foreground">O que repassar</p>
            <CheckRow label="Leads do pipeline (e oferta ativa)" checked={opts.leads} onChange={(v) => setOpts({ ...opts, leads: v })} />
            <CheckRow label="Negócios" checked={opts.negocios} onChange={(v) => setOpts({ ...opts, negocios: v })} />
            <CheckRow label="Tarefas e visitas" checked={opts.tarefas} onChange={(v) => setOpts({ ...opts, tarefas: v })} />
          </div>

          {isDelete && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Esta ação é permanente. Dados pessoais sem dono (scripts, conquistas, conversas) serão apagados.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={busy}
            className={isDelete ? "gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90" : "gap-2"}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isDelete ? <Trash2 className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
            {isDelete ? "Excluir e repassar" : "Inativar e repassar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <span className="text-xs text-foreground">{label}</span>
    </label>
  );
}
