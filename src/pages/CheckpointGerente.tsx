import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Target, ClipboardList, CheckCircle2, BarChart2, AlertCircle, Loader2, Pencil, Save } from "lucide-react";
import { format, subDays, getDaysInMonth, getDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import CheckpointCards from "@/components/checkpoint/CheckpointCards";
import AproveitadosTab from "@/components/checkpoint/AproveitadosTab";
import RelatoriosTab from "@/components/checkpoint/RelatoriosTab";


import CheckpointVisaoGeralTab from "@/components/checkpoint/CheckpointVisaoGeralTab";
import CeoCheckpointViewer from "@/components/ceo/CeoCheckpointViewer";

// ─── TYPES ───
export interface CheckpointRow {
  corretor_id: string;
  nome: string;
  presenca: "presente" | "ausente" | "meio_periodo" | "atestado" | "folga" | "nao_informado";
  meta_ligacoes: number;
  meta_aproveitados: number;
  meta_visitas_marcar: number;
  obs_gerente: string;
  res_ligacoes: number;
  res_aproveitados: number;
  res_visitas_marcadas: number;
  res_visitas_realizadas: number;
  res_propostas: number;
  res_vgv: number;
  obs_dia: string;
  status: "ok" | "parcial" | "pendente" | "zero" | "ausente_status";
}

export interface MetasMes {
  vgv_meta: number;
  vgv_realizado: number;
  visitas_marcadas_meta: number;
  visitas_marcadas_realizado: number;
  visitas_realizadas_meta: number;
  visitas_realizadas_realizado: number;
  ligacoes_meta: number;
  ligacoes_realizado: number;
}

// ─── HELPERS ───
export const calcStatus = (row: CheckpointRow, published: boolean): CheckpointRow["status"] => {
  if (["ausente", "atestado", "folga"].includes(row.presenca)) return "ausente_status";
  const hasAnyResult = row.res_ligacoes > 0 || row.res_aproveitados > 0 || row.res_visitas_marcadas > 0 || row.res_visitas_realizadas > 0 || row.res_propostas > 0;
  if (!hasAnyResult) {
    return published ? "zero" : "pendente";
  }
  const metrics: number[] = [];
  if (row.meta_ligacoes > 0) metrics.push(row.res_ligacoes / row.meta_ligacoes);
  if (row.meta_aproveitados > 0) metrics.push(row.res_aproveitados / row.meta_aproveitados);
  if (row.meta_visitas_marcar > 0) metrics.push(row.res_visitas_marcadas / row.meta_visitas_marcar);
  if (metrics.length === 0) return "ok";
  const avg = metrics.reduce((a, b) => a + b, 0) / metrics.length;
  if (avg >= 0.8) return "ok";
  return "parcial";
};

export const pct = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100);
export const fmt = (n: number) => n.toLocaleString("pt-BR");
export const fmtR = (n: number) => `R$ ${n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : n >= 1_000 ? (n / 1_000).toFixed(0) + "k" : n}`;

// ─── MAIN ───
export default function CheckpointGerente() {
  const { user } = useAuth();
  const { isGestor, isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"visao_geral" | "checkpoint" | "relatorios">("visao_geral");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [checkpointStatus, setCheckpointStatus] = useState<"aberto" | "publicado">("aberto");
  const [rows, setRows] = useState<CheckpointRow[]>([]);
  const [metasMes, setMetasMes] = useState<MetasMes>({
    vgv_meta: 3_000_000, vgv_realizado: 0,
    visitas_marcadas_meta: 200, visitas_marcadas_realizado: 0,
    visitas_realizadas_meta: 100, visitas_realizadas_realizado: 0,
    ligacoes_meta: 680, ligacoes_realizado: 0,
  });
   const [saving, setSaving] = useState(false);
   const [syncing, setSyncing] = useState(false);
   const [teamUserIds, setTeamUserIds] = useState<string[]>([]);
   const [teamNameMap, setTeamNameMap] = useState<Record<string, string>>({});
   const [editingMetas, setEditingMetas] = useState(false);
   const [savingMetas, setSavingMetas] = useState(false);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const dateFmt = format(selectedDate, "dd/MM/yyyy");

  // ─── AUTH GUARD ───
  useEffect(() => {
    if (roleLoading) return;
    if (!isGestor && !isAdmin) navigate("/corretor", { replace: true });
  }, [isGestor, isAdmin, roleLoading, navigate]);

  // ─── LOAD TEAM ───
  useEffect(() => {
    if (!user) return;
    supabase.from("team_members").select("id, user_id, nome").eq("gerente_id", user.id).eq("status", "ativo").then(({ data }) => {
      const members = data || [];
      const ids = members.map(m => m.user_id).filter(Boolean) as string[];
      const nameMap: Record<string, string> = {};
      members.forEach(m => { if (m.user_id) nameMap[m.user_id] = m.nome; });
      setTeamUserIds(ids);
      setTeamNameMap(nameMap);
    });
  }, [user]);

  // ─── LOAD CHECKPOINT ───
  const loadCheckpoint = useCallback(async () => {
    if (teamUserIds.length === 0) { setRows([]); return; }

    // Resolve profiles.id for each team member to check roleta credenciamentos
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, user_id")
      .in("user_id", teamUserIds);
    const userToProfileId = new Map<string, string>();
    const profileToUserId = new Map<string, string>();
    (profilesData || []).forEach((p: any) => {
      if (p.user_id && p.id) {
        userToProfileId.set(p.user_id, p.id);
        profileToUserId.set(p.id, p.user_id);
      }
    });
    const profileIds = Array.from(userToProfileId.values());

    const [{ data: saved }, { data: tentativas }, { data: visitasMarcadas }, { data: visitasRealizadas }, { data: corretorGoals }, { data: credenciamentos }, { data: disponibilidades }] = await Promise.all([
      supabase.from("checkpoint_diario").select("*").eq("data", dateStr).in("corretor_id", teamUserIds),
      supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado").in("corretor_id", teamUserIds).gte("created_at", `${dateStr}T00:00:00`).lte("created_at", `${dateStr}T23:59:59`),
      supabase.from("visitas").select("corretor_id").in("corretor_id", teamUserIds).eq("data_visita", dateStr),
      supabase.from("visitas").select("corretor_id").in("corretor_id", teamUserIds).eq("data_visita", dateStr).eq("status", "realizada"),
      supabase.from("corretor_daily_goals").select("corretor_id, meta_ligacoes, meta_aproveitados, meta_visitas_marcadas, status").in("corretor_id", teamUserIds).eq("data", dateStr),
      profileIds.length > 0
        ? supabase.from("roleta_credenciamentos").select("corretor_id, status").eq("data", dateStr).in("corretor_id", profileIds)
        : Promise.resolve({ data: [] }),
      supabase.from("corretor_disponibilidade").select("user_id, status").in("user_id", teamUserIds),
    ]);

    // Set of user_ids that are "online" (na empresa) via disponibilidade
    const presentByDisponibilidade = new Set<string>();
    (disponibilidades || []).forEach((d: any) => {
      if (d.user_id && d.status === "online") presentByDisponibilidade.add(d.user_id);
    });

    // Set of user_ids that have an approved/pendente credenciamento (means they declared presence)
    const presentByRoleta = new Set<string>();
    (credenciamentos || []).forEach((c: any) => {
      if (c.corretor_id && (c.status === "aprovado" || c.status === "pendente")) {
        const uid = profileToUserId.get(c.corretor_id);
        if (uid) presentByRoleta.add(uid);
      }
    });

    const savedMap: Record<string, any> = {};
    saved?.forEach((s: any) => { savedMap[s.corretor_id] = s; });

    // Corretor self-set goals map
    const goalsMap: Record<string, any> = {};
    corretorGoals?.forEach((g: any) => { goalsMap[g.corretor_id] = g; });

    const oaLig: Record<string, number> = {};
    const oaAprov: Record<string, number> = {};
    tentativas?.forEach((t: any) => {
      oaLig[t.corretor_id] = (oaLig[t.corretor_id] || 0) + 1;
      if (t.resultado === "com_interesse") oaAprov[t.corretor_id] = (oaAprov[t.corretor_id] || 0) + 1;
    });

    const vmCount: Record<string, number> = {};
    visitasMarcadas?.forEach((v: any) => { vmCount[v.corretor_id] = (vmCount[v.corretor_id] || 0) + 1; });
    const vrCount: Record<string, number> = {};
    visitasRealizadas?.forEach((v: any) => { vrCount[v.corretor_id] = (vrCount[v.corretor_id] || 0) + 1; });

    const anyPublished = saved?.some((s: any) => s.publicado);
    const isPublished = !!anyPublished;
    setCheckpointStatus(isPublished ? "publicado" : "aberto");

    const newRows: CheckpointRow[] = teamUserIds.map(uid => {
      const s = savedMap[uid];
      const g = goalsMap[uid];
      const hadActivity = (oaLig[uid] || 0) > 0;
      const hadRoletaPresence = presentByRoleta.has(uid);
      // Auto-detect presence: disponibilidade online OR roleta credenciamento OR OA activity → presente
      let presenca: CheckpointRow["presenca"] = s?.presenca ?? "nao_informado";
      if (presenca === "nao_informado" && (hadActivity || hadRoletaPresence || presentByDisponibilidade.has(uid))) presenca = "presente";
      // Map legacy values
      if ((presenca as string) === "home_office") presenca = "presente";

      // Auto-fill metas: use saved checkpoint value, fallback to corretor daily goals
      const metaLig = (s?.meta_ligacoes > 0) ? s.meta_ligacoes : (g?.meta_ligacoes ?? 0);
      const metaAprov = (s?.meta_aproveitados > 0) ? s.meta_aproveitados : (g?.meta_aproveitados ?? 0);
      const metaVm = (s?.meta_visitas_marcar > 0) ? s.meta_visitas_marcar : (g?.meta_visitas_marcadas ?? 0);

      const row: CheckpointRow = {
        corretor_id: uid,
        nome: teamNameMap[uid] || "Corretor",
        presenca,
        meta_ligacoes: metaLig,
        meta_aproveitados: metaAprov,
        meta_visitas_marcar: metaVm,
        obs_gerente: s?.obs_gerente ?? "",
        res_ligacoes: oaLig[uid] ?? s?.res_ligacoes ?? 0,
        res_aproveitados: oaAprov[uid] ?? s?.res_aproveitados ?? 0,
        res_visitas_marcadas: vmCount[uid] ?? s?.res_visitas_marcadas ?? 0,
        res_visitas_realizadas: vrCount[uid] ?? s?.res_visitas_realizadas ?? 0,
        res_propostas: s?.res_propostas ?? 0,
        res_vgv: s?.res_vgv ?? 0,
        obs_dia: s?.obs_dia ?? "",
        status: "pendente",
      };
      row.status = calcStatus(row, isPublished);
      return row;
    });

    setRows(newRows);
  }, [dateStr, teamUserIds, teamNameMap]);

  // ─── LOAD METAS MÊS ───
  const loadMetasMes = useCallback(async () => {
    if (!user || teamUserIds.length === 0) return;
    const mesAtual = format(new Date(), "yyyy-MM");
    const mesInicio = `${mesAtual}-01`;
    const mesFim = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd");

    // Resolve profile IDs for team members (negocios.corretor_id may use profiles.id)
    const { data: teamProfiles } = await supabase
      .from("profiles")
      .select("id, user_id")
      .in("user_id", teamUserIds);
    const teamProfileIds = (teamProfiles || []).map(p => p.id).filter(Boolean);
    // Combine both auth user IDs and profile IDs to cover all creation paths
    const allCorretorIds = [...new Set([...teamUserIds, ...teamProfileIds])];

    const [{ count: ligR }, { count: vmR }, { count: vrR }, { data: negocios }, { data: metasSalvas }] = await Promise.all([
      supabase.from("oferta_ativa_tentativas").select("id", { count: "exact", head: true }).in("corretor_id", teamUserIds).gte("created_at", `${mesInicio}T00:00:00`).lte("created_at", `${mesFim}T23:59:59`),
      supabase.from("visitas").select("id", { count: "exact", head: true }).in("corretor_id", teamUserIds).gte("data_visita", mesInicio).lte("data_visita", mesFim),
      supabase.from("visitas").select("id", { count: "exact", head: true }).in("corretor_id", teamUserIds).gte("data_visita", mesInicio).lte("data_visita", mesFim).eq("status", "realizada"),
      supabase.from("negocios").select("id, vgv_estimado, vgv_final, fase, data_assinatura, corretor_id")
        .in("fase", ["assinado", "vendido"])
        .gte("data_assinatura", mesInicio).lte("data_assinatura", mesFim)
        .or(`corretor_id.in.(${allCorretorIds.join(",")}),gerente_id.eq.${user.id}`),
      supabase.from("ceo_metas_mensais").select("*").eq("gerente_id", user.id).eq("mes", mesAtual).maybeSingle(),
    ]);

    // Deduplicate by id in case of overlapping queries
    const uniqueNegocios = new Map<string, any>();
    (negocios || []).forEach((n: any) => uniqueNegocios.set(n.id, n));
    const vgvReal = [...uniqueNegocios.values()].reduce((s: number, n: any) => s + Number(n.vgv_final || n.vgv_estimado || 0), 0);

    setMetasMes({
      ligacoes_meta: (metasSalvas as any)?.meta_ligacoes || 680,
      ligacoes_realizado: ligR || 0,
      vgv_meta: (metasSalvas as any)?.meta_vgv_assinado || 3_000_000,
      vgv_realizado: vgvReal,
      visitas_marcadas_meta: (metasSalvas as any)?.meta_visitas_marcadas || 200,
      visitas_marcadas_realizado: vmR || 0,
      visitas_realizadas_meta: (metasSalvas as any)?.meta_visitas_realizadas || 100,
      visitas_realizadas_realizado: vrR || 0,
    });
  }, [user, teamUserIds]);

  const saveMetasMes = async () => {
    if (!user) return;
    setSavingMetas(true);
    const mesAtual = format(new Date(), "yyyy-MM");
    const { error } = await supabase.from("ceo_metas_mensais").upsert({
      gerente_id: user.id,
      mes: mesAtual,
      meta_ligacoes: metasMes.ligacoes_meta,
      meta_vgv_assinado: metasMes.vgv_meta,
      meta_visitas_marcadas: metasMes.visitas_marcadas_meta,
      meta_visitas_realizadas: metasMes.visitas_realizadas_meta,
    }, { onConflict: "gerente_id,mes" });
    setSavingMetas(false);
    if (error) toast({ title: "Erro ao salvar metas", variant: "destructive" });
    else { toast({ title: "✅ Metas salvas!" }); setEditingMetas(false); }
  };

  // ─── ACTIONS ───
  const syncOA = async () => { setSyncing(true); await loadCheckpoint(); setSyncing(false); toast({ title: "✅ Sincronizado!", description: "Dados da Oferta Ativa e Visitas atualizados." }); };

  const saveCheckpoint = async () => {
    setSaving(true);
    const upserts = rows.map(r => ({
      corretor_id: r.corretor_id, data: dateStr, presenca: r.presenca === "nao_informado" ? "presente" : r.presenca,
      meta_ligacoes: r.meta_ligacoes, meta_aproveitados: r.meta_aproveitados, meta_visitas_marcar: r.meta_visitas_marcar, obs_gerente: r.obs_gerente,
      res_ligacoes: r.res_ligacoes, res_aproveitados: r.res_aproveitados, res_visitas_marcadas: r.res_visitas_marcadas,
      res_visitas_realizadas: r.res_visitas_realizadas, res_propostas: r.res_propostas, res_vgv: r.res_vgv, obs_dia: r.obs_dia,
    }));
    const { error } = await supabase.from("checkpoint_diario").upsert(upserts, { onConflict: "corretor_id,data" });
    setSaving(false);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else toast({ title: "✅ Checkpoint salvo!" });
  };

  const copyFromYesterday = async () => {
    const yesterday = format(subDays(selectedDate, 1), "yyyy-MM-dd");
    const { data } = await supabase.from("checkpoint_diario").select("*").eq("data", yesterday).in("corretor_id", teamUserIds);
    if (!data || data.length === 0) { toast({ title: "Nenhum dado ontem para copiar.", variant: "destructive" }); return; }
    const map: Record<string, any> = {};
    data.forEach((d: any) => { map[d.corretor_id] = d; });
    setRows(prev => prev.map(r => { const y = map[r.corretor_id]; if (!y) return r; return { ...r, meta_ligacoes: y.meta_ligacoes, meta_aproveitados: y.meta_aproveitados, meta_visitas_marcar: y.meta_visitas_marcar }; }));
    toast({ title: "📋 Metas copiadas de ontem!" });
  };

  const zeroResults = () => { setRows(prev => prev.map(r => ({ ...r, res_ligacoes: 0, res_aproveitados: 0, res_visitas_marcadas: 0, res_visitas_realizadas: 0, res_propostas: 0, res_vgv: 0 }))); };

  const publish = async () => {
    await saveCheckpoint();
    await supabase.from("checkpoint_diario").update({ publicado: true }).eq("data", dateStr).in("corretor_id", teamUserIds);
    setCheckpointStatus("publicado");
    // Recalc status after publish
    setRows(prev => prev.map(r => ({ ...r, status: calcStatus(r, true) })));
    toast({ title: "🔒 Checkpoint publicado!", description: "Time notificado." });
  };

  const updateRow = (id: string, field: keyof CheckpointRow, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.corretor_id !== id) return r;
      const updated = { ...r, [field]: value };
      updated.status = calcStatus(updated, checkpointStatus === "publicado");
      return updated;
    }));
  };

  // ─── EFFECTS ───
  useEffect(() => { if (teamUserIds.length > 0) loadCheckpoint(); }, [loadCheckpoint, teamUserIds]);
  useEffect(() => { if (teamUserIds.length > 0) loadMetasMes(); }, [loadMetasMes, teamUserIds]);

  // ─── COMPUTED ───
  const pendentes = rows.filter(r => {
    const hasResult = r.res_ligacoes > 0 || r.res_aproveitados > 0 || r.res_visitas_marcadas > 0 || r.res_visitas_realizadas > 0 || r.res_propostas > 0;
    return !hasResult && !["ausente", "atestado", "folga"].includes(r.presenca);
  }).map(r => r.nome);

  const totalLig = rows.reduce((a, r) => a + r.res_ligacoes, 0);
  const totalAprov = rows.reduce((a, r) => a + r.res_aproveitados, 0);
  const totalVm = rows.reduce((a, r) => a + r.res_visitas_marcadas, 0);
  const presentes = rows.filter(r => !["ausente", "atestado", "folga", "nao_informado"].includes(r.presenca)).length;

  // ─── PROJECTION ───
  const hoje = new Date();
  const diasPassados = getDate(hoje);
  const diasNoMes = getDaysInMonth(hoje);
  const projecao = (valor: number) => diasPassados > 0 ? Math.round((valor / diasPassados) * diasNoMes) : 0;

  if (roleLoading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-muted/30 pb-12">
        <div className="bg-card border-b border-border px-6 py-5">
          <h1 className="text-2xl font-bold text-foreground">Checkpoint <span className="text-primary">CEO</span></h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão consolidada de todos os times</p>
        </div>
        <div className="max-w-screen-xl mx-auto px-4 mt-5">
          <CeoCheckpointViewer />
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "visao_geral" as const, icon: <Target size={15} />, label: "Visão Geral" },
    { key: "checkpoint" as const, icon: <ClipboardList size={15} />, label: "Checkpoint" },
    { key: "relatorios" as const, icon: <BarChart2 size={15} />, label: "Relatórios" },
  ];

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <div className="bg-card border-b border-border px-6 py-5">
        <h1 className="text-2xl font-bold text-foreground">Central do <span className="text-primary">Gerente</span></h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gestão diária do time comercial com metas, resultados e IA</p>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 mt-5 space-y-4">

        {/* METAS DO MÊS */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-primary" />
              <span className="font-semibold text-foreground">Metas do Mês —</span>
              <span className="text-primary font-semibold">
                {format(new Date(), "MMMM/yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
              </span>
            </div>
            {editingMetas ? (
              <button onClick={saveMetasMes} disabled={savingMetas} className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                <Save size={14} /> {savingMetas ? "Salvando..." : "Salvar Metas"}
              </button>
            ) : (
              <button onClick={() => setEditingMetas(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Pencil size={13} /> Editar Metas
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              { label: "Ligações", atual: metasMes.ligacoes_realizado, meta: metasMes.ligacoes_meta, cor: "bg-blue-500", money: false, metaKey: "ligacoes_meta" as const },
              { label: "VGV Assinado", atual: metasMes.vgv_realizado, meta: metasMes.vgv_meta, cor: "bg-emerald-500", money: true, metaKey: "vgv_meta" as const },
              { label: "Visitas Marcadas", atual: metasMes.visitas_marcadas_realizado, meta: metasMes.visitas_marcadas_meta, cor: "bg-amber-500", money: false, metaKey: "visitas_marcadas_meta" as const },
              { label: "Visitas Realizadas", atual: metasMes.visitas_realizadas_realizado, meta: metasMes.visitas_realizadas_meta, cor: "bg-purple-500", money: false, metaKey: "visitas_realizadas_meta" as const },
            ]).map(({ label, atual, meta, cor, money, metaKey }) => {
              const p = pct(atual, meta);
              const icon = p >= 100 ? "🏆" : p < 20 ? "❌" : p < 50 ? "⚠️" : "";
              const textColor = p >= 100 ? "text-green-600" : p < 20 ? "text-red-500" : p < 50 ? "text-amber-500" : "text-green-500";
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className={`text-xs font-bold ${textColor} flex items-center gap-1`}>
                      {icon && <span>{icon}</span>} ↗ {p}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${cor} rounded-full transition-all`} style={{ width: `${Math.min(p, 100)}%` }} />
                  </div>
                  {editingMetas ? (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-muted-foreground">{money ? fmtR(atual) : fmt(atual)} /</span>
                      <input
                        type="number"
                        value={meta}
                        onChange={(e) => setMetasMes(prev => ({ ...prev, [metaKey]: Number(e.target.value) }))}
                        className="w-20 text-xs border border-border rounded px-1.5 py-0.5 bg-background text-foreground"
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      {money ? `${fmtR(atual)} / ${fmtR(meta)}` : `${fmt(atual)} / ${fmt(meta)}`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Projeção do Mês */}
          <div className="mt-4 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              📅 <span className="font-medium text-foreground">Projeção do mês</span> (mantendo este ritmo):
              {(() => {
                const projLig = projecao(metasMes.ligacoes_realizado);
                const projVgv = projecao(metasMes.vgv_realizado);
                const projVm = projecao(metasMes.visitas_marcadas_realizado);
                const projVr = projecao(metasMes.visitas_realizadas_realizado);
                return (
                  <span className="ml-1 flex items-center gap-3 flex-wrap">
                    <span>Ligações: <span className={projLig >= metasMes.ligacoes_meta ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>{projLig >= metasMes.ligacoes_meta ? "✅ meta batida" : `❌ ${fmt(projLig)}`}</span></span>
                    <span>VGV: <span className={projVgv >= metasMes.vgv_meta ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>{projVgv >= metasMes.vgv_meta ? "✅ meta batida" : `❌ ${fmtR(projVgv)} (meta em risco)`}</span></span>
                    <span>V.Marc: <span className={projVm >= metasMes.visitas_marcadas_meta ? "text-green-600 font-semibold" : "text-amber-500 font-semibold"}>{projVm >= metasMes.visitas_marcadas_meta ? "✅" : `⚠️ ${fmt(projVm)}`}</span></span>
                    <span>V.Real: <span className={projVr >= metasMes.visitas_realizadas_meta ? "text-green-600 font-semibold" : "text-amber-500 font-semibold"}>{projVr >= metasMes.visitas_realizadas_meta ? "✅" : `⚠️ ${fmt(projVr)}`}</span></span>
                  </span>
                );
              })()}
            </p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex border-b border-border bg-card rounded-t-xl overflow-hidden">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.key
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "visao_geral" && (
          <CheckpointVisaoGeralTab teamUserIds={teamUserIds} teamNameMap={teamNameMap} />
        )}

        {activeTab === "checkpoint" && (
          <CheckpointCards teamUserIds={teamUserIds} teamNameMap={teamNameMap} />
        )}


        {activeTab === "relatorios" && (
          <RelatoriosTab teamUserIds={teamUserIds} teamNameMap={teamNameMap} />
        )}

      </div>
    </div>
  );
}
