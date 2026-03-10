import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Users, Phone, CalendarDays, RefreshCw, Eye, Briefcase } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface AdminStaff {
  user_id: string;
  nome: string;
  avatar_url: string | null;
  avatar_gamificado_url: string | null;
  cargo: string | null;
}

interface CorretorInfo {
  user_id: string;
  nome: string;
  avatar_url: string | null;
  avatar_gamificado_url: string | null;
  cargo: string | null;
  ligacoes_hoje: number;
  aproveitados_hoje: number;
  visitas_semana: number;
  ativo_hoje: boolean;
}

interface GerenteTeam {
  gerente_id: string;
  gerente_nome: string;
  gerente_avatar: string | null;
  gerente_avatar_gamificado: string | null;
  corretores: CorretorInfo[];
  totals: { ligacoes: number; aproveitados: number; visitas: number; vgv: number };
}

const TEAM_COLORS = [
  { bg: "bg-blue-50", border: "border-blue-200", ring: "ring-blue-400", accent: "text-blue-700" },
  { bg: "bg-emerald-50", border: "border-emerald-200", ring: "ring-emerald-400", accent: "text-emerald-700" },
  { bg: "bg-purple-50", border: "border-purple-200", ring: "ring-purple-400", accent: "text-purple-700" },
  { bg: "bg-amber-50", border: "border-amber-200", ring: "ring-amber-400", accent: "text-amber-700" },
];

const ADMIN_BADGES = [
  { label: "🎨 Marketing", className: "bg-pink-100 text-pink-700 border-pink-200" },
  { label: "💼 Administrativo", className: "bg-slate-100 text-slate-700 border-slate-200" },
  { label: "💰 Financeiro", className: "bg-amber-100 text-amber-700 border-amber-200" },
];

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
}

function nameToHsl(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h = ((hash % 360) + 360) % 360;
  return `hsl(${h}, 55%, 45%)`;
}

export default function CeoTeamPanel() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const isMobile = useIsMobile();
  const [teams, setTeams] = useState<GerenteTeam[]>([]);
  const [adminStaff, setAdminStaff] = useState<AdminStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailCorretor, setDetailCorretor] = useState<CorretorInfo | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoading(true);

    const today = new Date();
    const todayStr = today.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek === 0 ? 7 : dayOfWeek) - 1));
    const weekStart = monday.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const todayStart = todayStr + "T00:00:00-03:00";

    // 1. Get all active team members with their gerente
    const { data: members } = await supabase
      .from("team_members")
      .select("gerente_id, user_id, nome")
      .eq("status", "ativo")
      .order("nome");

    if (!members?.length) { setTeams([]); setLoading(false); return; }

    // 2. Get all gerente user_ids
    const gerenteIds = [...new Set(members.map(m => m.gerente_id))];
    const allUserIds = [...new Set([...gerenteIds, ...members.map(m => m.user_id).filter(Boolean)])];

    // 3. Get profiles for everyone
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nome, avatar_url, avatar_gamificado_url, cargo")
      .in("user_id", allUserIds as string[]);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    // 4. Load admin/marketing staff — broad search
    let adminResults: typeof profiles = [];
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("user_id, nome, avatar_url, avatar_gamificado_url, cargo")
      .or("cargo.in.(marketing,admin,financeiro,administrativo),nome.ilike.%Ana%")
      .not("cargo", "in", "(corretor,gestor,ceo)");
    adminResults = adminProfiles || [];

    // Fallback: if Ana Paula not found, search by name directly
    const hasAna = adminResults.some(p => (p.nome || "").toLowerCase().includes("ana paula"));
    if (!hasAna) {
      const { data: anaFallback } = await supabase
        .from("profiles")
        .select("user_id, nome, avatar_url, avatar_gamificado_url, cargo")
        .ilike("nome", "%Ana Paula%")
        .limit(1);
      if (anaFallback?.length) {
        const existing = new Set(adminResults.map(p => p.user_id));
        anaFallback.forEach(p => { if (!existing.has(p.user_id)) adminResults.push(p); });
      }
    }

    setAdminStaff(
      adminResults.map(p => ({
        user_id: p.user_id,
        nome: p.nome || "Colaborador",
        avatar_url: p.avatar_url,
        avatar_gamificado_url: p.avatar_gamificado_url,
        cargo: p.cargo,
      }))
    );

    // 5. Get today's tentativas for all corretores
    const corretorUserIds = members.map(m => m.user_id).filter(Boolean) as string[];
    const { data: tentativas } = await supabase
      .from("oferta_ativa_tentativas")
      .select("corretor_id, resultado")
      .in("corretor_id", corretorUserIds)
      .gte("created_at", todayStart);

    // 6. Get this week's visitas
    const { data: visitas } = await supabase
      .from("visitas")
      .select("corretor_id")
      .in("corretor_id", corretorUserIds)
      .gte("data_visita", weekStart);

    // 7. Get this month's VGV from negocios
    const { data: negocios } = await supabase
      .from("negocios")
      .select("corretor_id, vgv_final, vgv_estimado, fase")
      .gte("created_at", `${todayStr.slice(0, 7)}-01`)
      .lt("created_at", `${todayStr.slice(0, 7)}-32`);

    // Aggregate stats per corretor
    const corretorStats: Record<string, { ligacoes: number; aproveitados: number; visitas: number }> = {};
    corretorUserIds.forEach(id => { corretorStats[id] = { ligacoes: 0, aproveitados: 0, visitas: 0 }; });
    tentativas?.forEach(t => {
      if (corretorStats[t.corretor_id]) {
        corretorStats[t.corretor_id].ligacoes++;
        if (t.resultado === "com_interesse") corretorStats[t.corretor_id].aproveitados++;
      }
    });
    visitas?.forEach(v => {
      if (corretorStats[v.corretor_id]) corretorStats[v.corretor_id].visitas++;
    });

    // Build teams
    const teamMap = new Map<string, GerenteTeam>();
    for (const gId of gerenteIds) {
      const gProfile = profileMap.get(gId);
      teamMap.set(gId, {
        gerente_id: gId,
        gerente_nome: gProfile?.nome || "Gerente",
        gerente_avatar: gProfile?.avatar_url || null,
        gerente_avatar_gamificado: gProfile?.avatar_gamificado_url || null,
        corretores: [],
        totals: { ligacoes: 0, aproveitados: 0, visitas: 0, vgv: 0 },
      });
    }

    for (const m of members) {
      const team = teamMap.get(m.gerente_id);
      if (!team || !m.user_id) continue;
      const profile = profileMap.get(m.user_id);
      const stats = corretorStats[m.user_id] || { ligacoes: 0, aproveitados: 0, visitas: 0 };
      team.corretores.push({
        user_id: m.user_id,
        nome: profile?.nome || m.nome,
        avatar_url: profile?.avatar_url || null,
        avatar_gamificado_url: profile?.avatar_gamificado_url || null,
        cargo: profile?.cargo || "corretor",
        ligacoes_hoje: stats.ligacoes,
        aproveitados_hoje: stats.aproveitados,
        visitas_semana: stats.visitas,
        ativo_hoje: stats.ligacoes > 0,
      });
      team.totals.ligacoes += stats.ligacoes;
      team.totals.aproveitados += stats.aproveitados;
      team.totals.visitas += stats.visitas;
    }

    // Try to add VGV from negocios (by corretor_id match)
    if (negocios) {
      for (const n of negocios) {
        if (!n.corretor_id) continue;
        const vgv = Number(n.vgv_final || n.vgv_estimado || 0);
        if (!vgv) continue;
        for (const [, team] of teamMap) {
          const found = team.corretores.find(c => c.user_id === n.corretor_id);
          if (found) {
            team.totals.vgv += vgv;
            break;
          }
        }
      }
    }

    setTeams(Array.from(teamMap.values()).sort((a, b) => a.gerente_nome.localeCompare(b.gerente_nome)));
    setLoading(false);
  }, [user, isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalCorretores = teams.reduce((a, t) => a + t.corretores.length, 0);
  const totalGerentes = teams.length;
  const totalAtivos = teams.reduce((a, t) => a + t.corretores.filter(c => c.ativo_hoje).length, 0);
  const totalAdmin = adminStaff.length;
  const totalColab = 1 + totalGerentes + totalCorretores + totalAdmin; // 1 = CEO

  const renderAvatar = (url: string | null, gamUrl: string | null, name: string, size: "sm" | "md" | "lg" = "sm", ringColor?: string) => {
    const src = gamUrl || url;
    const sizeClass = size === "lg" ? "h-14 w-14" : size === "md" ? "h-12 w-12" : "h-8 w-8";
    const textSize = size === "lg" ? "text-lg" : size === "md" ? "text-base" : "text-xs";
    const bgColor = nameToHsl(name);
    return src ? (
      <img src={src} alt={name} className={`${sizeClass} rounded-full object-cover border-2 ${ringColor || "border-border"}`} />
    ) : (
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center ${textSize} font-bold text-white ${ringColor ? `ring-2 ${ringColor}` : ""}`}
        style={{ backgroundColor: bgColor }}
      >
        {getInitials(name)}
      </div>
    );
  };

  const TeamCard = ({ team, colorIdx }: { team: GerenteTeam; colorIdx: number }) => {
    const colors = TEAM_COLORS[colorIdx % TEAM_COLORS.length];
    return (
      <div className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}>
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            {renderAvatar(team.gerente_avatar, team.gerente_avatar_gamificado, team.gerente_nome, "md", colors.ring)}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${colors.accent}`}>{team.gerente_nome}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px] h-5">Gerente</Badge>
                <span className="text-[10px] text-muted-foreground">{team.corretores.length} corretores</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-white/70 rounded-full px-2 py-0.5 text-blue-700">
              <Phone className="h-3 w-3" /> {team.totals.ligacoes} lig
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-white/70 rounded-full px-2 py-0.5 text-green-700">
              <CalendarDays className="h-3 w-3" /> {team.totals.visitas} vis
            </span>
          </div>
        </div>

        <div className="divide-y divide-border/30">
          {team.corretores.map(c => (
            <button
              key={c.user_id}
              onClick={() => setDetailCorretor(c)}
              className="w-full flex items-center gap-2.5 p-3 hover:bg-white/60 transition-colors text-left"
            >
              <div className="relative">
                {renderAvatar(c.avatar_url, c.avatar_gamificado_url, c.nome)}
                <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                  c.ativo_hoje ? "bg-green-500" : "bg-muted-foreground/30"
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.nome}</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
                <span className={c.ligacoes_hoje > 0 ? "font-semibold text-foreground" : ""}>
                  {c.ligacoes_hoje} <span className="text-[9px]">lig</span>
                </span>
                <span className={c.aproveitados_hoje > 0 ? "font-semibold text-green-600" : ""}>
                  {c.aproveitados_hoje} <span className="text-[9px]">apr</span>
                </span>
              </div>
              <Eye className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            </button>
          ))}
          {team.corretores.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">Nenhum corretor vinculado</p>
          )}
        </div>

        <div className="p-3 border-t border-border/50 bg-white/40 flex items-center justify-between text-[10px] text-muted-foreground">
          <span><strong className="text-foreground">{team.totals.ligacoes}</strong> ligações hoje</span>
          <span><strong className="text-foreground">{team.totals.visitas}</strong> visitas semana</span>
          {team.totals.vgv > 0 && (
            <span><strong className="text-foreground">R$ {(team.totals.vgv / 1000).toFixed(0)}k</strong> VGV mês</span>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground">Carregando estrutura...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Colaboradores</p>
          <p className="text-2xl font-black text-foreground mt-1">{totalColab}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Gerentes Ativos</p>
          <p className="text-2xl font-black text-foreground mt-1">{totalGerentes}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Corretores Ativos</p>
          <p className="text-2xl font-black text-foreground mt-1">{totalCorretores}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Administrativo</p>
          <p className="text-2xl font-black text-foreground mt-1">{totalAdmin}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Online Hoje</p>
          <p className="text-2xl font-black text-green-600 mt-1">{totalAtivos}</p>
        </div>
      </div>

      {/* Refresh */}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={loadData}>
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* Section: Times Comerciais */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Times Comerciais</h3>
        </div>

        {isMobile ? (
          <Accordion type="single" collapsible className="space-y-3">
            {teams.map((team, i) => (
              <AccordionItem key={team.gerente_id} value={team.gerente_id} className="border-none">
                <AccordionTrigger className={`rounded-xl px-4 py-3 ${TEAM_COLORS[i % TEAM_COLORS.length].bg} ${TEAM_COLORS[i % TEAM_COLORS.length].border} border hover:no-underline`}>
                  <div className="flex items-center gap-2">
                    {renderAvatar(team.gerente_avatar, team.gerente_avatar_gamificado, team.gerente_nome)}
                    <span className="font-semibold text-sm">{team.gerente_nome}</span>
                    <Badge variant="secondary" className="text-[10px] h-5">{team.corretores.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <TeamCard team={team} colorIdx={i} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className={`grid gap-4 ${teams.length === 1 ? "grid-cols-1" : teams.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {teams.map((team, i) => (
              <TeamCard key={team.gerente_id} team={team} colorIdx={i} />
            ))}
          </div>
        )}
      </div>

      {/* Section: Administrativo */}
      {adminStaff.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 mt-6">
            <Briefcase className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Administrativo</h3>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {adminStaff.map(staff => (
              <div key={staff.user_id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  {renderAvatar(staff.avatar_url, staff.avatar_gamificado_url, staff.nome, "md")}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{staff.nome}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {ADMIN_BADGES.map(b => (
                        <span key={b.label} className={`inline-flex items-center text-[10px] font-medium rounded-full px-2 py-0.5 border ${b.className}`}>
                          {b.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail drawer */}
      <Sheet open={!!detailCorretor} onOpenChange={() => setDetailCorretor(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{detailCorretor?.nome}</SheetTitle>
          </SheetHeader>
          {detailCorretor && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-4">
                {renderAvatar(detailCorretor.avatar_url, detailCorretor.avatar_gamificado_url, detailCorretor.nome, "md")}
                <div>
                  <p className="font-semibold text-lg text-foreground">{detailCorretor.nome}</p>
                  <p className="text-sm text-muted-foreground">{detailCorretor.cargo || "Corretor"}</p>
                  <div className={`mt-1 flex items-center gap-1.5 text-xs ${detailCorretor.ativo_hoje ? "text-green-600" : "text-muted-foreground"}`}>
                    <div className={`h-2 w-2 rounded-full ${detailCorretor.ativo_hoje ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                    {detailCorretor.ativo_hoje ? "Online hoje" : "Sem atividade hoje"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground font-medium">Ligações Hoje</p>
                  <p className="text-2xl font-black text-foreground">{detailCorretor.ligacoes_hoje}</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground font-medium">Aproveitados</p>
                  <p className="text-2xl font-black text-green-600">{detailCorretor.aproveitados_hoje}</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground font-medium">Visitas Semana</p>
                  <p className="text-2xl font-black text-foreground">{detailCorretor.visitas_semana}</p>
                </div>
              </div>
              {detailCorretor.ligacoes_hoje > 0 && (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Taxa de Aproveitamento</p>
                  <p className="text-lg font-bold text-foreground">
                    {((detailCorretor.aproveitados_hoje / detailCorretor.ligacoes_hoje) * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
