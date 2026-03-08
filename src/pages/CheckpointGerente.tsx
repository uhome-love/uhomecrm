import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Target, ClipboardList, CheckCircle2, BarChart2, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import CheckpointTableTab from "@/components/checkpoint/CheckpointTableTab";
import AproveitadosTab from "@/components/checkpoint/AproveitadosTab";
import RelatoriosTab from "@/components/checkpoint/RelatoriosTab";
import CoachIATab from "@/components/checkpoint/CoachIATab";
import CeoCheckpointViewer from "@/components/ceo/CeoCheckpointViewer";

// ─── TYPES ───
export interface CheckpointRow {
  corretor_id: string;
  nome: string;
  presenca: "presente" | "ausente" | "home_office";
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
  status: "ok" | "atencao" | "critico" | "pendente";
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
export const calcStatus = (row: CheckpointRow): CheckpointRow["status"] => {
  if (row.presenca === "ausente") return "critico";
  const hasAnyResult = row.res_ligacoes > 0 || row.res_aproveitados > 0 || row.res_visitas_marcadas > 0 || row.res_visitas_realizadas > 0 || row.res_propostas > 0;
  if (!hasAnyResult && row.meta_ligacoes > 0) return "pendente";
  const metrics: number[] = [];
  if (row.meta_ligacoes > 0) metrics.push(row.res_ligacoes / row.meta_ligacoes);
  if (row.meta_aproveitados > 0) metrics.push(row.res_aproveitados / row.meta_aproveitados);
  if (row.meta_visitas_marcar > 0) metrics.push(row.res_visitas_marcadas / row.meta_visitas_marcar);
  if (metrics.length === 0) return hasAnyResult ? "ok" : "pendente";
  const avg = metrics.reduce((a, b) => a + b, 0) / metrics.length;
  if (avg >= 0.8) return "ok";
  if (avg >= 0.5) return "atencao";
  return "critico";
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

  const [activeTab, setActiveTab] = useState<"checkpoint" | "aproveitados" | "relatorios" | "coach">("checkpoint");
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

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const dateFmt = format(selectedDate, "dd/MM/yyyy");

  // ─── AUTH GUARD ───
  useEffect(() => {
    if (roleLoading) return;
    if (isAdmin) { navigate("/ceo?tab=checkpoints", { replace: true }); return; }
    if (!isGestor) navigate("/corretor", { replace: true });
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

    const [{ data: saved }, { data: tentativas }, { data: visitasMarcadas }, { data: visitasRealizadas }] = await Promise.all([
      supabase.from("checkpoint_diario").select("*").eq("data", dateStr).in("corretor_id", teamUserIds),
      supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado").in("corretor_id", teamUserIds).gte("created_at", `${dateStr}T00:00:00`).lte("created_at", `${dateStr}T23:59:59`),
      supabase.from("visitas").select("corretor_id").in("corretor_id", teamUserIds).eq("data_visita", dateStr),
      supabase.from("visitas").select("corretor_id").in("corretor_id", teamUserIds).eq("data_visita", dateStr).eq("status", "realizada"),
    ]);

    const savedMap: Record<string, any> = {};
    saved?.forEach((s: any) => { savedMap[s.corretor_id] = s; });

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

    // Check published status
    const anyPublished = saved?.some((s: any) => s.publicado);
    setCheckpointStatus(anyPublished ? "publicado" : "aberto");

    const newRows: CheckpointRow[] = teamUserIds.map(uid => {
      const s = savedMap[uid];
      const row: CheckpointRow = {
        corretor_id: uid,
        nome: teamNameMap[uid] || "Corretor",
        presenca: s?.presenca ?? "presente",
        meta_ligacoes: s?.meta_ligacoes ?? 0,
        meta_aproveitados: s?.meta_aproveitados ?? 0,
        meta_visitas_marcar: s?.meta_visitas_marcar ?? 0,
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
      row.status = calcStatus(row);
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

    const [{ count: ligR }, { count: vmR }, { count: vrR }, { data: negocios }] = await Promise.all([
      supabase.from("oferta_ativa_tentativas").select("id", { count: "exact", head: true }).in("corretor_id", teamUserIds).gte("created_at", `${mesInicio}T00:00:00`).lte("created_at", `${mesFim}T23:59:59`),
      supabase.from("visitas").select("id", { count: "exact", head: true }).in("corretor_id", teamUserIds).gte("data_visita", mesInicio).lte("data_visita", mesFim),
      supabase.from("visitas").select("id", { count: "exact", head: true }).in("corretor_id", teamUserIds).gte("data_visita", mesInicio).lte("data_visita", mesFim).eq("status", "realizada"),
      supabase.from("negocios").select("vgv_estimado, fase").eq("gerente_id", user.id).gte("created_at", `${mesInicio}T00:00:00`),
    ]);

    const vgvReal = (negocios || []).filter(n => n.fase === "assinado").reduce((s, n) => s + Number(n.vgv_estimado || 0), 0);

    setMetasMes(prev => ({
      ...prev,
      ligacoes_realizado: ligR || 0,
      visitas_marcadas_realizado: vmR || 0,
      visitas_realizadas_realizado: vrR || 0,
      vgv_realizado: vgvReal,
    }));
  }, [user, teamUserIds]);

  // ─── ACTIONS ───
  const syncOA = async () => { setSyncing(true); await loadCheckpoint(); setSyncing(false); toast({ title: "✅ Sincronizado!", description: "Dados da Oferta Ativa e Visitas atualizados." }); };

  const saveCheckpoint = async () => {
    setSaving(true);
    const upserts = rows.map(r => ({
      corretor_id: r.corretor_id, data: dateStr, presenca: r.presenca,
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
    setRows(prev => prev.map(r => { const y = map[r.corretor_id]; if (!y) return r; return { ...r, meta_ligacoes: y.meta_ligacoes, meta_aproveitados: y.meta_aproveitados, meta_visitas_marcar: y.meta_visitas_marcar, presenca: y.presenca }; }));
    toast({ title: "📋 Metas copiadas de ontem!" });
  };

  const zeroResults = () => { setRows(prev => prev.map(r => ({ ...r, res_ligacoes: 0, res_aproveitados: 0, res_visitas_marcadas: 0, res_visitas_realizadas: 0, res_propostas: 0, res_vgv: 0 }))); };

  const publish = async () => {
    await saveCheckpoint();
    await supabase.from("checkpoint_diario").update({ publicado: true }).eq("data", dateStr).in("corretor_id", teamUserIds);
    setCheckpointStatus("publicado");
    toast({ title: "🔒 Checkpoint publicado!", description: "Time notificado." });
  };

  const updateRow = (id: string, field: keyof CheckpointRow, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.corretor_id !== id) return r;
      const updated = { ...r, [field]: value };
      updated.status = calcStatus(updated);
      return updated;
    }));
  };

  // ─── EFFECTS ───
  useEffect(() => { if (teamUserIds.length > 0) loadCheckpoint(); }, [loadCheckpoint, teamUserIds]);
  useEffect(() => { if (teamUserIds.length > 0) loadMetasMes(); }, [loadMetasMes, teamUserIds]);

  // ─── COMPUTED ───
  const pendentes = rows.filter(r => {
    const hasResult = r.res_ligacoes > 0 || r.res_aproveitados > 0 || r.res_visitas_marcadas > 0 || r.res_visitas_realizadas > 0 || r.res_propostas > 0;
    return !hasResult && r.presenca !== "ausente";
  }).map(r => r.nome);

  const totalLig = rows.reduce((a, r) => a + r.res_ligacoes, 0);
  const totalAprov = rows.reduce((a, r) => a + r.res_aproveitados, 0);
  const totalVm = rows.reduce((a, r) => a + r.res_visitas_marcadas, 0);
  const presentes = rows.filter(r => r.presenca !== "ausente").length;

  if (roleLoading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const tabs = [
    { key: "checkpoint" as const, icon: <ClipboardList size={15} />, label: "Checkpoint" },
    { key: "aproveitados" as const, icon: <CheckCircle2 size={15} />, label: "Aproveitados" },
    { key: "relatorios" as const, icon: <BarChart2 size={15} />, label: "Relatórios" },
    { key: "coach" as const, icon: <Sparkles size={15} />, label: "Coach IA" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Checkpoint do <span className="text-blue-600">Gerente</span></h1>
        <p className="text-sm text-gray-500 mt-0.5">Gestão diária do time comercial com metas, resultados e IA</p>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 mt-5 space-y-4">
        {/* ALERTA PENDENTES */}
        {pendentes.length > 0 && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertCircle className="text-amber-500 mt-0.5 shrink-0" size={18} />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                📋 {rows.length - pendentes.length}/{rows.length} corretores com resultados preenchidos
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                <span className="font-medium">Pendentes:</span> {pendentes.join(", ")}
              </p>
            </div>
          </div>
        )}

        {/* METAS DO MÊS */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} className="text-blue-500" />
            <span className="font-semibold text-gray-800">Metas do Mês —</span>
            <span className="text-blue-600 font-semibold">
              {format(new Date(), "MMMM/yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              { label: "Ligações", atual: metasMes.ligacoes_realizado, meta: metasMes.ligacoes_meta, cor: "bg-blue-500", money: false },
              { label: "VGV Assinado", atual: metasMes.vgv_realizado, meta: metasMes.vgv_meta, cor: "bg-green-500", money: true },
              { label: "Visitas Marcadas", atual: metasMes.visitas_marcadas_realizado, meta: metasMes.visitas_marcadas_meta, cor: "bg-amber-500", money: false },
              { label: "Visitas Realizadas", atual: metasMes.visitas_realizadas_realizado, meta: metasMes.visitas_realizadas_meta, cor: "bg-purple-500", money: false },
            ]).map(({ label, atual, meta, cor, money }) => {
              const p = pct(atual, meta);
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className={`text-xs font-bold ${p < 50 ? "text-red-500" : p < 80 ? "text-amber-500" : "text-green-500"}`}>
                      ↗ {p}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${cor} rounded-full transition-all`} style={{ width: `${Math.min(p, 100)}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {money ? `${fmtR(atual)} / ${fmtR(meta)}` : `${fmt(atual)} / ${fmt(meta)}`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* TABS */}
        <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.key
                  ? "border-blue-500 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        {activeTab === "checkpoint" && (
          <CheckpointTableTab
            rows={rows}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            dateFmt={dateFmt}
            checkpointStatus={checkpointStatus}
            totalLig={totalLig}
            totalAprov={totalAprov}
            totalVm={totalVm}
            presentes={presentes}
            syncing={syncing}
            saving={saving}
            onSync={syncOA}
            onCopyYesterday={copyFromYesterday}
            onZero={zeroResults}
            onSave={saveCheckpoint}
            onPublish={publish}
            onUpdateRow={updateRow}
          />
        )}

        {activeTab === "aproveitados" && (
          <AproveitadosTab teamUserIds={teamUserIds} teamNameMap={teamNameMap} />
        )}

        {activeTab === "relatorios" && (
          <RelatoriosTab teamUserIds={teamUserIds} teamNameMap={teamNameMap} />
        )}

        {activeTab === "coach" && (
          <CoachIATab rows={rows} metasMes={metasMes} dateFmt={dateFmt} />
        )}
      </div>
    </div>
  );
}
