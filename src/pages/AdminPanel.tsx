import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Shield, Trash2, Loader2, UserPlus, MessageSquare, CheckCircle, XCircle, Settings, UserX, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useUserRole";

interface UserWithRole {
  user_id: string;
  email: string;
  nome: string;
  roles: AppRole[];
  jetimob_user_id: string | null;
}

export default function AdminPanel() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingRole, setAddingRole] = useState<string | null>(null);
  const [editingJetimob, setEditingJetimob] = useState<string | null>(null);
  const [jetimobInput, setJetimobInput] = useState("");

  // Create user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [lookupId, setLookupId] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNome, setNewNome] = useState("");
  const [newSenha, setNewSenha] = useState("");
  const [newRole, setNewRole] = useState<"corretor" | "gestor" | "backoffice" | "rh">("corretor");
  const [selectedGerente, setSelectedGerente] = useState("");
  const [gestores, setGestores] = useState<{ user_id: string; nome: string }[]>([]);
  const [creating, setCreating] = useState(false);

  // Edit user dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSenha, setEditSenha] = useState("");
  const [editJetimob, setEditJetimob] = useState("");
  const [saving, setSaving] = useState(false);

  // 360dialog config
  const [dialogApiKey, setDialogApiKey] = useState("");
  const [dialogSaved, setDialogSaved] = useState(false);
  const [dialogTesting, setDialogTesting] = useState(false);
  const [dialogConnected, setDialogConnected] = useState<boolean | null>(null);
  const [savingKey, setSavingKey] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("user_id, nome, email, jetimob_user_id");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");

    if (profiles) {
      const userMap = new Map<string, UserWithRole>();
      profiles.forEach((p) => {
        userMap.set(p.user_id, {
          user_id: p.user_id, email: p.email || "", nome: p.nome || "",
          roles: [], jetimob_user_id: (p as any).jetimob_user_id || null,
        });
      });
      roles?.forEach((r) => {
        const u = userMap.get(r.user_id);
        if (u) u.roles.push(r.role as AppRole);
      });
      setUsers(Array.from(userMap.values()));
    }
    setLoading(false);
  }, []);

  // Fetch 360dialog config
  const fetchDialogConfig = useCallback(async () => {
    const { data } = await supabase
      .from("integration_settings")
      .select("value")
      .eq("key", "360dialog_api_key")
      .single();
    if (data?.value) {
      setDialogApiKey(data.value);
      setDialogSaved(true);
    }
  }, []);

  const fetchGestores = useCallback(async () => {
    const { data: gestorRoles } = await supabase.from("user_roles").select("user_id").in("role", ["gestor", "admin"]);
    if (gestorRoles) {
      const ids = gestorRoles.map(r => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, nome").in("user_id", ids);
      if (profiles) setGestores(profiles.map(p => ({ user_id: p.user_id, nome: p.nome || p.user_id })));
    }
  }, []);

  useEffect(() => { fetchUsers(); fetchDialogConfig(); fetchGestores(); }, [fetchUsers, fetchDialogConfig, fetchGestores]);

  const addRole = useCallback(async (userId: string, role: AppRole) => {
    setAddingRole(userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role } as any);
    if (error) {
      if (error.code === "23505") toast.info("Usuário já possui esse papel.");
      else toast.error("Erro ao adicionar papel.");
    } else { toast.success("Papel adicionado!"); fetchUsers(); }
    setAddingRole(null);
  }, [fetchUsers]);

  const removeRole = useCallback(async (userId: string, role: AppRole) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
    if (error) toast.error("Erro ao remover papel.");
    else { toast.success("Papel removido!"); fetchUsers(); }
  }, [fetchUsers]);

  const saveJetimobId = useCallback(async (userId: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ jetimob_user_id: jetimobInput.trim() || null } as any)
      .eq("user_id", userId);
    if (error) toast.error("Erro ao salvar ID Jetimob.");
    else { toast.success("ID Jetimob salvo!"); setEditingJetimob(null); fetchUsers(); }
  }, [jetimobInput, fetchUsers]);

  // Save 360dialog API key
  const saveDialogKey = useCallback(async () => {
    if (!dialogApiKey.trim()) { toast.error("Insira a API key."); return; }
    setSavingKey(true);
    try {
      const { data: existing } = await supabase
        .from("integration_settings")
        .select("id")
        .eq("key", "360dialog_api_key")
        .single();

      if (existing) {
        const { error } = await supabase
          .from("integration_settings")
          .update({ value: dialogApiKey.trim(), updated_at: new Date().toISOString() } as any)
          .eq("key", "360dialog_api_key");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("integration_settings")
          .insert({ key: "360dialog_api_key", value: dialogApiKey.trim(), label: "360dialog WhatsApp API Key" } as any);
        if (error) throw error;
      }
      setDialogSaved(true);
      toast.success("API key salva!");
    } catch (err: any) {
      toast.error("Erro ao salvar API key.");
    } finally { setSavingKey(false); }
  }, [dialogApiKey]);

  // Test 360dialog connection
  const testDialogConnection = useCallback(async () => {
    setDialogTesting(true);
    setDialogConnected(null);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-360dialog", {
        body: { action: "test" },
      });
      if (error) throw error;
      if (data?.error) {
        setDialogConnected(false);
        toast.error(data.error);
      } else {
        setDialogConnected(true);
        toast.success("Conexão com 360dialog OK!");
      }
    } catch (err: any) {
      setDialogConnected(false);
      toast.error("Falha ao testar conexão.");
    } finally { setDialogTesting(false); }
  }, []);

  // Create user
  const handleCreate = useCallback(async () => {
    if (!newEmail || !newNome || !newSenha) {
      toast.error("Preencha nome, email e senha."); return;
    }
    if (newRole === "corretor" && !selectedGerente) {
      toast.error("Selecione o gerente para vincular o corretor."); return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-broker-user", {
        body: {
          action: "create_user",
          jetimob_user_id: lookupId.trim() || null,
          email: newEmail,
          nome: newNome,
          senha: newSenha,
          gerente_id: newRole === "corretor" ? selectedGerente : null,
          role: newRole,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success(data.message || "Usuário criado!");
      setCreateOpen(false);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar usuário.");
    } finally { setCreating(false); }
  }, [lookupId, newEmail, newNome, newSenha, newRole, selectedGerente, fetchUsers]);

  const resetForm = () => {
    setLookupId(""); setNewEmail(""); setNewNome(""); setNewSenha(""); setSelectedGerente(""); setNewRole("corretor");
  };

  const openEdit = (user: UserWithRole) => {
    setEditUser(user);
    setEditNome(user.nome);
    setEditEmail(user.email);
    setEditJetimob(user.jetimob_user_id || "");
    setEditSenha("");
    setEditOpen(true);
  };

  const handleEdit = useCallback(async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const body: Record<string, any> = { action: "update_user", target_user_id: editUser.user_id };
      if (editNome !== editUser.nome) body.nome = editNome;
      if (editEmail !== editUser.email) body.email = editEmail;
      if (editJetimob !== (editUser.jetimob_user_id || "")) body.jetimob_user_id = editJetimob;
      if (editSenha) body.senha = editSenha;

      const { data, error } = await supabase.functions.invoke("create-broker-user", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || "Usuário atualizado!");
      setEditOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar usuário.");
    } finally { setSaving(false); }
  }, [editUser, editNome, editEmail, editSenha, editJetimob, fetchUsers]);

  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDeleteUser = useCallback(async (user: UserWithRole) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário "${user.nome || user.email}" permanentemente? Esta ação não pode ser desfeita.`)) return;
    setDeleting(user.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("create-broker-user", {
        body: { action: "delete_user", target_user_id: user.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || "Usuário excluído!");
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir usuário.");
    } finally { setDeleting(null); }
  }, [fetchUsers]);

  const roleBadgeColor: Record<AppRole, string> = {
    admin: "bg-destructive/10 text-destructive border-destructive/20",
    gestor: "bg-primary/10 text-primary border-primary/20",
    corretor: "bg-accent/10 text-accent border-accent/20",
    backoffice: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    rh: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* 360dialog Integration */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
            <MessageSquare className="h-5 w-5 text-success" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">WhatsApp — 360dialog</h3>
            <p className="text-xs text-muted-foreground">Configure sua API key para disparo de mensagens via WhatsApp Business</p>
          </div>
          {dialogConnected === true && (
            <Badge variant="outline" className="ml-auto bg-success/10 text-success border-success/20 gap-1">
              <CheckCircle className="h-3 w-3" /> Conectado
            </Badge>
          )}
          {dialogConnected === false && (
            <Badge variant="outline" className="ml-auto bg-destructive/10 text-destructive border-destructive/20 gap-1">
              <XCircle className="h-3 w-3" /> Falha
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">API Key do 360dialog</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                value={dialogApiKey}
                onChange={(e) => { setDialogApiKey(e.target.value); setDialogSaved(false); setDialogConnected(null); }}
                placeholder="Cole sua D360-API-KEY aqui"
                className="flex-1 font-mono text-sm"
              />
              <Button onClick={saveDialogKey} disabled={savingKey || !dialogApiKey.trim()} variant="outline" className="gap-1.5">
                {savingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </div>

          {dialogSaved && (
            <Button onClick={testDialogConnection} disabled={dialogTesting} variant="outline" size="sm" className="gap-1.5">
              {dialogTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              {dialogTesting ? "Testando..." : "Testar Conexão"}
            </Button>
          )}

          <p className="text-[11px] text-muted-foreground">
            Obtenha sua API key no painel do <a href="https://hub.360dialog.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">360dialog Hub</a>. 
            A chave será usada para enviar mensagens via WhatsApp Business API.
          </p>
        </div>
      </motion.div>

      {/* Users Section */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h2 className="font-display text-xl font-bold text-foreground">Administração de Usuários</h2>
          </div>
          <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="gap-2">
            <UserPlus className="h-4 w-4" /> Criar Usuário
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Gerencie papéis, permissões e vínculo com o Jetimob</p>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <motion.div key={user.user_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl border border-border bg-card shadow-card space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{user.nome || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {user.roles.map((role) => (
                      <Badge key={role} variant="outline" className={`${roleBadgeColor[role]} text-xs gap-1`}>
                        {role === "admin" ? "🛡️" : role === "gestor" ? "📊" : "👤"} {role}
                        <button onClick={() => removeRole(user.user_id, role)} className="ml-0.5 hover:text-destructive">
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select onValueChange={(v) => addRole(user.user_id, v as AppRole)} disabled={addingRole === user.user_id}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Adicionar papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">🛡️ Admin</SelectItem>
                      <SelectItem value="gestor">📊 Gestor</SelectItem>
                      <SelectItem value="corretor">👤 Corretor</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-primary hover:text-primary hover:bg-primary/10 shrink-0"
                    onClick={() => openEdit(user)}
                    title="Editar usuário"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => handleDeleteUser(user)}
                    disabled={deleting === user.user_id}
                    title="Excluir usuário"
                  >
                    {deleting === user.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-border">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">ID Jetimob:</Label>
                {editingJetimob === user.user_id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input value={jetimobInput} onChange={(e) => setJetimobInput(e.target.value)} placeholder="Ex: 12345" className="h-7 text-xs flex-1" />
                    <Button size="sm" className="h-7 text-xs" onClick={() => saveJetimobId(user.user_id)}>Salvar</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingJetimob(null)}>Cancelar</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-foreground font-mono">{user.jetimob_user_id || "—"}</span>
                    <Button size="sm" variant="ghost" className="h-6 text-xs text-primary" onClick={() => { setEditingJetimob(user.user_id); setJetimobInput(user.jetimob_user_id || ""); }}>
                      Editar
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {users.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum usuário encontrado.</p>}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Criar Usuário</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Tipo de Usuário</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as "corretor" | "gestor" | "backoffice" | "rh")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corretor">👤 Corretor</SelectItem>
                    <SelectItem value="gestor">📊 Gerente</SelectItem>
                    <SelectItem value="backoffice">🗂️ Backoffice</SelectItem>
                    <SelectItem value="rh">💙 RH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Nome</Label>
                <Input value={newNome} onChange={(e) => setNewNome(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Email</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="usuario@uhome.imb.br" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Senha inicial</Label>
                <Input type="text" value={newSenha} onChange={(e) => setNewSenha(e.target.value)} placeholder="Senha temporária" />
                <p className="text-[11px] text-muted-foreground">O usuário poderá alterar depois</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">ID Jetimob <span className="text-muted-foreground">(opcional)</span></Label>
                <Input value={lookupId} onChange={(e) => setLookupId(e.target.value)} placeholder="Ex: 96468" />
              </div>
              {newRole === "corretor" && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Vincular ao Gerente</Label>
                  <Select value={selectedGerente} onValueChange={setSelectedGerente}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o gerente" />
                    </SelectTrigger>
                    <SelectContent>
                      {gestores.map((g) => (
                        <SelectItem key={g.user_id} value={g.user_id}>{g.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Somente este gerente verá o corretor no time dele</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newEmail || !newNome || !newSenha || (newRole === "corretor" && !selectedGerente)}
              className="gap-1.5"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {creating ? "Criando..." : `Criar ${newRole === "gestor" ? "Gerente" : newRole === "backoffice" ? "Backoffice" : "Corretor"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Nome</Label>
                <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Email</Label>
                <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@uhome.imb.br" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Nova Senha <span className="text-muted-foreground">(deixe vazio para manter)</span></Label>
                <Input type="text" value={editSenha} onChange={(e) => setEditSenha(e.target.value)} placeholder="Nova senha" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">ID Jetimob</Label>
                <Input value={editJetimob} onChange={(e) => setEditJetimob(e.target.value)} placeholder="Ex: 96468" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={saving || !editNome || !editEmail} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
