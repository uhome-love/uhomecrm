import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, getDate, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRLCompact } from "@/lib/utils";
import { Target, Pencil, Save, TrendingUp, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface MetasMes {
  vgv_meta: number;
  vgv_realizado: number;
  visitas_marcadas_meta: number;
  visitas_marcadas_realizado: number;
  visitas_realizadas_meta: number;
  visitas_realizadas_realizado: number;
  ligacoes_meta: number;
  ligacoes_realizado: number;
}

interface CorretorContrib {
  user_id: string;
  nome: string;
  presencas: number;
  ligacoes: number;
  aproveitados: number;
  leads_novos: number;
  pipeline_ativo: number;
  descartados: number;
  visitas_marcadas: number;
  visitas_realizadas: number;
  negocios: number;
  assinados: number;
  vgv: number;
  has_parceria: boolean;
}

interface Props {
  teamUserIds: string[];
  teamNameMap: Record<string, string>;
}

const pct = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100);
const fmt = (n: number) => n.toLocaleString("pt-BR");
const fmtR = formatBRLCompact;

function semaphoreColor(p: number): { bg: string; text: string; label: string } {
  if (p >= 80) return { bg: "bg-emerald-500", text: "text-emerald-600", label: "No caminho" };
  if (p >= 50) return { bg: "bg-amber-500", text: "text-amber-600", label: "Atenção" };
  return { bg: "bg-destructive", text: "text-destructive", label: "Risco" };
}

export default function TabMetas({ teamUserIds, teamNameMap }: Props) {
  
  const { user } = useAuth();
  const [metas, setMetas] = useState<MetasMes>({
    vgv_meta: 3_000_000, vgv_realizado: 0,
    visitas_marcadas_meta: 200, visitas_marcadas_realizado: 0,
    visitas_realizadas_meta: 100, visitas_realizadas_realizado: 0,
    ligacoes_meta: 680, ligacoes_realizado: 0,
  });
  const [contrib, setContrib] = useState<CorretorContrib[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const mesAtual = format(new Date(), "yyyy-MM");
  const mesLabel = format(new Date(), "MMMM/yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase());
  const mesInicio = `${mesAtual}-01`;
  const mesFim = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd");

  const projecao = (valor: number) => {
    const diasPassados = getDate(new Date());
    const diasNoMes = getDaysInMonth(new Date());
    return diasPassados > 0 ? Math.round((valor / diasPassados) * diasNoMes) : 0;
  };

  const loadData = useCallback(async () => {
    if (!user || teamUserIds.length === 0) return;
    setLoading(true);

    // Build user_id ↔ profile_id maps
    const { data: teamProfiles } = await supabase.from("profiles").select("id, user_id").in("user_id", teamUserIds);
    const profileToUser: Record<string, string> = {};
    const userToProfile: Record<string, string> = {};
    (teamProfiles || []).forEach(p => {
      profileToUser[p.id] = p.user_id;
      userToProfile[p.user_id] = p.id;
    });
    const teamProfileIds = (teamProfiles || []).map(p => p.id).filter(Boolean);

    const startTs = `${mesInicio}T00:00:00-03:00`;
    const endTs = `${mesFim}T23:59:59.999-03:00`;

    // Fetch ligações with pagination to avoid 1000 row limit
    const fetchAllTentativas = async () => {
      const all: { corretor_id: string; resultado: string }[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data } = await supabase
          .from("oferta_ativa_tentativas")
          .select("corretor_id, resultado")
          .in("corretor_id", teamUserIds)
          .gte("created_at", startTs)
          .lte("created_at", endTs)
          .range(from, from + pageSize - 1);
        const rows = data || [];
        all.push(...rows);
        hasMore = rows.length === pageSize;
        from += pageSize;
      }
      return all;
    };

    const [tentativas, r2, r3, r4, r5, r6, r7, r8, r9] = await Promise.all([
      fetchAllTentativas(),
      // Visitas
      supabase.from("visitas").select("corretor_id, status").in("corretor_id", teamUserIds).gte("data_visita", mesInicio).lte("data_visita", mesFim),
      // Negócios (all for created_at + assinatura) — include lead_id for partnership lookup
      supabase.from("negocios").select("id, vgv_estimado, vgv_final, corretor_id, fase, created_at, data_assinatura, lead_id").in("corretor_id", teamProfileIds),
      // Saved metas
      supabase.from("ceo_metas_mensais").select("*").eq("gerente_id", user.id).eq("mes", mesAtual).maybeSingle(),
      // Presenças
      supabase.from("checkpoint_diario").select("corretor_id, presenca").in("corretor_id", teamProfileIds).gte("data", mesInicio).lte("data", mesFim).in("presenca", ["presente", "meio_periodo"]),
      // Leads Novos (roleta aceitos no mês)
      supabase.from("distribuicao_historico").select("corretor_id").in("corretor_id", teamUserIds).eq("acao", "aceito").gte("created_at", startTs).lte("created_at", endTs).limit(5000),
      // Pipeline Ativo (snapshot atual — não arquivados)
      supabase.from("pipeline_leads").select("corretor_id").in("corretor_id", teamUserIds).eq("arquivado", false).limit(5000),
      // Descartados no mês (arquivado = true com updated_at no mês)
      supabase.from("pipeline_leads").select("corretor_id").in("corretor_id", teamUserIds).eq("arquivado", true).gte("updated_at", startTs).lte("updated_at", endTs).limit(5000),
      // Parcerias ativas onde alguém do time é parceiro ou principal
      supabase.from("pipeline_parcerias").select("pipeline_lead_id, corretor_principal_id, corretor_parceiro_id, divisao_principal, divisao_parceiro").eq("status", "ativa"),
    ]);

    
    const visitas = r2.data || [];
    const negociosAll = r3.data || [];
    const metasSalvas = r4.data as any;
    const presencasArr = r5.data || [];
    const leadsNovosArr = r6.data || [];
    const pipelineAtivoArr = r7.data || [];
    const descartadosArr = r8.data || [];
    const parceriasArr = r9.data || [];

    // Build partnership map: pipeline_lead_id → { principal_id, parceiro_id, div_principal, div_parceiro }
    const parceriaByLead: Record<string, { principal_id: string; parceiro_id: string; div_principal: number; div_parceiro: number }> = {};
    (parceriasArr || []).forEach((p: any) => {
      parceriaByLead[p.pipeline_lead_id] = {
        principal_id: p.corretor_principal_id,
        parceiro_id: p.corretor_parceiro_id,
        div_principal: p.divisao_principal || 50,
        div_parceiro: p.divisao_parceiro || 50,
      };
    });

    // Find negócios where team members are PARTNERS but the negócio belongs to someone outside the team
    const teamUserIdSet = new Set(teamUserIds);
    const teamProfileIdSet = new Set(teamProfileIds);
    const parceriasDoTime = (parceriasArr || []).filter((p: any) =>
      (teamUserIdSet.has(p.corretor_parceiro_id) || teamUserIdSet.has(p.corretor_principal_id))
    );
    // Get lead_ids from partnerships that are NOT already covered by negociosAll
    const negociosLeadIds = new Set(negociosAll.map(n => n.lead_id).filter(Boolean));
    const parcLeadIdsExtras = parceriasDoTime
      .map(p => p.pipeline_lead_id)
      .filter(lid => !negociosLeadIds.has(lid));

    let negociosParceiros: any[] = [];
    if (parcLeadIdsExtras.length > 0) {
      const { data: negParc } = await supabase
        .from("negocios")
        .select("id, vgv_estimado, vgv_final, corretor_id, fase, created_at, data_assinatura, lead_id")
        .in("lead_id", parcLeadIdsExtras);
      negociosParceiros = negParc || [];
    }

    // Helper to compute proportional VGV for a negocio given a user_id
    const getVgvProporcional = (n: any, userId: string): number => {
      const vgvBruto = Number(n.vgv_final || n.vgv_estimado || 0);
      if (!n.lead_id) return vgvBruto;
      const parc = parceriaByLead[n.lead_id];
      if (!parc) return vgvBruto;
      if (userId === parc.principal_id) return vgvBruto * (parc.div_principal / 100);
      if (userId === parc.parceiro_id) return vgvBruto * (parc.div_parceiro / 100);
      return vgvBruto;
    };

    // Overload for profile_id based lookup (negocios.corretor_id = profile_id)
    const getVgvProporcionalByProfile = (n: any, profileId: string): number => {
      const uid = profileToUser[profileId];
      return uid ? getVgvProporcional(n, uid) : Number(n.vgv_final || n.vgv_estimado || 0);
    };

    // Helper to check if negocio has partnership
    const hasParceria = (n: any): boolean => {
      return !!n.lead_id && !!parceriaByLead[n.lead_id];
    };

    const ligR = tentativas.length;
    const vmR = visitas.filter(v => v.status !== "cancelada").length;
    const vrR = visitas.filter(v => v.status === "realizada").length;

    // VGV total for metas = assinados no mês (own deals + partner deals)
    const negociosAssinMes = negociosAll.filter(n =>
      ["assinado", "vendido"].includes(n.fase) && n.data_assinatura && n.data_assinatura >= mesInicio && n.data_assinatura <= mesFim
    );
    let vgvReal = negociosAssinMes.reduce((s, n) => s + getVgvProporcionalByProfile(n, n.corretor_id), 0);

    // Add VGV from partner deals (negócios outside the team where a team member is partner)
    const negociosParceirosMes = negociosParceiros.filter(n =>
      ["assinado", "vendido"].includes(n.fase) && n.data_assinatura && n.data_assinatura >= mesInicio && n.data_assinatura <= mesFim
    );
    negociosParceirosMes.forEach(n => {
      const parc = parceriaByLead[n.lead_id];
      if (!parc) return;
      // Add VGV for each team member involved in this partnership
      teamUserIds.forEach(uid => {
        if (uid === parc.parceiro_id || uid === parc.principal_id) {
          vgvReal += getVgvProporcional(n, uid);
        }
      });
    });

    setMetas({
      ligacoes_meta: metasSalvas?.meta_ligacoes || 680,
      ligacoes_realizado: ligR,
      vgv_meta: metasSalvas?.meta_vgv_assinado || 3_000_000,
      vgv_realizado: vgvReal,
      visitas_marcadas_meta: metasSalvas?.meta_visitas_marcadas || 200,
      visitas_marcadas_realizado: vmR,
      visitas_realizadas_meta: metasSalvas?.meta_visitas_realizadas || 100,
      visitas_realizadas_realizado: vrR,
    });

    // Per-corretor contribution
    const contribMap: Record<string, CorretorContrib> = {};
    teamUserIds.forEach(uid => {
      contribMap[uid] = { user_id: uid, nome: teamNameMap[uid] || "Corretor", presencas: 0, ligacoes: 0, aproveitados: 0, leads_novos: 0, pipeline_ativo: 0, descartados: 0, visitas_marcadas: 0, visitas_realizadas: 0, negocios: 0, assinados: 0, vgv: 0, has_parceria: false };
    });

    // Ligações + Aproveitados
    tentativas.forEach(t => {
      if (!contribMap[t.corretor_id]) return;
      contribMap[t.corretor_id].ligacoes++;
      if (t.resultado === "com_interesse") contribMap[t.corretor_id].aproveitados++;
    });

    // Visitas
    visitas.forEach(v => {
      if (!v.corretor_id || !contribMap[v.corretor_id]) return;
      if (v.status !== "cancelada") contribMap[v.corretor_id].visitas_marcadas++;
      if (v.status === "realizada") contribMap[v.corretor_id].visitas_realizadas++;
    });

    // Presenças (corretor_id = profile_id)
    presencasArr.forEach(p => {
      const uid = profileToUser[p.corretor_id];
      if (uid && contribMap[uid]) contribMap[uid].presencas++;
    });

    // Leads Novos (corretor_id = user_id)
    leadsNovosArr.forEach(r => {
      if (contribMap[r.corretor_id]) contribMap[r.corretor_id].leads_novos++;
    });

    // Pipeline Ativo (corretor_id = user_id)
    pipelineAtivoArr.forEach(r => {
      if (contribMap[r.corretor_id]) contribMap[r.corretor_id].pipeline_ativo++;
    });

    // Descartados no mês (corretor_id = user_id)
    descartadosArr.forEach(r => {
      if (contribMap[r.corretor_id]) contribMap[r.corretor_id].descartados++;
    });

    // Negócios (corretor_id = profile_id)
    negociosAll.forEach(n => {
      if (!n.corretor_id) return;
      const uid = profileToUser[n.corretor_id];
      if (!uid || !contribMap[uid]) return;
      // Negócios criados no mês
      if (n.created_at && n.created_at >= startTs && n.created_at <= endTs) contribMap[uid].negocios++;
      // Assinados + VGV
      if (["assinado", "vendido"].includes(n.fase) && n.data_assinatura && n.data_assinatura >= mesInicio && n.data_assinatura <= mesFim) {
        contribMap[uid].assinados++;
        contribMap[uid].vgv += getVgvProporcionalByProfile(n, n.corretor_id);
        if (hasParceria(n)) contribMap[uid].has_parceria = true;
      }
    });

    // Add VGV from partner deals to per-corretor contribution
    negociosParceirosMes.forEach(n => {
      const parc = parceriaByLead[n.lead_id];
      if (!parc) return;
      teamUserIds.forEach(uid => {
        if (!contribMap[uid]) return;
        if (uid === parc.parceiro_id || uid === parc.principal_id) {
          contribMap[uid].assinados++;
          contribMap[uid].vgv += getVgvProporcional(n, uid);
          contribMap[uid].has_parceria = true;
        }
      });
    });

    setContrib(Object.values(contribMap).sort((a, b) => b.ligacoes - a.ligacoes));
    setLoading(false);
  }, [user, teamUserIds, teamNameMap, mesAtual, mesInicio, mesFim]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveMetas = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("ceo_metas_mensais").upsert({
      gerente_id: user.id, mes: mesAtual,
      meta_ligacoes: metas.ligacoes_meta,
      meta_vgv_assinado: metas.vgv_meta,
      meta_visitas_marcadas: metas.visitas_marcadas_meta,
      meta_visitas_realizadas: metas.visitas_realizadas_meta,
    }, { onConflict: "gerente_id,mes" });
    setSaving(false);
    if (error) toast.error("Erro ao salvar metas");
    else { toast.success("Metas salvas!"); setEditing(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const metaItems = [
    { label: "Ligações", atual: metas.ligacoes_realizado, meta: metas.ligacoes_meta, cor: "bg-blue-500", money: false, metaKey: "ligacoes_meta" as const },
    { label: "VGV Assinado", atual: metas.vgv_realizado, meta: metas.vgv_meta, cor: "bg-emerald-500", money: true, metaKey: "vgv_meta" as const },
    { label: "Visitas Marcadas", atual: metas.visitas_marcadas_realizado, meta: metas.visitas_marcadas_meta, cor: "bg-amber-500", money: false, metaKey: "visitas_marcadas_meta" as const },
    { label: "Visitas Realizadas", atual: metas.visitas_realizadas_realizado, meta: metas.visitas_realizadas_meta, cor: "bg-purple-500", money: false, metaKey: "visitas_realizadas_meta" as const },
  ];

  return (
    <div className="space-y-4">
      {/* Metas do Mês */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">Metas do Mês — {mesLabel}</span>
            </div>
            {editing ? (
              <button onClick={saveMetas} disabled={saving} className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80">
                <Save className="h-3.5 w-3.5" /> {saving ? "Salvando..." : "Salvar"}
              </button>
            ) : (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <Pencil className="h-3 w-3" /> Editar
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metaItems.map(({ label, atual, meta, cor, money, metaKey }) => {
              const p = pct(atual, meta);
              const sem = semaphoreColor(p);
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full ${sem.bg}`} />
                      <span className={`text-xs font-bold ${sem.text}`}>{p}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${cor} rounded-full transition-all`} style={{ width: `${Math.min(p, 100)}%` }} />
                  </div>
                  {editing ? (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-muted-foreground">{money ? fmtR(atual) : fmt(atual)} /</span>
                      <input type="number" value={meta} onChange={(e) => setMetas(prev => ({ ...prev, [metaKey]: Number(e.target.value) }))} className="w-20 text-xs border border-border rounded px-1.5 py-0.5 bg-background text-foreground" />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">{money ? `${fmtR(atual)} / ${fmtR(meta)}` : `${fmt(atual)} / ${fmt(meta)}`}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Projeção */}
          <div className="mt-4 pt-3 border-t border-border/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-foreground">Projeção do mês:</span>
              {metaItems.map(({ label, atual, meta, money }) => {
                const proj = projecao(atual);
                const ok = proj >= meta;
                return (
                  <span key={label} className="ml-2">
                    {label.split(" ")[0]}: <span className={ok ? "text-emerald-600 font-semibold" : "text-destructive font-semibold"}>
                      {ok ? "Meta OK" : money ? fmtR(proj) : fmt(proj)}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contribuição por Corretor */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="p-4 pb-2">
            <h2 className="text-sm font-bold text-foreground">Contribuição por Corretor — {mesLabel}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {/* Group headers */}
                <tr className="border-b border-border/30">
                  <th className="py-1 px-2" />
                  <th className="py-1 px-2" />
                  <th colSpan={3} className="py-1 px-2 text-center text-[10px] font-bold text-blue-600 bg-blue-50/60 dark:bg-blue-950/30">Oferta Ativa</th>
                  <th colSpan={3} className="py-1 px-2 text-center text-[10px] font-bold text-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30">Gestão de Leads</th>
                  <th colSpan={4} className="py-1 px-2 text-center text-[10px] font-bold text-amber-600 bg-amber-50/60 dark:bg-amber-950/30">Visitas</th>
                  <th colSpan={4} className="py-1 px-2 text-center text-[10px] font-bold text-purple-600 bg-purple-50/60 dark:bg-purple-950/30">Negócios</th>
                </tr>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-semibold w-6">#</th>
                  <th className="text-left py-2 px-2 text-[10px] text-muted-foreground font-semibold">Corretor</th>
                  {/* Oferta Ativa */}
                  <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-semibold bg-blue-50/30 dark:bg-blue-950/20">Pres</th>
                  <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-semibold bg-blue-50/30 dark:bg-blue-950/20">Lig</th>
                  <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-semibold bg-blue-50/30 dark:bg-blue-950/20">Aprov</th>
                  {/* Gestão de Leads */}
                  <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-semibold bg-emerald-50/30 dark:bg-emerald-950/20">Novos</th>
                  <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-semibold bg-emerald-50/30 dark:bg-emerald-950/20">Ativo</th>
                  <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-semibold bg-emerald-50/30 dark:bg-emerald-950/20">Desc.</th>
                  {/* Visitas */}
                  <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-semibold bg-amber-50/30 dark:bg-amber-950/20">V.Marc</th>
                  <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-semibold bg-amber-50/30 dark:bg-amber-950/20">%</th>
                  <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-semibold bg-amber-50/30 dark:bg-amber-950/20">V.Real</th>
                  <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-semibold bg-amber-50/30 dark:bg-amber-950/20">%</th>
                  {/* Negócios */}
                  <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-semibold bg-purple-50/30 dark:bg-purple-950/20">Negóc</th>
                  <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-semibold bg-purple-50/30 dark:bg-purple-950/20">Assin</th>
                  <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-semibold bg-purple-50/30 dark:bg-purple-950/20">VGV</th>
                  <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-semibold bg-purple-50/30 dark:bg-purple-950/20">%</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const n = contrib.length || 1;
                  const avgLig = contrib.reduce((s, c) => s + c.ligacoes, 0) / n;
                  const avgAprov = contrib.reduce((s, c) => s + c.aproveitados, 0) / n;
                  const avgNovos = contrib.reduce((s, c) => s + c.leads_novos, 0) / n;
                  const avgAtivo = contrib.reduce((s, c) => s + c.pipeline_ativo, 0) / n;
                  const avgDesc = contrib.reduce((s, c) => s + c.descartados, 0) / n;
                  const avgVm = contrib.reduce((s, c) => s + c.visitas_marcadas, 0) / n;
                  const avgVr = contrib.reduce((s, c) => s + c.visitas_realizadas, 0) / n;
                  const avgNeg = contrib.reduce((s, c) => s + c.negocios, 0) / n;
                  const avgAssin = contrib.reduce((s, c) => s + c.assinados, 0) / n;
                  const avgVgv = contrib.reduce((s, c) => s + c.vgv, 0) / n;
                  const avgPres = contrib.reduce((s, c) => s + c.presencas, 0) / n;
                  const totalLig = contrib.reduce((s, c) => s + c.ligacoes, 0) || 1;
                  const totalVm = contrib.reduce((s, c) => s + c.visitas_marcadas, 0) || 1;
                  const totalVr = contrib.reduce((s, c) => s + c.visitas_realizadas, 0) || 1;
                  const totalVgv = contrib.reduce((s, c) => s + c.vgv, 0) || 1;

                  const cellColor = (val: number, avg: number) =>
                    val === 0 ? "text-destructive" : val > avg ? "text-emerald-600 font-semibold" : "";

                  return (
                    <>
                      {contrib.map((c, i) => (
                        <tr key={c.user_id} className="border-b border-border/20 hover:bg-accent/30">
                          <td className="py-1.5 px-2 text-center text-[10px] text-muted-foreground">{i + 1}</td>
                          <td className="py-1.5 px-2 text-xs font-semibold text-foreground whitespace-nowrap">{c.nome.split(" ").slice(0, 2).join(" ")}</td>
                          <td className={`py-1.5 px-2 text-center text-xs ${cellColor(c.presencas, avgPres)}`}>{c.presencas}</td>
                          <td className={`py-1.5 px-2 text-center text-xs ${cellColor(c.ligacoes, avgLig)}`}>{c.ligacoes}</td>
                          <td className={`py-1.5 px-2 text-center text-xs ${cellColor(c.aproveitados, avgAprov)}`}>{c.aproveitados}</td>
                          <td className={`py-1.5 px-2 text-center text-xs ${cellColor(c.leads_novos, avgNovos)}`}>{c.leads_novos}</td>
                          <td className="py-1.5 px-2 text-center text-xs font-medium text-foreground">{c.pipeline_ativo}</td>
                          <td className={`py-1.5 px-2 text-center text-xs ${c.descartados > 0 ? "text-destructive" : "text-muted-foreground"}`}>{c.descartados}</td>
                          <td className={`py-1.5 px-2 text-center text-xs ${cellColor(c.visitas_marcadas, avgVm)}`}>{c.visitas_marcadas}</td>
                          <td className="py-1.5 px-2 text-center text-[10px] text-muted-foreground">{pct(c.visitas_marcadas, totalVm)}%</td>
                          <td className={`py-1.5 px-2 text-center text-xs ${cellColor(c.visitas_realizadas, avgVr)}`}>{c.visitas_realizadas}</td>
                          <td className="py-1.5 px-2 text-center text-[10px] text-muted-foreground">{pct(c.visitas_realizadas, totalVr)}%</td>
                          <td className={`py-1.5 px-2 text-center text-xs ${cellColor(c.negocios, avgNeg)}`}>{c.negocios}</td>
                          <td className={`py-1.5 px-2 text-center text-xs ${cellColor(c.assinados, avgAssin)}`}>{c.assinados}</td>
                          <td className={`py-1.5 px-2 text-center text-xs font-bold ${cellColor(c.vgv, avgVgv)}`}>{fmtR(c.vgv)}{c.has_parceria && <span className="text-[9px] italic text-muted-foreground ml-0.5">(parceria)</span>}</td>
                          <td className="py-1.5 px-2 text-center text-[10px] text-muted-foreground">{pct(c.vgv, totalVgv)}%</td>
                        </tr>
                      ))}
                      {/* Total do time */}
                      <tr className="bg-blue-50/50 dark:bg-blue-950/20 border-t border-border font-bold">
                        <td className="py-2 px-2" />
                        <td className="py-2 px-2 text-xs text-blue-700 dark:text-blue-400">Total do time</td>
                        <td className="py-2 px-2 text-center text-xs">{contrib.reduce((s, c) => s + c.presencas, 0)}</td>
                        <td className="py-2 px-2 text-center text-xs">{contrib.reduce((s, c) => s + c.ligacoes, 0)}</td>
                        <td className="py-2 px-2 text-center text-xs">{contrib.reduce((s, c) => s + c.aproveitados, 0)}</td>
                        <td className="py-2 px-2 text-center text-xs">{contrib.reduce((s, c) => s + c.leads_novos, 0)}</td>
                        <td className="py-2 px-2 text-center text-xs">{contrib.reduce((s, c) => s + c.pipeline_ativo, 0)}</td>
                        <td className="py-2 px-2 text-center text-xs">{contrib.reduce((s, c) => s + c.descartados, 0)}</td>
                        <td className="py-2 px-2 text-center text-xs">{contrib.reduce((s, c) => s + c.visitas_marcadas, 0)}</td>
                        <td className="py-2 px-2 text-center text-[10px] text-muted-foreground">—</td>
                        <td className="py-2 px-2 text-center text-xs">{contrib.reduce((s, c) => s + c.visitas_realizadas, 0)}</td>
                        <td className="py-2 px-2 text-center text-[10px] text-muted-foreground">—</td>
                        <td className="py-2 px-2 text-center text-xs">{contrib.reduce((s, c) => s + c.negocios, 0)}</td>
                        <td className="py-2 px-2 text-center text-xs">{contrib.reduce((s, c) => s + c.assinados, 0)}</td>
                        <td className="py-2 px-2 text-center text-xs font-bold text-emerald-600">{fmtR(contrib.reduce((s, c) => s + c.vgv, 0))}</td>
                        <td className="py-2 px-2 text-center text-[10px] text-muted-foreground">—</td>
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
