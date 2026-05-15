import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Link2, Unlink, Check, Users, Filter, RefreshCw, GraduationCap, Phone, CalendarDays, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { useTeamOnboarding, ONBOARDING_STEPS } from "@/hooks/useOnboarding";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface TeamMember {
  id: string;
  nome: string;
  equipe: string | null;
  status: string;
  user_id: string | null;
  gerente_id: string;
}

interface SystemUser {
  user_id: string;
  nome: string;
  email: string | null;
  avatar_url: string | null;
  avatar_gamificado_url: string | null;
  cargo: string | null;
}

interface MemberStats {
  ligacoes: number;
  visitas: number;
}

interface GerenteOption {
  user_id: string;
  nome: string;
}

export default function TeamManagement() {
  const { user } = useAuth();
  const { isAdmin, isGestor } = useUserRole();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [linkingMemberId, setLinkingMemberId] = useState<string | null>(null);
  const [filterEquipe, setFilterEquipe] = useState<string>("all");
  const [editingEquipe, setEditingEquipe] = useState<string | null>(null);
  const [equipeValue, setEquipeValue] = useState("");
  const [weeklyStats, setWeeklyStats] = useState<Record<string, MemberStats>>({});
  const [detailMember, setDetailMember] = useState<TeamMember | null>(null);

  // For admin: select which gerente's team to view
  const [gerentes, setGerentes] = useState<GerenteOption[]>([]);
  const [selectedGerente, setSelectedGerente] = useState<string>("");

  // Load gerentes list for admin
  useEffect(() => {
    if (!isAdmin || !user) return;
    (async () => {
      const { data: gestorRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "gestor");
      if (!gestorRoles?.length) return;
      const ids = gestorRoles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", ids)
        .order("nome");
      if (profiles) {
        setGerentes(profiles.map((p) => ({ user_id: p.user_id, nome: p.nome || "Gerente" })));
        // Auto-select first gerente
        if (profiles.length > 0 && !selectedGerente) {
          setSelectedGerente(profiles[0].user_id);
        }
      }
    })();
  }, [isAdmin, user]);

  // The effective gerente_id to query
  const effectiveGerenteId = isAdmin ? selectedGerente : user?.id;

  const loadTeam = useCallback(async () => {
    if (!effectiveGerenteId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("gerente_id", effectiveGerenteId)
      .order("nome");
    if (!error && data) setMembers(data as TeamMember[]);
    setLoading(false);
  }, [effectiveGerenteId]);

  const loadSystemUsers = useCallback(async () => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "corretor");
    if (!roles || roles.length === 0) return;

    const userIds = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nome, email, avatar_url, avatar_gamificado_url, cargo")
      .in("user_id", userIds);
    if (profiles) setSystemUsers(profiles as SystemUser[]);
  }, []);

  // Load weekly stats for all linked members
  const loadWeeklyStats = useCallback(async () => {
    const linkedIds = members.filter((m) => m.user_id).map((m) => m.user_id!);
    if (linkedIds.length === 0) return;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek === 0 ? 7 : dayOfWeek) - 1));
    monday.setHours(0, 0, 0, 0);
    const weekStart = monday.toISOString();

    // Fetch ligações (oferta_ativa_tentativas) this week
    const { data: tentativas } = await supabase
      .from("oferta_ativa_tentativas")
      .select("corretor_id")
      .in("corretor_id", linkedIds)
      .gte("created_at", weekStart);

    // Fetch visitas this week
    const { data: visitas } = await supabase
      .from("visitas")
      .select("corretor_id")
      .in("corretor_id", linkedIds)
      .gte("data_visita", weekStart.slice(0, 10));

    const stats: Record<string, MemberStats> = {};
    linkedIds.forEach((id) => {
      stats[id] = { ligacoes: 0, visitas: 0 };
    });
    tentativas?.forEach((t) => {
      if (stats[t.corretor_id]) stats[t.corretor_id].ligacoes++;
    });
    visitas?.forEach((v) => {
      if (stats[v.corretor_id]) stats[v.corretor_id].visitas++;
    });
    setWeeklyStats(stats);
  }, [members]);

  useEffect(() => {
    loadTeam();
    loadSystemUsers();
  }, [loadTeam, loadSystemUsers]);

  useEffect(() => {
    if (members.length > 0) loadWeeklyStats();
  }, [members, loadWeeklyStats]);

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
    toast.success("Corretor removido do time.");
  };

  const linkUser = async (memberId: string, userId: string) => {
    const profile = systemUsers.find((u) => u.user_id === userId);
    const alreadyLinked = members.find((m) => m.user_id === userId && m.id !== memberId);
    if (alreadyLinked) {
      toast.error(`Este usuário já está vinculado a "${alreadyLinked.nome}".`);
      return;
    }
    const { error } = await supabase.from("team_members").update({ user_id: userId }).eq("id", memberId);
    if (error) { toast.error("Erro ao vincular."); return; }
    setLinkingMemberId(null);
    loadTeam();
    toast.success(`Vinculado a ${profile?.nome || "usuário"}!`);
  };

  const unlinkUser = async (m: TeamMember) => {
    await supabase.from("team_members").update({ user_id: null }).eq("id", m.id);
    loadTeam();
    toast.success(`${m.nome} desvinculado.`);
  };

  const updateEquipe = async (memberId: string, equipe: string) => {
    await supabase.from("team_members").update({ equipe: equipe.trim() || null }).eq("id", memberId);
    setEditingEquipe(null);
    setEquipeValue("");
    loadTeam();
    toast.success("Equipe atualizada!");
  };

  const linkedUserIds = members.filter((m) => m.user_id).map((m) => m.user_id!);
  const availableUsers = systemUsers.filter((u) => !linkedUserIds.includes(u.user_id));
  const { data: onboardingMap = {} } = useTeamOnboarding(linkedUserIds);
  const totalOnboardingSteps = ONBOARDING_STEPS.length;

  const syncFromAdmin = async () => {
    if (!effectiveGerenteId) return;
    const unlinkedCorretores = availableUsers.filter(
      (u) => !members.some((m) => m.user_id === u.user_id)
    );
    if (unlinkedCorretores.length === 0) {
      toast.info("Todos os corretores do sistema já estão no time.");
      return;
    }
    let added = 0;
    for (const corretor of unlinkedCorretores) {
      const existingByName = members.find(
        (m) => !m.user_id && m.nome.trim().toLowerCase() === corretor.nome.trim().toLowerCase()
      );
      if (existingByName) {
        await supabase.from("team_members").update({ user_id: corretor.user_id, status: "ativo" }).eq("id", existingByName.id);
      } else {
        await supabase.from("team_members").insert({
          gerente_id: effectiveGerenteId,
          nome: corretor.nome || corretor.email || "Corretor",
          status: "ativo",
          user_id: corretor.user_id,
        });
      }
      added++;
    }
    loadTeam();
    toast.success(`${added} corretor(es) sincronizado(s)!`);
  };

  // Filters
  const equipes = Array.from(new Set(members.map((m) => m.equipe).filter(Boolean))) as string[];
  const filteredMembers = filterEquipe === "all"
    ? members
    : filterEquipe === "sem_equipe"
    ? members.filter((m) => !m.equipe)
    : members.filter((m) => m.equipe === filterEquipe);

  const activeCount = members.filter((m) => m.status === "ativo").length;
  const totalLigacoesHoje = Object.values(weeklyStats).reduce((a, b) => a + b.ligacoes, 0);

  const unlinkedCount = availableUsers.filter(
    (u) => !members.some((m) => m.user_id === u.user_id)
  ).length;

  // Helper: get avatar for a member
  const getAvatar = (m: TeamMember) => {
    if (!m.user_id) return null;
    const profile = systemUsers.find((u) => u.user_id === m.user_id);
    return profile?.avatar_gamificado_url || profile?.avatar_url || null;
  };

  const getInitials = (name: string) =>
    name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  return (
    <div className="space-y-5">
      {/* Admin: team selector */}
      {isAdmin && gerentes.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
          <Users className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-foreground">Equipe de:</span>
          <Select value={selectedGerente} onValueChange={setSelectedGerente}>
            <SelectTrigger className="w-56 h-8 text-sm">
              <SelectValue placeholder="Selecionar gerente" />
            </SelectTrigger>
            <SelectContent>
              {gerentes.map((g) => (
                <SelectItem key={g.user_id} value={g.user_id}>{g.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Corretores Ativos</p>
          <p className="text-2xl font-black text-foreground mt-1">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Ligações (semana)</p>
          <p className="text-2xl font-black text-foreground mt-1">{totalLigacoesHoje}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Ações</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="text-xs gap-1 h-8" onClick={() => { loadTeam(); loadWeeklyStats(); }}>
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </Button>
            {unlinkedCount > 0 && (
              <Button size="sm" variant="default" className="text-xs gap-1 h-8" onClick={syncFromAdmin}>
                <Link2 className="h-3.5 w-3.5" /> Sincronizar {unlinkedCount}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <h3 className="font-semibold text-foreground">
            Meu Time ({filteredMembers.filter((m) => m.status === "ativo").length} ativos)
          </h3>
          <div className="flex items-center gap-2">
            {filterEquipe !== "all" && (
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setFilterEquipe("all")}>
                Limpar filtro
              </Button>
            )}
            {equipes.length > 0 && (
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
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {members.length === 0
              ? "Nenhum corretor neste time ainda."
              : "Nenhum corretor nesta equipe."}
          </div>
        ) : (
          <div className="divide-y divide-border">
            <AnimatePresence>
              {filteredMembers.map((m) => {
                const avatarUrl = getAvatar(m);
                const stats = m.user_id ? weeklyStats[m.user_id] : null;
                const profile = m.user_id ? systemUsers.find((u) => u.user_id === m.user_id) : null;
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors"
                  >
                    {/* Avatar */}
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={m.nome} className="h-10 w-10 rounded-full object-cover shrink-0 border-2 border-border" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {getInitials(m.nome)}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground text-sm">{m.nome}</p>
                        <div className={`h-2 w-2 rounded-full shrink-0 ${m.status === "ativo" ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                        {m.user_id ? (
                          <Badge variant="outline" className="text-[10px] h-5 gap-1 border-green-500/30 text-green-600">
                            <Check className="h-3 w-3" /> Vinculado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">
                            Não vinculado
                          </Badge>
                        )}
                        {m.user_id && onboardingMap[m.user_id] !== undefined && (onboardingMap[m.user_id] || 0) < totalOnboardingSteps && (
                          <Badge variant="outline" className="text-[10px] h-5 gap-1 border-amber-400/40 text-amber-600">
                            <GraduationCap className="h-3 w-3" />
                            Onboarding {Math.round(((onboardingMap[m.user_id] || 0) / totalOnboardingSteps) * 100)}%
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {profile?.cargo && (
                          <span className="text-[10px] text-muted-foreground">{profile.cargo}</span>
                        )}
                        {editingEquipe === m.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={equipeValue}
                              onChange={(e) => setEquipeValue(e.target.value)}
                              placeholder="Equipe"
                              className="h-5 w-24 text-[10px]"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") updateEquipe(m.id, equipeValue);
                                if (e.key === "Escape") { setEditingEquipe(null); setEquipeValue(""); }
                              }}
                              autoFocus
                            />
                            <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => updateEquipe(m.id, equipeValue)}>OK</Button>
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
                    </div>

                    {/* Weekly stats */}
                    {stats && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                        <div className="flex items-center gap-1" title="Ligações esta semana">
                          <Phone className="h-3 w-3" />
                          <span className="font-semibold text-foreground">{stats.ligacoes}</span>
                        </div>
                        <div className="flex items-center gap-1" title="Visitas esta semana">
                          <CalendarDays className="h-3 w-3" />
                          <span className="font-semibold text-foreground">{stats.visitas}</span>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {m.user_id && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Ver detalhes" onClick={() => setDetailMember(m)}>
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                      {linkingMemberId === m.id ? (
                        <div className="flex items-center gap-1">
                          <Select onValueChange={(val) => linkUser(m.id, val)}>
                            <SelectTrigger className="w-40 h-7 text-xs">
                              <SelectValue placeholder="Selecionar usuário" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableUsers.length === 0 ? (
                                <SelectItem value="_none" disabled>Nenhum disponível</SelectItem>
                              ) : (
                                availableUsers.map((u) => (
                                  <SelectItem key={u.user_id} value={u.user_id}>{u.nome || u.email || "Sem nome"}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setLinkingMemberId(null)}>✕</Button>
                        </div>
                      ) : m.user_id ? (
                        <Button size="sm" variant="ghost" onClick={() => unlinkUser(m)} className="text-xs text-muted-foreground gap-1 h-7">
                          <Unlink className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setLinkingMemberId(m.id)} className="text-xs gap-1 h-7">
                          <Link2 className="h-3 w-3" /> Vincular
                        </Button>
                      )}
                      <Button size="sm" variant={m.status === "ativo" ? "outline" : "default"} onClick={() => toggleStatus(m)} className="text-xs h-7">
                        {m.status === "ativo" ? "Desativar" : "Ativar"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeMember(m)} className="text-destructive hover:text-destructive h-7 w-7 p-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <Sheet open={!!detailMember} onOpenChange={() => setDetailMember(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{detailMember?.nome}</SheetTitle>
          </SheetHeader>
          {detailMember && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-4">
                {getAvatar(detailMember) ? (
                  <img src={getAvatar(detailMember)!} alt="" className="h-16 w-16 rounded-full object-cover border-2 border-border" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                    {getInitials(detailMember.nome)}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-lg text-foreground">{detailMember.nome}</p>
                  <p className="text-sm text-muted-foreground">{detailMember.equipe || "Sem equipe"}</p>
                  <Badge variant={detailMember.status === "ativo" ? "default" : "secondary"} className="mt-1 text-xs">
                    {detailMember.status}
                  </Badge>
                </div>
              </div>
              {detailMember.user_id && weeklyStats[detailMember.user_id] && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">Ligações (semana)</p>
                    <p className="text-2xl font-black text-foreground">{weeklyStats[detailMember.user_id].ligacoes}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">Visitas (semana)</p>
                    <p className="text-2xl font-black text-foreground">{weeklyStats[detailMember.user_id].visitas}</p>
                  </div>
                </div>
              )}
              {detailMember.user_id && (() => {
                const p = systemUsers.find((u) => u.user_id === detailMember.user_id);
                return p ? (
                  <div className="space-y-2 text-sm">
                    {p.email && <p className="text-muted-foreground">📧 {p.email}</p>}
                    {p.cargo && <p className="text-muted-foreground">💼 {p.cargo}</p>}
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
