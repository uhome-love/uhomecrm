import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, UserPlus, Link2, Unlink, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TeamMember {
  id: string;
  nome: string;
  equipe: string | null;
  status: string;
  user_id: string | null;
}

interface SystemUser {
  user_id: string;
  nome: string;
  email: string | null;
}

export default function TeamManagement() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newEquipe, setNewEquipe] = useState("");
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [linkingMemberId, setLinkingMemberId] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("gerente_id", user.id)
      .order("nome");
    if (!error && data) setMembers(data as TeamMember[]);
    setLoading(false);
  }, [user]);

  const loadSystemUsers = useCallback(async () => {
    // Load all corretor profiles to allow linking
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "corretor");
    if (!roles || roles.length === 0) return;

    const userIds = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nome, email")
      .in("user_id", userIds);
    if (profiles) setSystemUsers(profiles);
  }, []);

  useEffect(() => {
    loadTeam();
    loadSystemUsers();
  }, [loadTeam, loadSystemUsers]);

  const addMember = async () => {
    if (!user || !newName.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    const { error } = await supabase.from("team_members").insert({
      gerente_id: user.id,
      nome: newName.trim(),
      equipe: newEquipe.trim() || null,
    });
    if (error) {
      toast.error("Erro ao adicionar.");
      return;
    }
    setNewName("");
    setNewEquipe("");
    loadTeam();
    toast.success("Corretor adicionado!");
  };

  const toggleStatus = async (m: TeamMember) => {
    const next = m.status === "ativo" ? "inativo" : "ativo";
    await supabase.from("team_members").update({ status: next }).eq("id", m.id);
    loadTeam();
    toast.success(`${m.nome} agora está ${next}.`);
  };

  const removeMember = async (m: TeamMember) => {
    if (!confirm(`Remover ${m.nome} do time?`)) return;
    await supabase.from("team_members").delete().eq("id", m.id);
    loadTeam();
    toast.success("Corretor removido.");
  };

  const linkUser = async (memberId: string, userId: string) => {
    const profile = systemUsers.find((u) => u.user_id === userId);
    const { error } = await supabase
      .from("team_members")
      .update({ user_id: userId })
      .eq("id", memberId);
    if (error) {
      toast.error("Erro ao vincular.");
      return;
    }
    setLinkingMemberId(null);
    loadTeam();
    toast.success(`Vinculado a ${profile?.nome || "usuário"}!`);
  };

  const unlinkUser = async (m: TeamMember) => {
    await supabase
      .from("team_members")
      .update({ user_id: null })
      .eq("id", m.id);
    loadTeam();
    toast.success(`${m.nome} desvinculado do sistema.`);
  };

  // Users already linked to this manager's team
  const linkedUserIds = members
    .filter((m) => m.user_id)
    .map((m) => m.user_id!);
  const availableUsers = systemUsers.filter(
    (u) => !linkedUserIds.includes(u.user_id)
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" /> Adicionar Corretor
        </h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">
              Nome
            </label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do corretor"
            />
          </div>
          <div className="w-40">
            <label className="text-xs text-muted-foreground mb-1 block">
              Equipe (opcional)
            </label>
            <Input
              value={newEquipe}
              onChange={(e) => setNewEquipe(e.target.value)}
              placeholder="Ex: Equipe A"
            />
          </div>
          <Button onClick={addMember} className="gap-1.5">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          💡 Ao criar um usuário corretor no painel Admin vinculado a você, o
          sistema vincula automaticamente por nome. Você também pode vincular
          manualmente abaixo.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="font-display font-semibold text-foreground">
            Meu Time ({members.filter((m) => m.status === "ativo").length}{" "}
            ativos)
          </h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Carregando...
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum corretor cadastrado. Adicione acima.
          </div>
        ) : (
          <div className="divide-y divide-border">
            <AnimatePresence>
              {members.map((m) => {
                const linkedProfile = m.user_id
                  ? systemUsers.find((u) => u.user_id === m.user_id)
                  : null;
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors"
                  >
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        m.status === "ativo"
                          ? "bg-success"
                          : "bg-muted-foreground/30"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{m.nome}</p>
                        {m.user_id ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 gap-1 border-success/30 text-success"
                          >
                            <Check className="h-3 w-3" /> Vinculado
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 text-muted-foreground"
                          >
                            Manual
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {m.equipe && (
                          <p className="text-xs text-muted-foreground">
                            {m.equipe}
                          </p>
                        )}
                        {linkedProfile?.email && (
                          <p className="text-xs text-muted-foreground">
                            • {linkedProfile.email}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Link/Unlink controls */}
                    {linkingMemberId === m.id ? (
                      <div className="flex items-center gap-2">
                        <Select
                          onValueChange={(val) => linkUser(m.id, val)}
                        >
                          <SelectTrigger className="w-48 h-8 text-xs">
                            <SelectValue placeholder="Selecione o usuário" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableUsers.length === 0 ? (
                              <SelectItem value="_none" disabled>
                                Nenhum corretor disponível
                              </SelectItem>
                            ) : (
                              availableUsers.map((u) => (
                                <SelectItem
                                  key={u.user_id}
                                  value={u.user_id}
                                >
                                  {u.nome || u.email || "Sem nome"}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => setLinkingMemberId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : m.user_id ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => unlinkUser(m)}
                        className="text-xs text-muted-foreground gap-1"
                      >
                        <Unlink className="h-3.5 w-3.5" /> Desvincular
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLinkingMemberId(m.id)}
                        className="text-xs gap-1"
                      >
                        <Link2 className="h-3.5 w-3.5" /> Vincular
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant={
                        m.status === "ativo" ? "outline" : "default"
                      }
                      onClick={() => toggleStatus(m)}
                      className="text-xs"
                    >
                      {m.status === "ativo" ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeMember(m)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
