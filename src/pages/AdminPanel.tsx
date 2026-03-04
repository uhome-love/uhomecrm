import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Trash2, Loader2, UserPlus, Search, X } from "lucide-react";
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
  const [lookupLoading, setLookupLoading] = useState(false);
  const [brokerInfo, setBrokerInfo] = useState<{ broker_name: string | null; lead_count: number } | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newNome, setNewNome] = useState("");
  const [newSenha, setNewSenha] = useState("");
  const [creating, setCreating] = useState(false);

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

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const addRole = useCallback(async (userId: string, role: AppRole) => {
    setAddingRole(userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      if (error.code === "23505") toast.info("Usuário já possui esse papel.");
      else toast.error("Erro ao adicionar papel.");
    } else { toast.success("Papel adicionado!"); fetchUsers(); }
    setAddingRole(null);
  }, [fetchUsers]);

  const removeRole = useCallback(async (userId: string, role: AppRole) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
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

  // Lookup broker in Jetimob
  const handleLookup = useCallback(async () => {
    if (!lookupId.trim()) return;
    setLookupLoading(true);
    setBrokerInfo(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-broker-user", {
        body: { action: "lookup_broker", jetimob_user_id: lookupId.trim() },
      });
      if (error) throw error;
      setBrokerInfo(data);
      if (data.broker_name) {
        setNewNome(data.broker_name);
        // Generate suggested email
        const slug = data.broker_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ".").replace(/[^a-z.]/g, "");
        setNewEmail(`${slug}@uhome.imb.br`);
      }
      toast.success(data.broker_name ? `Corretor encontrado: ${data.broker_name}` : "ID não encontrado nos leads, preencha manualmente.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao buscar corretor.");
    } finally { setLookupLoading(false); }
  }, [lookupId]);

  // Create user
  const handleCreate = useCallback(async () => {
    if (!newEmail || !newNome || !newSenha || !lookupId) {
      toast.error("Preencha todos os campos."); return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-broker-user", {
        body: { action: "create_user", jetimob_user_id: lookupId.trim(), email: newEmail, nome: newNome, senha: newSenha },
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
  }, [lookupId, newEmail, newNome, newSenha, fetchUsers]);

  const resetForm = () => {
    setLookupId(""); setBrokerInfo(null); setNewEmail(""); setNewNome(""); setNewSenha("");
  };

  const roleBadgeColor: Record<AppRole, string> = {
    admin: "bg-destructive/10 text-destructive border-destructive/20",
    gestor: "bg-primary/10 text-primary border-primary/20",
    corretor: "bg-accent/10 text-accent border-accent/20",
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h2 className="font-display text-xl font-bold text-foreground">Administração de Usuários</h2>
          </div>
          <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="gap-2">
            <UserPlus className="h-4 w-4" /> Criar Corretor
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

      {/* Create Broker User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Criar Corretor pelo ID Jetimob</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Step 1: Lookup */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">ID do Corretor no Jetimob</Label>
              <div className="flex gap-2">
                <Input value={lookupId} onChange={(e) => setLookupId(e.target.value)} placeholder="Ex: 96468" className="flex-1" />
                <Button onClick={handleLookup} disabled={lookupLoading || !lookupId.trim()} variant="outline" className="gap-1.5">
                  {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Buscar
                </Button>
              </div>
            </div>

            {/* Broker info */}
            <AnimatePresence>
              {brokerInfo && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {brokerInfo.broker_name || "Nome não encontrado"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {brokerInfo.lead_count} leads vinculados no Jetimob
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step 2: User details */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Nome</Label>
                <Input value={newNome} onChange={(e) => setNewNome(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Email</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="corretor@uhome.imb.br" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Senha inicial</Label>
                <Input type="text" value={newSenha} onChange={(e) => setNewSenha(e.target.value)} placeholder="Senha temporária" />
                <p className="text-[11px] text-muted-foreground">O corretor poderá alterar depois</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !newEmail || !newNome || !newSenha || !lookupId} className="gap-1.5">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {creating ? "Criando..." : "Criar Corretor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
