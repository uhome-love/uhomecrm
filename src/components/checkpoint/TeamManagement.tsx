import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Link2, Unlink, Check, Users, Filter, Info, RefreshCw, GraduationCap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useTeamOnboarding, ONBOARDING_STEPS } from "@/hooks/useOnboarding";
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
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [linkingMemberId, setLinkingMemberId] = useState<string | null>(null);
  const [filterEquipe, setFilterEquipe] = useState<string>("all");
  const [editingEquipe, setEditingEquipe] = useState<string | null>(null);
  const [equipeValue, setEquipeValue] = useState("");

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

  const toggleStatus = async (m: TeamMember) => {
    const next = m.status === "ativo" ? "inativo" : "ativo";
    await supabase.from("team_members").update({ status: next }).eq("id", m.id);
    loadTeam();
    toast.success(`${m.nome} agora está ${next}.`);
  };

  const removeMember = async (m: TeamMember) => {
    if (!confirm(`Remover ${m.nome} do time? Isso não exclui o usuário do sistema.`)) return;
    await supabase.from("team_members").delete().eq("id", m.id);
    loadTeam();
    toast.success("Corretor removido do time.");
  };

  const linkUser = async (memberId: string, userId: string) => {
    const profile = systemUsers.find((u) => u.user_id === userId);
    // Check if this user is already linked to another team_member of this manager
    const alreadyLinked = members.find((m) => m.user_id === userId && m.id !== memberId);
    if (alreadyLinked) {
      toast.error(`Este usuário já está vinculado a "${alreadyLinked.nome}".`);
      return;
    }
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

  const updateEquipe = async (memberId: string, equipe: string) => {
    await supabase
      .from("team_members")
      .update({ equipe: equipe.trim() || null })
      .eq("id", memberId);
    setEditingEquipe(null);
    setEquipeValue("");
    loadTeam();
    toast.success("Equipe atualizada!");
  };

  // Detect unlinked system corretores that could be added to this team
  const linkedUserIds = members.filter((m) => m.user_id).map((m) => m.user_id!);
  const availableUsers = systemUsers.filter((u) => !linkedUserIds.includes(u.user_id));
  
  // Onboarding status for team members
  const { data: onboardingMap = {} } = useTeamOnboarding(linkedUserIds);
  const totalOnboardingSteps = ONBOARDING_STEPS.length;

  // Auto-add: find corretores created in Admin for this manager but not yet in team_members
  const syncFromAdmin = async () => {
    if (!user) return;
    // Find corretores that have user accounts but are not in this manager's team
    const unlinkedCorretores = availableUsers.filter(
      (u) => !members.some((m) => m.user_id === u.user_id)
    );

    if (unlinkedCorretores.length === 0) {
      toast.info("Todos os corretores do sistema já estão no seu time.");
      return;
    }

    let added = 0;
    for (const corretor of unlinkedCorretores) {
      // Check if there's a matching name already (manual entry without link)
      const existingByName = members.find(
        (m) => !m.user_id && m.nome.trim().toLowerCase() === corretor.nome.trim().toLowerCase()
      );

      if (existingByName) {
        // Link existing manual entry
        await supabase
          .from("team_members")
          .update({ user_id: corretor.user_id, status: "ativo" })
          .eq("id", existingByName.id);
      } else {
        // Create new team_member entry linked to the corretor
        await supabase.from("team_members").insert({
          gerente_id: user.id,
          nome: corretor.nome || corretor.email || "Corretor",
          status: "ativo",
          user_id: corretor.user_id,
        });
      }
      added++;
    }

    loadTeam();
    toast.success(`${added} corretor(es) sincronizado(s) ao seu time!`);
  };

  // Equipe filter & stats
  const equipes = Array.from(new Set(members.map((m) => m.equipe).filter(Boolean))) as string[];
  const filteredMembers = filterEquipe === "all"
    ? members
    : filterEquipe === "sem_equipe"
    ? members.filter((m) => !m.equipe)
    : members.filter((m) => m.equipe === filterEquipe);

  const equipeStats = equipes.map((eq) => {
    const membersInEquipe = members.filter((m) => m.equipe === eq);
    return {
      equipe: eq,
      total: membersInEquipe.length,
      ativos: membersInEquipe.filter((m) => m.status === "ativo").length,
      vinculados: membersInEquipe.filter((m) => m.user_id).length,
    };
  });
  const semEquipe = members.filter((m) => !m.equipe);
  if (semEquipe.length > 0) {
    equipeStats.push({
      equipe: "Sem equipe",
      total: semEquipe.length,
      ativos: semEquipe.filter((m) => m.status === "ativo").length,
      vinculados: semEquipe.filter((m) => m.user_id).length,
    });
  }

  const unlinkedCount = availableUsers.filter(
    (u) => !members.some((m) => m.user_id === u.user_id)
  ).length;

  return (
    <div className="space-y-6">
      {/* Info banner - no more manual creation */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
        <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            Os corretores são cadastrados pelo administrador no <span className="text-primary">Painel Admin</span>.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Ao criar um corretor no Admin vinculado a você como gerente, ele aparece automaticamente aqui. 
            Use esta tela para gerenciar equipes, ativar/desativar e vincular usuários.
          </p>
          {unlinkedCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3 gap-1.5 text-xs"
              onClick={syncFromAdmin}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sincronizar {unlinkedCount} corretor(es) do sistema
            </Button>
          )}
        </div>
      </div>

      {/* Equipe Stats */}
      {equipeStats.length > 1 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {equipeStats.map((s) => (
            <button
              key={s.equipe}
              onClick={() => setFilterEquipe(s.equipe === "Sem equipe" ? "sem_equipe" : s.equipe)}
              className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                (filterEquipe === s.equipe || (filterEquipe === "sem_equipe" && s.equipe === "Sem equipe"))
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-card hover:border-muted-foreground/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{s.equipe}</span>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span><strong className="text-foreground">{s.ativos}</strong> ativos</span>
                <span><strong className="text-foreground">{s.vinculados}</strong> vinc.</span>
                <span>{s.total} total</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <h3 className="font-display font-semibold text-foreground">
            Meu Time ({filteredMembers.filter((m) => m.status === "ativo").length} ativos)
          </h3>
          <div className="flex items-center gap-2">
            {filterEquipe !== "all" && (
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setFilterEquipe("all")}>
                Limpar filtro
              </Button>
            )}
            <Select value={filterEquipe} onValueChange={setFilterEquipe}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Filtrar equipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas equipes</SelectItem>
                {equipes.map((eq) => (
                  <SelectItem key={eq} value={eq}>{eq}</SelectItem>
                ))}
                {semEquipe.length > 0 && (
                  <SelectItem value="sem_equipe">Sem equipe</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Carregando...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {members.length === 0
              ? "Nenhum corretor no time. Peça ao administrador para cadastrar corretores vinculados a você."
              : "Nenhum corretor nesta equipe."}
          </div>
        ) : (
          <div className="divide-y divide-border">
            <AnimatePresence>
              {filteredMembers.map((m) => {
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
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        m.status === "ativo"
                          ? "bg-success"
                          : "bg-muted-foreground/30"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
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
                            Não vinculado
                          </Badge>
                        )}
                        {m.user_id && onboardingMap[m.user_id] !== undefined && (onboardingMap[m.user_id] || 0) < totalOnboardingSteps && (
                          <Badge variant="outline" className="text-[10px] h-5 gap-1 border-amber-400/40 text-amber-600">
                            <GraduationCap className="h-3 w-3" />
                            Onboarding {Math.round(((onboardingMap[m.user_id] || 0) / totalOnboardingSteps) * 100)}%
                          </Badge>
                        )}
                        {editingEquipe === m.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={equipeValue}
                              onChange={(e) => setEquipeValue(e.target.value)}
                              placeholder="Equipe"
                              className="h-6 w-28 text-xs"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") updateEquipe(m.id, equipeValue);
                                if (e.key === "Escape") { setEditingEquipe(null); setEquipeValue(""); }
                              }}
                              autoFocus
                            />
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => updateEquipe(m.id, equipeValue)}>
                              OK
                            </Button>
                          </div>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-5 cursor-pointer hover:bg-secondary/80"
                            onClick={() => { setEditingEquipe(m.id); setEquipeValue(m.equipe || ""); }}
                          >
                            {m.equipe || "Definir equipe"}
                          </Badge>
                        )}
                      </div>
                      {linkedProfile?.email && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          • {linkedProfile.email}
                        </p>
                      )}
                    </div>

                    {/* Link/Unlink controls */}
                    {linkingMemberId === m.id ? (
                      <div className="flex items-center gap-2">
                        <Select onValueChange={(val) => linkUser(m.id, val)}>
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
                                <SelectItem key={u.user_id} value={u.user_id}>
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
                      variant={m.status === "ativo" ? "outline" : "default"}
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
