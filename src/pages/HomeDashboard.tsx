import { useState, useEffect, useMemo, useCallback, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCeoData, pct, type CeoPeriod } from "@/hooks/useCeoData";
import { useMarketing, getCanalLabel } from "@/hooks/useMarketing";
import { useSmartAlerts } from "@/hooks/useSmartAlerts";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { motion } from "framer-motion";
import {
  TrendingUp, Users, Trophy, Target, BarChart3, AlertTriangle,
  CalendarDays, RotateCcw, ArrowRight, Building2, FileText, Eye, DollarSign,
  Megaphone, Flame, ArrowUpRight, Bell, AlertCircle, Info, ClipboardCheck,
} from "lucide-react";
const homiMascot = "/images/homi-mascot-opt.png";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import IaCoreAction from "@/components/IaCoreAction";

type Period = "dia" | "semana" | "mes";
const periodLabels: Record<Period, string> = { dia: "Hoje", semana: "Esta Semana", mes: "Este Mês" };
const medals = ["🥇", "🥈", "🥉"];

const getSaoPauloDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const getPeriodRange = (period: Period) => {
  const todaySP = getSaoPauloDate();
  const base = new Date(`${todaySP}T12:00:00-03:00`);

  let start = base;
  let end = base;

  if (period === "semana") {
    start = startOfWeek(base, { weekStartsOn: 1 });
    end = endOfWeek(base, { weekStartsOn: 1 });
  } else if (period === "mes") {
    start = startOfMonth(base);
    end = endOfMonth(base);
  }

  const startDate = format(start, "yyyy-MM-dd");
  const endDate = format(end, "yyyy-MM-dd");

  return {
    startDate,
    endDate,
    startTs: `${startDate}T00:00:00-03:00`,
    endTs: `${endDate}T23:59:59.999-03:00`,
  };
};

export default function HomeDashboard() {
  const { user } = useAuth();
  const { isAdmin, isGestor, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [period, setPeriod] = useState<Period>("semana");

  // Corretor should never see Centro de Comando — redirect to /corretor
  useEffect(() => {
    if (roleLoading) return; // Wait for roles to load before deciding
    if (!isAdmin && !isGestor) {
      navigate("/corretor", { replace: true });
    }
  }, [isAdmin, isGestor, roleLoading, navigate]);

  const filterGerenteId = isAdmin ? undefined : user?.id;
  const { gerentes, companyTotals, allCorretores, loading, reload } = useCeoData(period as CeoPeriod, undefined, undefined, filterGerenteId);
  const { channelStats, totals: mktTotals } = useMarketing();
  const { alerts: smartAlerts } = useSmartAlerts();

  // PDN full stats
  const [pdnStats, setPdnStats] = useState({
    propostas: 0, docs: 0, visitaRecente: 0,
    total_visitas: 0, quente: 0, morno: 0, frio: 0,
    total_gerados: 0, total_assinados: 0, total_caidos: 0,
    vgv_gerado: 0, vgv_assinado: 0, vgv_caido: 0,
  });
  // Lead recovery
  const [recovery, setRecovery] = useState({ reativados: 0, respondidos: 0, visitas: 0 });
  // Checkpoint daily stats + OA realtime
  const [cpStats, setCpStats] = useState({ total_checkpoints: 0, total_corretores: 0, presentes: 0, ausentes: 0, oa_ligacoes: 0, oa_aproveitados: 0, oa_visitas_marcadas: 0 });
  const [oaPeriodStats, setOaPeriodStats] = useState({ ligacoes: 0, visitas_marcadas: 0 });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.nome) setNome(data.nome.split(" ")[0]);
    });
  }, [user]);

  // Fetch PDN summary (strictly scoped by selected period)
  const fetchPdn = useCallback(async () => {
    if (!user) return;

    const { startDate, endDate } = getPeriodRange(period);

    let q = supabase
      .from("pdn_entries")
      .select("situacao, docs_status, data_visita, temperatura, vgv, motivo_queda")
      .gte("data_visita", startDate)
      .lte("data_visita", endDate);

    if (!isAdmin) q = q.eq("gerente_id", user.id);

    const { data } = await q;
    if (!data) return;

    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const visitas = data.filter(d => d.situacao === "visita");
    const gerados = data.filter(d => d.situacao === "gerado");
    const assinados = data.filter(d => d.situacao === "assinado");
    const caidos = data.filter(d => d.situacao === "caiu");

    setPdnStats({
      propostas: gerados.length + assinados.length,
      docs: visitas.filter(d => d.docs_status === "sem_docs" || d.docs_status === "em_andamento").length,
      visitaRecente: data.filter(d => d.data_visita && new Date(d.data_visita) >= fiveDaysAgo).length,
      total_visitas: visitas.length,
      quente: visitas.filter(d => d.temperatura === "quente").length,
      morno: visitas.filter(d => d.temperatura === "morno").length,
      frio: visitas.filter(d => d.temperatura === "frio").length,
      total_gerados: gerados.length,
      total_assinados: assinados.length,
      total_caidos: caidos.length,
      vgv_gerado: gerados.reduce((s, e) => s + Number(e.vgv || 0), 0),
      vgv_assinado: assinados.reduce((s, e) => s + Number(e.vgv || 0), 0),
      vgv_caido: caidos.reduce((s, e) => s + Number(e.vgv || 0), 0),
    });
  }, [user, isAdmin, period]);

  useEffect(() => { fetchPdn(); }, [fetchPdn]);

  const fetchOaPeriodStats = useCallback(async () => {
    if (!user) return;

    const { startTs, endTs } = getPeriodRange(period);

    let teamUserIds: string[] | undefined;
    if (!isAdmin) {
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("gerente_id", user.id)
        .eq("status", "ativo");

      teamUserIds = (teamMembers || []).map(t => t.user_id).filter(Boolean) as string[];
      if (teamUserIds.length === 0) {
        setOaPeriodStats({ ligacoes: 0, visitas_marcadas: 0 });
        return;
      }
    }

    let tentativasQuery = supabase
      .from("oferta_ativa_tentativas")
      .select("id")
      .gte("created_at", startTs)
      .lte("created_at", endTs);

    if (!isAdmin && teamUserIds) {
      tentativasQuery = tentativasQuery.in("corretor_id", teamUserIds);
    }

    let visitasMarcadasQuery = supabase
      .from("oa_events")
      .select("id")
      .eq("event_type", "call_finished")
      .gte("created_at", startTs)
      .lte("created_at", endTs)
      .contains("metadata", { visita_marcada: true });

    if (!isAdmin && teamUserIds) {
      visitasMarcadasQuery = visitasMarcadasQuery.in("user_id", teamUserIds);
    }

    const [{ data: tentativas }, { data: visitasMarcadas }] = await Promise.all([
      tentativasQuery,
      visitasMarcadasQuery,
    ]);

    setOaPeriodStats({
      ligacoes: (tentativas || []).length,
      visitas_marcadas: (visitasMarcadas || []).length,
    });
  }, [user, isAdmin, period]);

  useEffect(() => { fetchOaPeriodStats(); }, [fetchOaPeriodStats]);

  // Fetch checkpoint daily summary
  const fetchCheckpoint = useCallback(async () => {
    if (!user) return;
    const today = format(new Date(), "yyyy-MM-dd");

    // Explicit BRT (-03:00) day boundaries to match server-side timezone
    const startOfToday = `${today}T00:00:00-03:00`;
    const endOfToday = `${today}T23:59:59.999-03:00`;

    // Checkpoint data
    let cpQ = supabase.from("checkpoints").select("id").eq("data", today);
    if (!isAdmin) cpQ = cpQ.eq("gerente_id", user.id);
    const { data: cps } = await cpQ;
    const cpIds = (cps || []).map(c => c.id);

    let total = 0, presentes = 0;
    if (cpIds.length > 0) {
      const { data: lines } = await supabase.from("checkpoint_lines").select("real_presenca").in("checkpoint_id", cpIds);
      total = (lines || []).length;
      presentes = (lines || []).filter(l => l.real_presenca === "sim" || l.real_presenca === "presente").length;
    }

    // OA tentativas do dia — filter by team for gestor
    let oaQuery = supabase
      .from("oferta_ativa_tentativas")
      .select("resultado, corretor_id")
      .gte("created_at", startOfToday)
      .lte("created_at", endOfToday);

    // If gestor (not admin), restrict to team members only
    if (!isAdmin) {
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("gerente_id", user.id)
        .eq("status", "ativo");
      const teamUserIds = (teamMembers || []).map(t => t.user_id).filter(Boolean) as string[];
      if (teamUserIds.length > 0) {
        oaQuery = oaQuery.in("corretor_id", teamUserIds);
      } else {
        // No team members — zero out OA stats
        setCpStats({
          total_checkpoints: cps?.length || 0,
          total_corretores: total,
          presentes,
          ausentes: total - presentes,
          oa_ligacoes: 0,
          oa_aproveitados: 0,
          oa_visitas_marcadas: 0,
        });
        return;
      }
    }

    const { data: oaTentativas } = await oaQuery;

    const oa_ligacoes = (oaTentativas || []).length;
    const oa_aproveitados = (oaTentativas || []).filter(t => t.resultado === "com_interesse").length;

    // Count visitas marcadas from OA events (source of truth)
    let oaEventsQuery = supabase
      .from("oa_events")
      .select("id")
      .eq("event_type", "call_finished")
      .gte("created_at", startOfToday)
      .lte("created_at", endOfToday)
      .contains("metadata", { visita_marcada: true });

    if (!isAdmin) {
      const teamUserIds = (await supabase
        .from("team_members")
        .select("user_id")
        .eq("gerente_id", user.id)
        .eq("status", "ativo")).data?.map(t => t.user_id).filter(Boolean) as string[] || [];
      if (teamUserIds.length > 0) {
        oaEventsQuery = oaEventsQuery.in("user_id", teamUserIds);
      }
    }
    const { data: visitaEvents } = await oaEventsQuery;
    const oa_visitas_marcadas = (visitaEvents || []).length;

    setCpStats({
      total_checkpoints: cps?.length || 0,
      total_corretores: total,
      presentes,
      ausentes: total - presentes,
      oa_ligacoes,
      oa_aproveitados,
      oa_visitas_marcadas,
    });
  }, [user, isAdmin]);

  useEffect(() => { fetchCheckpoint(); }, [fetchCheckpoint]);

  // Realtime: auto-refresh with debounce to prevent event storms
  useEffect(() => {
    let pdnTimer: ReturnType<typeof setTimeout> | null = null;
    let cpTimer: ReturnType<typeof setTimeout> | null = null;
    const DEBOUNCE_PDN_MS = 1500;
    const DEBOUNCE_CP_MS = 500; // Faster for checkpoint — gestor expects near-instant feedback

    const debouncedPdn = () => {
      if (pdnTimer) clearTimeout(pdnTimer);
      pdnTimer = setTimeout(() => { fetchPdn(); reload(); }, DEBOUNCE_PDN_MS);
    };
    const debouncedCp = () => {
      if (cpTimer) clearTimeout(cpTimer);
      cpTimer = setTimeout(() => { reload(); fetchCheckpoint(); fetchOaPeriodStats(); }, DEBOUNCE_CP_MS);
    };

    const pdnChannel = supabase
      .channel("home-pdn-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pdn_entries" }, debouncedPdn)
      .subscribe();

    const cpChannel = supabase
      .channel("home-checkpoint-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "checkpoint_lines" }, debouncedCp)
      .on("postgres_changes", { event: "*", schema: "public", table: "checkpoints" }, debouncedCp)
      .on("postgres_changes", { event: "*", schema: "public", table: "oferta_ativa_tentativas" }, debouncedCp)
      .subscribe();

    return () => {
      if (pdnTimer) clearTimeout(pdnTimer);
      if (cpTimer) clearTimeout(cpTimer);
      supabase.removeChannel(pdnChannel);
      supabase.removeChannel(cpChannel);
    };
  }, [fetchPdn, fetchCheckpoint, fetchOaPeriodStats, reload]);

  // Fetch lead recovery
  useEffect(() => {
    if (!user) return;
    const fetchRecovery = async () => {
      const { data } = await supabase.from("leads").select("status_recuperacao, status").eq("user_id", user.id);
      if (!data) return;
      setRecovery({
        reativados: data.filter(d => d.status_recuperacao === "contatado" || d.status_recuperacao === "reativado").length,
        respondidos: data.filter(d => d.status === "respondido" || d.status === "reativado").length,
        visitas: data.filter(d => d.status === "visita_agendada").length,
      });
    };
    fetchRecovery();
  }, [user]);

  const sortedTimes = useMemo(() =>
    [...gerentes].sort((a, b) => b.totals.real_vgv_assinado - a.totals.real_vgv_assinado),
    [gerentes]
  );

  const topCorretores = useMemo(() =>
    [...allCorretores].sort((a, b) => b.real_vgv_assinado - a.real_vgv_assinado).slice(0, 5),
    [allCorretores]
  );

  // IA Alerts
  const alerts = useMemo(() => {
    const a: string[] = [];
    const avgCpl = mktTotals.leads > 0 ? mktTotals.investimento / mktTotals.leads : 0;
    channelStats.forEach(ch => {
      if (ch.cpl && ch.cpl > avgCpl * 1.5) a.push(`CPL elevado em ${getCanalLabel(ch.canal)}: R$ ${ch.cpl.toFixed(0)} (média R$ ${avgCpl.toFixed(0)})`);
    });
    gerentes.forEach(g => {
      if (g.totals.real_visitas_realizadas > 10 && g.totals.real_propostas < 2) {
        a.push(`Equipe ${g.gerente_nome}: muitas visitas (${g.totals.real_visitas_realizadas}) e poucas propostas (${g.totals.real_propostas})`);
      }
    });
    if (recovery.reativados > 0 && recovery.respondidos === 0) a.push("Leads reativados sem resposta — revisar abordagem");
    return a.slice(0, 5);
  }, [channelStats, mktTotals, gerentes, recovery]);

  const iaContext = useMemo(() => {
    const funil = `Funil: Ligações OA ${oaPeriodStats.ligacoes}, Visitas Marcadas OA ${oaPeriodStats.visitas_marcadas}, Visitas Realizadas PDN ${pdnStats.total_gerados + pdnStats.total_assinados}, Propostas PDN ${pdnStats.total_gerados + pdnStats.total_assinados}, VGV Assinado R$ ${pdnStats.vgv_assinado.toLocaleString("pt-BR")}`;
    const mkt = channelStats.map(c => `${getCanalLabel(c.canal)}: Inv R$ ${c.investimento.toLocaleString("pt-BR")}, Leads ${c.leads}, CPL R$ ${c.cpl?.toFixed(0) || "-"}`).join("; ");
    const teams = sortedTimes.map((t, i) => `${i + 1}. Equipe ${t.gerente_nome}: VGV R$ ${t.totals.real_vgv_assinado.toLocaleString("pt-BR")}, Propostas ${t.totals.real_propostas}`).join("; ");
    const pdnCtx = `PDN: ${pdnStats.total_visitas} negócios, ${pdnStats.quente} quentes, ${pdnStats.total_gerados} gerados (R$ ${pdnStats.vgv_gerado.toLocaleString("pt-BR")}), ${pdnStats.total_assinados} assinados (R$ ${pdnStats.vgv_assinado.toLocaleString("pt-BR")}), ${pdnStats.total_caidos} caídos (R$ ${pdnStats.vgv_caido.toLocaleString("pt-BR")})`;
    return `Período: ${periodLabels[period]}\n${funil}\n${pdnCtx}\nMarketing: ${mkt}\nTimes: ${teams}\nRecuperação: ${recovery.reativados} reativados, ${recovery.respondidos} respostas`;
  }, [oaPeriodStats, channelStats, sortedTimes, period, pdnStats, recovery]);

  const card = "rounded-xl border border-border bg-card shadow-card";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 overflow-hidden">
              <img src={homiMascot} alt="Homi" className="h-7 w-7 object-contain" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Centro de Comando</span>
          </div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">
            Olá{nome ? `, ${nome}` : ""}! 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "Visão consolidada da empresa" : "Visão da sua equipe"} • {periodLabels[period]}
          </p>
        </motion.div>
        <Select value={period} onValueChange={v => setPeriod(v as Period)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(periodLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando dados...</div>
      ) : (
        <div className="space-y-6">
          {/* 1. Funil Comercial */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={card}>
            <SectionHeader icon={TrendingUp} title="Funil Comercial" action={{ label: "Ver checkpoint", onClick: () => navigate("/checkpoint") }} />
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 p-4">
              <MetricCard label="Ligações OA" value={oaPeriodStats.ligacoes} />
              <MetricCard label="Visitas Marcadas" value={oaPeriodStats.visitas_marcadas} />
              <MetricCard label="Visitas Realizadas" value={pdnStats.total_gerados + pdnStats.total_assinados} sub="PDN: gerado + assinado" />
              <MetricCard label="Propostas (PDN)" value={pdnStats.total_gerados + pdnStats.total_assinados} sub="PDN: gerado + assinado" />
              <MetricCard label="VGV Gerado" value={`R$ ${(pdnStats.vgv_gerado / 1000).toFixed(0)}k`} />
              <MetricCard label="VGV Assinado" value={`R$ ${(pdnStats.vgv_assinado / 1000).toFixed(0)}k`} highlight />
              <MetricCard label="Atingimento" value={`${pct(pdnStats.vgv_assinado, companyTotals.meta_vgv_assinado)}%`} highlight />
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 2. Performance de Equipe */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={card}>
              <SectionHeader icon={Users} title="Performance de Equipe" action={{ label: "Ver ranking", onClick: () => navigate("/ranking") }} />
              <div className="divide-y divide-border">
                {sortedTimes.slice(0, 5).map((t, i) => (
                  <div key={t.gerente_id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-6 text-center text-sm">{i < 3 ? medals[i] : `${i + 1}º`}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">Equipe {t.gerente_nome}</p>
                      <p className="text-[10px] text-muted-foreground">{t.corretores.length} corretores</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-display font-bold">R$ {t.totals.real_vgv_assinado.toLocaleString("pt-BR")}</p>
                      <p className="text-[10px] text-muted-foreground">{t.totals.real_propostas} propostas</p>
                    </div>
                  </div>
                ))}
                {sortedTimes.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Sem dados</p>}
              </div>
            </motion.div>

            {/* 3. Ranking Corretores */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={card}>
              <SectionHeader icon={Trophy} title="Top Corretores" action={{ label: "Ver ranking", onClick: () => navigate("/ranking") }} />
              <div className="divide-y divide-border">
                {topCorretores.map((c, i) => (
                  <div key={c.corretor_id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-6 text-center text-sm">{i < 3 ? medals[i] : `${i + 1}º`}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{c.corretor_nome}</p>
                      <p className="text-[10px] text-muted-foreground">Equipe {c.gerente_nome}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-display font-bold">R$ {c.real_vgv_assinado.toLocaleString("pt-BR")}</p>
                      <p className="text-[10px] text-muted-foreground">Score {c.score}</p>
                    </div>
                  </div>
                ))}
                {topCorretores.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Sem dados</p>}
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
            {/* 4. Marketing */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={card}>
              <SectionHeader icon={Megaphone} title="Marketing" action={isAdmin ? { label: "Ver detalhes", onClick: () => navigate("/marketing") } : undefined} />
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="Investimento" value={`R$ ${(mktTotals.investimento / 1000).toFixed(0)}k`} />
                  <MiniStat label="Leads" value={`${mktTotals.leads}`} />
                  <MiniStat label="CPL" value={mktTotals.leads > 0 ? `R$ ${(mktTotals.investimento / mktTotals.leads).toFixed(0)}` : "—"} />
                </div>
                <div className="divide-y divide-border/50">
                  {channelStats.slice(0, 4).map(ch => (
                    <div key={ch.canal} className="flex items-center justify-between py-1.5 text-xs">
                      <span className="text-muted-foreground">{getCanalLabel(ch.canal)}</span>
                      <div className="flex items-center gap-3">
                        <span>{ch.leads} leads</span>
                        <span className="font-semibold">CPL R$ {ch.cpl?.toFixed(0) || "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* 5. Negócios Quentes */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={card}>
              <SectionHeader icon={Flame} title="PDN — Negócios" action={{ label: "Ver PDN", onClick: () => navigate("/pdn") }} />
              <div className="p-4 space-y-2">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center rounded-lg bg-muted/30 p-2">
                    <p className="text-lg font-display font-bold text-foreground">{pdnStats.total_visitas}</p>
                    <p className="text-[10px] text-muted-foreground">Negócios</p>
                  </div>
                  <div className="text-center rounded-lg bg-warning/10 p-2">
                    <p className="text-lg font-display font-bold text-warning">{pdnStats.total_gerados}</p>
                    <p className="text-[10px] text-muted-foreground">Gerados</p>
                  </div>
                  <div className="text-center rounded-lg bg-success/10 p-2">
                    <p className="text-lg font-display font-bold text-success">{pdnStats.total_assinados}</p>
                    <p className="text-[10px] text-muted-foreground">Assinados</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-destructive" /> Quentes</span>
                    <span className="font-bold">{pdnStats.quente}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">🟡 Mornos</span>
                    <span className="font-bold">{pdnStats.morno}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">🔵 Frios</span>
                    <span className="font-bold">{pdnStats.frio}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/50 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">VGV Gerado</span>
                    <span className="font-bold text-warning">R$ {(pdnStats.vgv_gerado / 1000).toFixed(0)}k</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">VGV Assinado</span>
                    <span className="font-bold text-success">R$ {(pdnStats.vgv_assinado / 1000).toFixed(0)}k</span>
                  </div>
                  {pdnStats.total_caidos > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">❌ Caídos ({pdnStats.total_caidos})</span>
                      <span className="font-bold text-destructive">R$ {(pdnStats.vgv_caido / 1000).toFixed(0)}k</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* 6. Recuperação de Leads */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className={card}>
              <SectionHeader icon={RotateCcw} title="Recuperação de Leads" action={{ label: "Ver módulo", onClick: () => navigate("/gestao") }} />
              <div className="p-4 space-y-3">
                <HotStat icon={RotateCcw} label="Leads reativados" value={recovery.reativados} color="text-primary" />
                <HotStat icon={ArrowUpRight} label="Respostas recebidas" value={recovery.respondidos} color="text-success" />
                <HotStat icon={CalendarDays} label="Visitas geradas" value={recovery.visitas} color="text-warning" />
              </div>
            </motion.div>

            {/* Checkpoint do Dia */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={card}>
              <SectionHeader icon={ClipboardCheck} title="Checkpoint Hoje" action={{ label: "Ver checkpoint", onClick: () => navigate("/checkpoint") }} />
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="text-center rounded-lg bg-primary/10 p-2">
                    <p className="text-lg font-display font-bold text-primary">{cpStats.total_checkpoints}</p>
                    <p className="text-[10px] text-muted-foreground">Checkpoints</p>
                  </div>
                  <div className="text-center rounded-lg bg-muted/30 p-2">
                    <p className="text-lg font-display font-bold text-foreground">{cpStats.total_corretores}</p>
                    <p className="text-[10px] text-muted-foreground">Corretores</p>
                  </div>
                </div>
                <HotStat icon={Users} label="Presentes" value={cpStats.presentes} color="text-success" />
                <HotStat icon={AlertTriangle} label="Ausentes" value={cpStats.ausentes} color="text-destructive" />
                <div className="pt-2 border-t border-border/50 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Ligações OA (hoje)</span>
                    <span className="font-bold text-primary">{cpStats.oa_ligacoes}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Interessados OA (hoje)</span>
                    <span className="font-bold text-success">{cpStats.oa_aproveitados}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Ligações (checkpoint)</span>
                    <span className="font-bold">{companyTotals.real_ligacoes}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Propostas (checkpoint)</span>
                    <span className="font-bold">{companyTotals.real_propostas}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* 7. Smart Alerts */}
          {(smartAlerts.length > 0 || alerts.length > 0) && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={`${card} border-warning/30`}>
              <SectionHeader icon={Bell} title={`Alertas Importantes (${smartAlerts.length + alerts.length})`} iconColor="text-warning" />
              <div className="p-4 space-y-2">
                {smartAlerts.map(a => (
                  <div key={a.id} className={`flex items-start gap-3 p-3 rounded-lg border ${a.severity === "critical" ? "border-destructive/30 bg-destructive/5" : a.severity === "warning" ? "border-warning/30 bg-warning/5" : "border-border bg-muted/30"}`}>
                    {a.severity === "critical" ? <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      : a.severity === "warning" ? <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                      : <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                    </div>
                    {a.action && (
                      <button onClick={() => navigate(a.action!.url)} className="text-xs text-primary font-semibold hover:underline shrink-0 whitespace-nowrap">
                        {a.action.label}
                      </button>
                    )}
                  </div>
                ))}
                {alerts.map((a, i) => (
                  <div key={`ia-${i}`} className="flex items-start gap-2 text-sm pl-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{a}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* 8. Análise IA do Dia */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className={card}>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <img src={homiMascot} alt="Homi" className="h-6 w-6 object-contain" />
                <h3 className="font-display font-semibold text-sm">Homi — Análise do Dia</h3>
              </div>
              <IaCoreAction
                label="Gerar Análise do Dia"
                module="centro_comando"
                prompt={`Analise os dados do Centro de Comando da Uhome e gere um resumo estratégico do dia:\n\n${iaContext}\n\nInclua: performance da equipe, campanhas de marketing, principais oportunidades, sugestões de ação prioritárias.`}
              />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

/* ==================== Sub-components ==================== */

const SectionHeader = forwardRef<HTMLDivElement, {
  icon: any; title: string; iconColor?: string;
  action?: { label: string; onClick: () => void };
}>(({ icon: Icon, title, action, iconColor }, ref) => {
  return (
    <div ref={ref} className="flex items-center justify-between px-4 py-3 border-b border-border">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconColor || "text-primary"}`} />
        <h3 className="font-display font-semibold text-sm">{title}</h3>
      </div>
      {action && (
        <button onClick={action.onClick} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
          {action.label} <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
});
SectionHeader.displayName = "SectionHeader";

function MetricCard({ label, value, meta, highlight, sub }: {
  label: string; value: string | number; meta?: number; highlight?: boolean; sub?: string;
}) {
  const pctVal = meta && typeof value === "number" ? pct(value, meta) : null;
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-primary/5 border border-primary/20" : "bg-muted/30"}`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-display font-bold mt-0.5 ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
      {pctVal !== null && (
        <p className={`text-[10px] font-medium ${pctVal >= 80 ? "text-success" : pctVal >= 50 ? "text-warning" : "text-destructive"}`}>
          {pctVal}% da meta
        </p>
      )}
      {sub && <p className="text-[9px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-display font-bold text-foreground">{value}</p>
    </div>
  );
}

function HotStat({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: number; color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-lg font-display font-bold text-foreground">{value}</p>
    </div>
  );
}
