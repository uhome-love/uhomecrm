import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, setMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, TrendingUp, PartyPopper, DollarSign, Users, Building2,
  CalendarDays, Filter, Download, Search, CheckCircle, Crown, Loader2,
  ChevronDown, Star, Sparkles, Target, BarChart3, Megaphone,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatBRL, formatBRLCompact } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, KpiGrid } from "@/components/ui/KpiCard";

const formatCurrency = formatBRLCompact;
const formatCurrencyFull = (v: number) => formatBRL(v);

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
}

// Animated number counter
function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) { node.textContent = `${prefix}${to.toLocaleString("pt-BR")}${suffix}`; return; }
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / 800, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = Math.round(from + (to - from) * eased);
      node.textContent = `${prefix}${current.toLocaleString("pt-BR")}${suffix}`;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value, prefix, suffix]);
  return <span ref={ref}>{prefix}{value.toLocaleString("pt-BR")}{suffix}</span>;
}

interface VendaRow {
  id: string;
  nome_cliente: string;
  empreendimento: string | null;
  unidade: string | null;
  vgv_final: number | null;
  vgv_estimado: number | null;
  data_assinatura: string | null;
  corretor_id: string | null;
  gerente_id: string | null;
  fase: string | null;
  created_at: string | null;
  pipeline_lead_id: string | null;
}

interface PartnerInfo {
  auth_user_ids: string[];
  fator_split: number;
}

interface ProfileInfo {
  id: string;
  nome: string;
  avatar_url: string | null;
  avatar_gamificado_url: string | null;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function VendasRealizadas() {
  const { user } = useAuth();
  const { isAdmin, isGestor } = useUserRole();
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const dateRange = useMemo(() => {
    const target = setMonth(new Date(selectedYear, 0, 1), selectedMonth);
    return {
      start: format(startOfMonth(target), "yyyy-MM-dd"),
      end: format(endOfMonth(target), "yyyy-MM-dd"),
      label: `${MESES[selectedMonth]} ${selectedYear}`,
    };
  }, [selectedMonth, selectedYear]);

  const { data, isLoading } = useQuery({
    queryKey: ["vendas-realizadas", user?.id, isAdmin, isGestor, dateRange.start, dateRange.end],
    enabled: !!user,
    queryFn: async () => {
      // Get profile id
      let profileId: string | null = null;
      if (!isAdmin) {
        const { data: p } = await supabase.from("profiles").select("id").eq("user_id", user!.id).maybeSingle();
        profileId = p?.id || null;
      }

      let extraPartnerRows: VendaRow[] = [];

      let query = supabase.from("negocios")
        .select("id, nome_cliente, empreendimento, unidade, vgv_final, vgv_estimado, data_assinatura, corretor_id, gerente_id, fase, created_at, pipeline_lead_id")
        .in("fase", ["assinado", "vendido"])
        .gte("data_assinatura", dateRange.start)
        .lte("data_assinatura", dateRange.end)
        .order("data_assinatura", { ascending: false });

      if (!isAdmin && !isGestor && profileId) {
        query = query.eq("corretor_id", profileId);

        // Also find deals where this corretor is a PARTNER
        const { data: partnerDeals } = await supabase.from("v_kpi_negocios")
          .select("id")
          .eq("auth_user_id", user!.id)
          .in("fase", ["assinado", "vendido"])
          .gte("data_assinatura", dateRange.start)
          .lte("data_assinatura", dateRange.end)
          .eq("is_parceria", true);
        const partnerDealIds = (partnerDeals || []).map(d => d.id as string);
        if (partnerDealIds.length > 0) {
          const { data: extraDeals } = await supabase.from("negocios")
            .select("id, nome_cliente, empreendimento, unidade, vgv_final, vgv_estimado, data_assinatura, corretor_id, gerente_id, fase, created_at, pipeline_lead_id")
            .in("id", partnerDealIds)
            .in("fase", ["assinado", "vendido"]);
          extraPartnerRows = (extraDeals || []) as VendaRow[];
        }
      } else if (isGestor && !isAdmin) {
        // Gestor: get team member profile IDs AND partnership deals
        const { data: teamMembers } = await supabase.from("team_members").select("user_id").eq("gerente_id", user!.id);
        const tmUserIds = (teamMembers || []).map(tm => tm.user_id).filter(Boolean) as string[];
        const allTeamAuthIds = [...tmUserIds];
        if (user?.id && !allTeamAuthIds.includes(user.id)) allTeamAuthIds.push(user.id);

        const { data: teamProfiles } = await supabase.from("profiles").select("id").in("user_id", allTeamAuthIds);
        const teamProfileIds = (teamProfiles || []).map(p => p.id);
        if (profileId && !teamProfileIds.includes(profileId)) teamProfileIds.push(profileId);

        // Also find deals where a team member is a PARTNER (not primary corretor)
        const { data: partnerDeals } = await supabase.from("v_kpi_negocios")
          .select("id")
          .in("auth_user_id", allTeamAuthIds)
          .in("fase", ["assinado", "vendido"])
          .gte("data_assinatura", dateRange.start)
          .lte("data_assinatura", dateRange.end)
          .eq("is_parceria", true);
        const partnerDealIds = (partnerDeals || []).map(d => d.id as string);

        if (teamProfileIds.length > 0) {
          query = query.in("corretor_id", teamProfileIds);
        }

        // Fetch partnership deals separately (they may have a different corretor_id)
        if (partnerDealIds.length > 0) {
          const { data: extraDeals } = await supabase.from("negocios")
            .select("id, nome_cliente, empreendimento, unidade, vgv_final, vgv_estimado, data_assinatura, corretor_id, gerente_id, fase, created_at, pipeline_lead_id")
            .in("id", partnerDealIds)
            .in("fase", ["assinado", "vendido"]);
          extraPartnerRows = (extraDeals || []) as VendaRow[];
        }
      }

      const { data: vendas } = await query;
      let rows = (vendas || []) as VendaRow[];

      // Merge partnership deals (deduplicate by id)
      if (extraPartnerRows.length > 0) {
        const existingIds = new Set(rows.map(r => r.id));
        for (const pr of extraPartnerRows) {
          if (!existingIds.has(pr.id)) {
            rows.push(pr);
            existingIds.add(pr.id);
          }
        }
        rows.sort((a, b) => (b.data_assinatura || "").localeCompare(a.data_assinatura || ""));
      }

      // Detect partnerships from v_kpi_negocios (official source of truth)
      const dealIds = rows.map(v => v.id);
      let parceriaSet = new Set<string>();
      let parceriaPartners: Record<string, PartnerInfo> = {};
      if (dealIds.length > 0) {
        const { data: kpiRows } = await supabase.from("v_kpi_negocios")
          .select("id, auth_user_id, pipeline_lead_id, is_parceria, fator_split")
          .eq("is_parceria", true)
          .in("id", dealIds);
        (kpiRows || []).forEach(r => {
          const plId = r.pipeline_lead_id;
          if (!plId) return;
          parceriaSet.add(plId);
          if (!parceriaPartners[plId]) parceriaPartners[plId] = { auth_user_ids: [], fator_split: Number(r.fator_split || 0.5) };
          if (r.auth_user_id && !parceriaPartners[plId].auth_user_ids.includes(r.auth_user_id)) {
            parceriaPartners[plId].auth_user_ids.push(r.auth_user_id);
          }
        });
      }

      // Collect all profile IDs and auth_user_ids
      const corretorProfileIds = new Set(rows.map(v => v.corretor_id).filter(Boolean) as string[]);
      const partnerAuthUserIds = new Set<string>();
      Object.values(parceriaPartners).forEach(p => p.auth_user_ids.forEach(id => partnerAuthUserIds.add(id)));

      const profileIds = [...corretorProfileIds];
      const authIds = [...partnerAuthUserIds];

      const [profilesRes, authProfilesRes, annualRes, profileIdMapRes] = await Promise.all([
        // Load profiles by profile.id (for deal corretor_id)
        profileIds.length > 0
          ? supabase.from("profiles").select("id, nome, avatar_url, avatar_gamificado_url").in("id", profileIds)
          : { data: [] },
        // Load profiles by user_id (for partnership auth_user_ids)
        authIds.length > 0
          ? supabase.from("profiles").select("id, user_id, nome, avatar_url, avatar_gamificado_url").in("user_id", authIds)
          : { data: [] },
        // Annual VGV per corretor from v_kpi_negocios (split-aware)
        (profileIds.length > 0 || authIds.length > 0)
          ? supabase.from("v_kpi_negocios").select("auth_user_id, vgv_efetivo").in("fase", ["assinado", "vendido"]).gte("data_assinatura", `${new Date().getFullYear()}-01-01`)
          : { data: [] },
        // Map profile.id to auth user_id for commission lookup
        profileIds.length > 0
          ? supabase.from("profiles").select("id, user_id").in("id", profileIds)
          : { data: [] },
      ]);

      let profileMap: Record<string, ProfileInfo> = {};
      (profilesRes.data || []).forEach(p => { profileMap[p.id] = p as ProfileInfo; });

      let authProfileMap: Record<string, ProfileInfo> = {};
      (authProfilesRes.data || []).forEach((p: any) => {
        if (p.user_id) authProfileMap[p.user_id] = { id: p.id, nome: p.nome, avatar_url: p.avatar_url, avatar_gamificado_url: p.avatar_gamificado_url };
      });

      let annualVgvByCorretor: Record<string, number> = {};
      (annualRes.data || []).forEach((n: any) => {
        const uid = n.auth_user_id as string;
        annualVgvByCorretor[uid] = (annualVgvByCorretor[uid] || 0) + Number(n.vgv_efetivo || 0);
      });

      let profileIdToAuthId: Record<string, string> = {};
      (profileIdMapRes.data || []).forEach((p: any) => { if (p.user_id) profileIdToAuthId[p.id] = p.user_id; });

      // Load pipeline origin data for sold leads
      let origemMap: Record<string, { origem: string | null; origem_detalhe: string | null; empreendimento_lead: string | null; created_at_lead: string | null }> = {};
      const pipelineLeadIds = rows.map(v => v.pipeline_lead_id).filter(Boolean) as string[];
      if (pipelineLeadIds.length > 0) {
        const { data: plData } = await supabase
          .from("pipeline_leads")
          .select("id, origem, origem_detalhe, empreendimento, created_at")
          .in("id", pipelineLeadIds);
        (plData || []).forEach((pl: any) => {
          origemMap[pl.id] = {
            origem: pl.origem,
            origem_detalhe: pl.origem_detalhe,
            empreendimento_lead: pl.empreendimento,
            created_at_lead: pl.created_at,
          };
        });
      }

      return { vendas: rows, profiles: profileMap, authProfiles: authProfileMap, annualVgvByCorretor, parceriaSet: [...parceriaSet], parceriaPartners, origemMap, profileIdToAuthId };
    },
  });

  const vendas = data?.vendas || [];
  const profiles = data?.profiles || {};
  const authProfiles = data?.authProfiles || {};
  const annualVgvByCorretor = data?.annualVgvByCorretor || {};
  const parceriaLeadIds = new Set(data?.parceriaSet || []);
  const parceriaPartners = data?.parceriaPartners || {};
  const origemMap = data?.origemMap || {};
  const profileIdToAuthId = data?.profileIdToAuthId || {};

  const [activeTab, setActiveTab] = useState("vendas");

  const filtered = useMemo(() => {
    if (!search.trim()) return vendas;
    const s = search.toLowerCase();
    return vendas.filter(v =>
      v.nome_cliente?.toLowerCase().includes(s) ||
      v.empreendimento?.toLowerCase().includes(s) ||
      (v.corretor_id && profiles[v.corretor_id]?.nome?.toLowerCase().includes(s))
    );
  }, [vendas, search, profiles]);

  // Stats
  const totalVGV = filtered.reduce((s, v) => s + (v.vgv_final || v.vgv_estimado || 0), 0);
  const totalVendas = filtered.length;
  const ticketMedio = totalVendas > 0 ? totalVGV / totalVendas : 0;

  // Commission logic:
  // Corretagem = VGV × 5%
  // Corretor tier based on annual VGV: <1.5M = 32%, >=1.5M = 34%, >=3M = 36%
  // Gerente = Corretagem × 15%
  function getCorretorTier(annualVgv: number): { pct: number; label: string } {
    if (annualVgv >= 3_000_000) return { pct: 0.36, label: "36%" };
    if (annualVgv >= 1_500_000) return { pct: 0.34, label: "34%" };
    return { pct: 0.32, label: "32%" };
  }

  function calcComissaoCorretor(vgv: number, annualVgv: number): number {
    const corretagem = vgv * 0.05;
    const tier = getCorretorTier(annualVgv);
    return corretagem * tier.pct;
  }

  function calcComissaoGerente(vgv: number): number {
    return vgv * 0.05 * 0.15;
  }

  // Total commissions for summary
  // For per-corretor, use their annual VGV tier; for aggregate, show range
  const totalCorretagem = totalVGV * 0.05;
  const comissaoCorretor32 = totalCorretagem * 0.32;
  const comissaoCorretor34 = totalCorretagem * 0.34;
  const comissaoCorretor36 = totalCorretagem * 0.36;
  const comissaoGerente = totalCorretagem * 0.15;

  // Rankings by corretor
  const corretorRanking = useMemo(() => {
    const map: Record<string, { nome: string; avatar: string | null; vgv: number; count: number }> = {};
    filtered.forEach(v => {
      const cId = v.corretor_id;
      if (!cId) return;
      const p = profiles[cId];
      if (!map[cId]) map[cId] = { nome: p?.nome || "Corretor", avatar: p?.avatar_gamificado_url || p?.avatar_url || null, vgv: 0, count: 0 };
      map[cId].vgv += v.vgv_final || v.vgv_estimado || 0;
      map[cId].count += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].vgv - a[1].vgv);
  }, [filtered, profiles]);

  const medalEmojis = ["🥇", "🥈", "🥉"];

  // ═══ ORIGIN ANALYTICS ═══
  const origemAnalytics = useMemo(() => {
    const byOrigem: Record<string, { count: number; vgv: number; empreendimentos: Set<string>; detalhe: Set<string> }> = {};
    const detailRows: { cliente: string; empreendimento: string | null; vgv: number; origem: string; detalhe: string | null; dataAssinatura: string | null; dataEntrada: string | null; corretor: string }[] = [];
    
    filtered.forEach(v => {
      const plId = v.pipeline_lead_id;
      const info = plId ? origemMap[plId] : null;
      const origem = info?.origem || "Não identificado";
      const detalhe = info?.origem_detalhe || null;
      const vgv = v.vgv_final || v.vgv_estimado || 0;
      const corr = v.corretor_id ? profiles[v.corretor_id] : null;

      if (!byOrigem[origem]) byOrigem[origem] = { count: 0, vgv: 0, empreendimentos: new Set(), detalhe: new Set() };
      byOrigem[origem].count++;
      byOrigem[origem].vgv += vgv;
      if (v.empreendimento) byOrigem[origem].empreendimentos.add(v.empreendimento);
      if (detalhe) byOrigem[origem].detalhe.add(detalhe);

      detailRows.push({
        cliente: v.nome_cliente,
        empreendimento: v.empreendimento,
        vgv,
        origem,
        detalhe,
        dataAssinatura: v.data_assinatura,
        dataEntrada: info?.created_at_lead || null,
        corretor: corr?.nome || "—",
      });
    });

    const sorted = Object.entries(byOrigem)
      .map(([origem, d]) => ({ origem, ...d, empreendimentos: [...d.empreendimentos], detalhe: [...d.detalhe] }))
      .sort((a, b) => b.vgv - a.vgv);

    return { breakdown: sorted, details: detailRows, totalVGV };
  }, [filtered, origemMap, profiles, totalVGV]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="bg-[#f0f0f5] dark:bg-[#0e1525] p-6 space-y-5 max-w-7xl mx-auto -m-6 min-h-full">
      <PageHeader
        title="Vendas realizadas"
        subtitle={dateRange.label}
        icon={<TrendingUp size={18} strokeWidth={1.5} />}
        actions={
          <Popover open={showMonthPicker} onOpenChange={setShowMonthPicker}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {MESES[selectedMonth]}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
              <div className="grid grid-cols-3 gap-1">
                {MESES.map((mes, i) => (
                  <button
                    key={mes}
                    onClick={() => { setSelectedMonth(i); setShowMonthPicker(false); }}
                    className={cn(
                      "text-xs py-2 px-1 rounded-lg font-medium transition-all",
                      selectedMonth === i
                        ? "bg-[#4F46E5] text-white"
                        : "hover:bg-[#f5f5f5] dark:hover:bg-white/[0.06] text-[#0a0a0a] dark:text-[#fafafa]",
                      i > new Date().getMonth() && selectedYear >= new Date().getFullYear()
                        ? "opacity-40 pointer-events-none"
                        : ""
                    )}
                  >
                    {mes.slice(0, 3)}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard label="Vendas" value={totalVendas} />
        <KpiCard label="VGV total" value={formatCurrency(totalVGV)} variant="success" />
        <KpiCard label="Ticket médio" value={formatCurrency(ticketMedio)} variant="highlight" />
        <KpiCard label="Corretagem (5%)" value={formatCurrency(totalCorretagem)} variant="warning" hint="5% do VGV total" />
      </KpiGrid>

      {/* ═══ TABS ═══ */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-9 mb-4">
          <TabsTrigger value="vendas" className="text-xs gap-1.5 px-3">
            <Trophy className="h-3.5 w-3.5" /> Vendas
          </TabsTrigger>
          {(isAdmin || isGestor) && (
            <TabsTrigger value="origens" className="text-xs gap-1.5 px-3">
              <Megaphone className="h-3.5 w-3.5" /> Origens & Campanhas
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="vendas" className="space-y-5 mt-0">
      {(isAdmin || isGestor) && (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <Card className="border-border/60 overflow-hidden" style={{ borderLeft: "4px solid hsl(45, 90%, 50%)" }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              <h2 className="text-sm font-bold text-foreground">Estimativa de Comissão</h2>
              <span className="text-[10px] text-muted-foreground ml-auto">Corretagem = VGV × 5%</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Faixa do corretor: <strong>32%</strong> (até R$ 1,5M/ano) → <strong>34%</strong> (≥ R$ 1,5M) → <strong>36%</strong> (≥ R$ 3M). Gerente: 15% da corretagem.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 text-center">
                <p className="text-[10px] font-medium text-emerald-600 mb-1">Corretor (32%)</p>
                <p className="text-xl font-black text-emerald-500">{formatCurrencyFull(comissaoCorretor32)}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">VGV anual {'<'} R$ 1,5M</p>
              </div>
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 text-center">
                <p className="text-[10px] font-medium text-emerald-600 mb-1">Corretor (34%)</p>
                <p className="text-xl font-black text-emerald-500">{formatCurrencyFull(comissaoCorretor34)}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">VGV anual ≥ R$ 1,5M</p>
              </div>
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 text-center">
                <p className="text-[10px] font-medium text-emerald-600 mb-1">Corretor (36%)</p>
                <p className="text-xl font-black text-emerald-500">{formatCurrencyFull(comissaoCorretor36)}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">VGV anual ≥ R$ 3M</p>
              </div>
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3.5 text-center">
                <p className="text-[10px] font-medium text-blue-600 mb-1">Gerente (15%)</p>
                <p className="text-xl font-black text-blue-500">{formatCurrencyFull(comissaoGerente)}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">15% da corretagem</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      )}

      {/* ═══ RANKING CORRETORES (gerente/admin) ═══ */}
      {(isAdmin || isGestor) && corretorRanking.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="h-4 w-4 text-yellow-500" />
                <h2 className="text-sm font-bold text-foreground">Ranking de Vendedores</h2>
              </div>
              <div className="space-y-2">
                {corretorRanking.map(([id, r], i) => (
                  <motion.div key={id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-accent/30 border border-border/30">
                    <span className="text-lg w-7 text-center shrink-0">{medalEmojis[i] || `${i + 1}º`}</span>
                    {r.avatar ? (
                      <img src={r.avatar} alt={r.nome} className="h-8 w-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                        {getInitials(r.nome)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{r.nome}</p>
                      <p className="text-[10px] text-muted-foreground">{r.count} venda{r.count > 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-emerald-500">{formatCurrency(r.vgv)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══ SEARCH + TABLE ═══ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                📋 Lista de Vendas <Badge variant="outline" className="text-xs">{filtered.length}</Badge>
              </h2>
              <div className="relative w-full max-w-[260px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente, empreendimento..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-8 text-xs bg-accent/30 border-border/40"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl mb-3 block">🎯</span>
                <p className="text-muted-foreground text-sm font-medium">Nenhuma venda no período</p>
                <p className="text-[11px] text-muted-foreground mt-1">Continue focando que a próxima vem! 💪</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Cliente</th>
                      <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Empreendimento</th>
                      {(isAdmin || isGestor) && <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Corretor</th>}
                      <th className="text-right py-2.5 px-3 text-[10px] text-muted-foreground font-medium">VGV</th>
                      <th className="text-center py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Data</th>
                      <th className="text-center py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Status</th>
                      <th className="text-right py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Comissão Est.</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filtered.map((v, i) => {
                        const vgv = v.vgv_final || v.vgv_estimado || 0;
                        const corr = v.corretor_id ? profiles[v.corretor_id] : null;
                        const authId = v.corretor_id ? profileIdToAuthId[v.corretor_id] : null;
                        const annualVgv = authId ? (annualVgvByCorretor[authId] || 0) : 0;
                        const comissao = calcComissaoCorretor(vgv, annualVgv);
                        const tier = getCorretorTier(annualVgv);

                        return (
                          <motion.tr key={v.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.02 * i }}
                            className="border-b border-border/20 hover:bg-accent/40 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-foreground">{v.nome_cliente}</p>
                                  {v.unidade && <p className="text-[10px] text-muted-foreground">Un. {v.unidade}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-foreground">{v.empreendimento || "—"}</span>
                              </div>
                            </td>
                            {(isAdmin || isGestor) && (
                              <td className="py-3 px-3">
                                {(() => {
                                  const parceria = v.pipeline_lead_id ? parceriaPartners[v.pipeline_lead_id] : null;
                                  if (parceria && parceria.auth_user_ids.length >= 2) {
                                    const p1 = authProfiles[parceria.auth_user_ids[0]];
                                    const p2 = authProfiles[parceria.auth_user_ids[1]];
                                    const name1 = p1?.nome?.split(" ")[0] || "Corretor";
                                    const name2 = p2?.nome?.split(" ")[0] || "Corretor";
                                    return (
                                      <div className="flex items-center gap-1">
                                        <div className="flex -space-x-1.5">
                                          {p1 && (
                                            <Avatar className="h-5 w-5 border border-background">
                                              {(p1.avatar_gamificado_url || p1.avatar_url) && <img src={p1.avatar_gamificado_url || p1.avatar_url!} className="h-5 w-5 rounded-full object-cover" />}
                                              <AvatarFallback className="text-[7px] bg-primary/10 text-primary">{getInitials(p1.nome)}</AvatarFallback>
                                            </Avatar>
                                          )}
                                          {p2 && (
                                            <Avatar className="h-5 w-5 border border-background">
                                              {(p2.avatar_gamificado_url || p2.avatar_url) && <img src={p2.avatar_gamificado_url || p2.avatar_url!} className="h-5 w-5 rounded-full object-cover" />}
                                              <AvatarFallback className="text-[7px] bg-primary/10 text-primary">{getInitials(p2.nome)}</AvatarFallback>
                                            </Avatar>
                                          )}
                                        </div>
                                        <span className="text-xs text-foreground">{name1} ↔ {name2}</span>
                                      </div>
                                    );
                                  }
                                  return corr ? (
                                    <div className="flex items-center gap-1.5">
                                      <Avatar className="h-5 w-5">
                                        {(corr.avatar_gamificado_url || corr.avatar_url) && <img src={corr.avatar_gamificado_url || corr.avatar_url!} className="h-5 w-5 rounded-full object-cover" />}
                                        <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{getInitials(corr.nome)}</AvatarFallback>
                                      </Avatar>
                                      <span className="text-xs text-foreground">{corr.nome.split(" ")[0]}</span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">—</span>
                                  );
                                })()}
                              </td>
                            )}
                            <td className="py-3 px-3 text-right">
                              <span className="text-sm font-black text-emerald-500">{formatCurrency(vgv)}</span>
                              {v.pipeline_lead_id && parceriaLeadIds.has(v.pipeline_lead_id) && (() => {
                                const splitPct = parceriaPartners[v.pipeline_lead_id!]?.fator_split;
                                const pctLabel = splitPct ? `${Math.round(splitPct * 100)}%` : "50%";
                                return <p className="text-[9px] font-bold text-violet-500 mt-0.5">🤝 Parceria {pctLabel}</p>;
                              })()}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="text-xs text-muted-foreground">
                                {v.data_assinatura ? format(new Date(v.data_assinatura + "T12:00:00"), "dd/MM/yy") : "—"}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <Badge className="text-[9px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">
                                ✅ {v.fase === "vendido" ? "Vendido" : "Assinado"}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className="text-xs font-semibold text-yellow-500">{formatCurrencyFull(comissao)}</span>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border/60">
                      <td colSpan={isAdmin || isGestor ? 3 : 2} className="py-3 px-3 text-sm font-bold text-foreground">
                        Total — {filtered.length} venda{filtered.length !== 1 ? "s" : ""}
                      </td>
                      <td className="py-3 px-3 text-right text-sm font-black text-emerald-500">{formatCurrency(totalVGV)}</td>
                      <td></td>
                      <td></td>
                      <td className="py-3 px-3 text-right text-xs font-bold text-yellow-500">{formatCurrencyFull(totalCorretagem * 0.34)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ MOTIVATIONAL FOOTER ═══ */}
      {totalVendas > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
          <div className="rounded-2xl p-5 text-center bg-gradient-to-br from-emerald-500/5 via-yellow-500/5 to-blue-500/5 border border-border/40">
            <p className="text-3xl mb-2">🎉</p>
            <p className="text-lg font-black text-foreground">
              {totalVendas === 1 ? "1 venda realizada!" : `${totalVendas} vendas realizadas!`}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              VGV acumulado de <span className="font-bold text-emerald-500">{formatCurrency(totalVGV)}</span> — continue assim! 🚀
            </p>
          </div>
        </motion.div>
      )}
        </TabsContent>

        {/* ═══ ORIGENS & CAMPANHAS TAB ═══ */}
        {(isAdmin || isGestor) && (
          <TabsContent value="origens" className="space-y-5 mt-0">
            {/* Breakdown por Origem */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Megaphone className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-bold text-foreground">Performance por Origem</h2>
                    <Badge variant="outline" className="text-[10px] ml-auto">{origemAnalytics.breakdown.length} origens</Badge>
                  </div>

                  {origemAnalytics.breakdown.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground text-sm">Nenhuma venda com origem rastreada no período</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {origemAnalytics.breakdown.map((item, i) => {
                        const pct = origemAnalytics.totalVGV > 0 ? (item.vgv / origemAnalytics.totalVGV) * 100 : 0;
                        const barColors = [
                          "bg-primary", "bg-emerald-500", "bg-blue-500", "bg-amber-500", "bg-violet-500", "bg-rose-500",
                        ];
                        const barColor = barColors[i % barColors.length];

                        return (
                          <motion.div key={item.origem}
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.03 * i }}
                            className="rounded-xl border border-border/40 p-3.5 bg-accent/20 hover:bg-accent/40 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={cn("h-3 w-3 rounded-full shrink-0", barColor)} />
                                <span className="text-sm font-bold text-foreground">{item.origem}</span>
                                <Badge variant="secondary" className="text-[9px] h-4">{item.count} venda{item.count > 1 ? "s" : ""}</Badge>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-black text-emerald-500">{formatCurrency(item.vgv)}</span>
                                <span className="text-[10px] text-muted-foreground ml-1.5">({pct.toFixed(1)}%)</span>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="h-2 rounded-full bg-muted/50 overflow-hidden mb-2">
                              <motion.div
                                initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                transition={{ delay: 0.1 + 0.05 * i, duration: 0.6 }}
                                className={cn("h-full rounded-full", barColor)}
                              />
                            </div>

                            {/* Detail chips */}
                            <div className="flex flex-wrap gap-1.5">
                              {item.detalhe.length > 0 && item.detalhe.map(d => (
                                <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                  📋 {d}
                                </span>
                              ))}
                              {item.empreendimentos.slice(0, 5).map(emp => (
                                <span key={emp} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                  🏢 {emp}
                                </span>
                              ))}
                              {item.empreendimentos.length > 5 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                  +{item.empreendimentos.length - 5}
                                </span>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Tabela detalhada — rastreio completo */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-bold text-foreground">Rastreio Completo — Lead → Venda</h2>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/40">
                          <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Cliente</th>
                          <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Empreendimento</th>
                          <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Origem / Campanha</th>
                          <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Formulário / Detalhe</th>
                          <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Corretor</th>
                          <th className="text-center py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Entrada</th>
                          <th className="text-center py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Assinatura</th>
                          <th className="text-right py-2.5 px-3 text-[10px] text-muted-foreground font-medium">VGV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {origemAnalytics.details.map((row, i) => (
                          <tr key={i} className="border-b border-border/20 hover:bg-accent/40 transition-colors">
                            <td className="py-2.5 px-3 text-xs font-semibold text-foreground">{row.cliente}</td>
                            <td className="py-2.5 px-3 text-xs text-foreground">{row.empreendimento || "—"}</td>
                            <td className="py-2.5 px-3">
                              <Badge variant="secondary" className="text-[10px]">{row.origem}</Badge>
                            </td>
                            <td className="py-2.5 px-3 text-xs text-muted-foreground">{row.detalhe || "—"}</td>
                            <td className="py-2.5 px-3 text-xs text-foreground">{row.corretor}</td>
                            <td className="py-2.5 px-3 text-center text-[10px] text-muted-foreground">
                              {row.dataEntrada ? format(new Date(row.dataEntrada), "dd/MM/yy") : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-center text-[10px] text-muted-foreground">
                              {row.dataAssinatura ? format(new Date(row.dataAssinatura + "T12:00:00"), "dd/MM/yy") : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-right text-xs font-black text-emerald-500">{formatCurrency(row.vgv)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
