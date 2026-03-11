import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, TrendingUp, PartyPopper, DollarSign, Users, Building2,
  CalendarDays, Filter, Download, Search, CheckCircle, Crown, Loader2,
  ChevronDown, Star, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(2).replace(".", ",")}M`;
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

function formatCurrencyFull(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

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
}

interface ProfileInfo {
  id: string;
  nome: string;
  avatar_url: string | null;
  avatar_gamificado_url: string | null;
}

type DatePreset = "mes_atual" | "mes_anterior" | "trimestre" | "custom";

export default function VendasRealizadas() {
  const { user } = useAuth();
  const { isAdmin, isGestor } = useUserRole();
  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState<DatePreset>("mes_atual");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (preset) {
      case "mes_atual": return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd"), label: format(now, "MMMM yyyy", { locale: ptBR }) };
      case "mes_anterior": { const prev = subMonths(now, 1); return { start: format(startOfMonth(prev), "yyyy-MM-dd"), end: format(endOfMonth(prev), "yyyy-MM-dd"), label: format(prev, "MMMM yyyy", { locale: ptBR }) }; }
      case "trimestre": { const m2 = subMonths(now, 2); return { start: format(startOfMonth(m2), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd"), label: `${format(m2, "MMM", { locale: ptBR })} - ${format(now, "MMM yyyy", { locale: ptBR })}` }; }
      case "custom": return { start: customFrom ? format(customFrom, "yyyy-MM-dd") : format(startOfMonth(now), "yyyy-MM-dd"), end: customTo ? format(customTo, "yyyy-MM-dd") : format(endOfMonth(now), "yyyy-MM-dd"), label: "Personalizado" };
    }
  }, [preset, customFrom, customTo]);

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

      let query = supabase.from("negocios")
        .select("id, nome_cliente, empreendimento, unidade, vgv_final, vgv_estimado, data_assinatura, corretor_id, gerente_id, fase, created_at")
        .in("fase", ["assinado", "vendido"])
        .gte("data_assinatura", dateRange.start)
        .lte("data_assinatura", dateRange.end)
        .order("data_assinatura", { ascending: false });

      if (!isAdmin && !isGestor && profileId) {
        query = query.eq("corretor_id", profileId);
      } else if (isGestor && profileId) {
        query = query.eq("gerente_id", profileId);
      }

      const { data: vendas } = await query;
      const rows = (vendas || []) as VendaRow[];

      // Load profiles for corretores
      const ids = [...new Set(rows.map(v => v.corretor_id).filter(Boolean))] as string[];
      let profileMap: Record<string, ProfileInfo> = {};
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, nome, avatar_url, avatar_gamificado_url").in("id", ids);
        (profiles || []).forEach(p => { profileMap[p.id] = p as ProfileInfo; });
      }

      // Fetch annual VGV for corretor tier (year-to-date)
      const yearStart = `${new Date().getFullYear()}-01-01`;
      let annualVgvByCorretor: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: annualData } = await supabase.from("negocios")
          .select("corretor_id, vgv_final, vgv_estimado")
          .in("fase", ["assinado", "vendido"])
          .gte("data_assinatura", yearStart)
          .in("corretor_id", ids);
        (annualData || []).forEach(n => {
          const cid = n.corretor_id as string;
          annualVgvByCorretor[cid] = (annualVgvByCorretor[cid] || 0) + (n.vgv_final || n.vgv_estimado || 0);
        });
      }

      return { vendas: rows, profiles: profileMap, annualVgvByCorretor };
    },
  });

  const vendas = data?.vendas || [];
  const profiles = data?.profiles || {};
  const annualVgvByCorretor = data?.annualVgvByCorretor || {};

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

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* ═══ HEADER ═══ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl px-5 py-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 100%)" }}>
        {/* Confetti-like decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 0.15, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.5 }}
              className="absolute rounded-full"
              style={{
                width: 6 + Math.random() * 12,
                height: 6 + Math.random() * 12,
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 80}%`,
                background: ["#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#a78bfa"][i % 5],
              }}
            />
          ))}
        </div>

        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
              <Trophy className="h-6 w-6 text-emerald-200" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white flex items-center gap-2">
                Vendas Realizadas <PartyPopper className="h-5 w-5 text-yellow-300" />
              </h1>
              <p className="text-xs text-emerald-200/80 capitalize">{dateRange.label}</p>
            </div>
          </div>

          {/* Date filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {([
              { key: "mes_atual", label: "Este mês" },
              { key: "mes_anterior", label: "Mês anterior" },
              { key: "trimestre", label: "Trimestre" },
            ] as { key: DatePreset; label: string }[]).map(p => (
              <button key={p.key}
                className={`text-xs px-3.5 py-1.5 rounded-full font-semibold transition-all ${preset === p.key ? "bg-white text-emerald-800 shadow-lg" : "bg-white/10 text-white/80 hover:bg-white/20"}`}
                onClick={() => setPreset(p.key)}>{p.label}</button>
            ))}
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <button className={`text-xs px-3.5 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1 ${preset === "custom" ? "bg-white text-emerald-800 shadow-lg" : "bg-white/10 text-white/80 hover:bg-white/20"}`}>
                  <CalendarDays className="h-3 w-3" /> Custom
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="end">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">De</p>
                    <Calendar mode="single" selected={customFrom} onSelect={(d) => { setCustomFrom(d); setPreset("custom"); }} className={cn("p-2 pointer-events-auto")} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Até</p>
                    <Calendar mode="single" selected={customTo} onSelect={(d) => { setCustomTo(d); setPreset("custom"); }} className={cn("p-2 pointer-events-auto")} />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </motion.div>

      {/* ═══ KPI CARDS ═══ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Trophy, label: "Vendas", value: totalVendas, format: (v: number) => String(v), color: "hsl(160, 60%, 42%)", emoji: "🏆" },
            { icon: TrendingUp, label: "VGV Total", value: totalVGV, format: formatCurrency, color: "hsl(142, 70%, 45%)", emoji: "💰" },
            { icon: DollarSign, label: "Ticket Médio", value: ticketMedio, format: formatCurrency, color: "hsl(210, 70%, 55%)", emoji: "📊" },
            { icon: Star, label: "Corretagem (5%)", value: totalCorretagem, format: formatCurrency, color: "hsl(45, 90%, 50%)", emoji: "⭐", sub: `5% do VGV total` },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} whileHover={{ y: -2 }} transition={{ duration: 0.15 }}
              className="rounded-2xl p-4 bg-card border border-border/60 hover:shadow-lg transition-shadow relative overflow-hidden">
              <div className="absolute top-2 right-2 text-2xl opacity-10">{kpi.emoji}</div>
              <div className="flex items-center gap-1.5 mb-2">
                <kpi.icon className="h-4 w-4" style={{ color: kpi.color }} />
                <span className="text-[11px] font-medium text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-2xl font-black leading-none" style={{ color: kpi.color }}>
                {kpi.format(kpi.value)}
              </p>
              {kpi.sub && <p className="text-[10px] text-muted-foreground mt-1">{kpi.sub}</p>}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ═══ COMMISSION BREAKDOWN ═══ */}
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
                        const annualVgv = v.corretor_id ? (annualVgvByCorretor[v.corretor_id] || 0) : 0;
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
                                {corr ? (
                                  <div className="flex items-center gap-1.5">
                                    <Avatar className="h-5 w-5">
                                      {(corr.avatar_gamificado_url || corr.avatar_url) && <img src={corr.avatar_gamificado_url || corr.avatar_url!} className="h-5 w-5 rounded-full object-cover" />}
                                      <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{getInitials(corr.nome)}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs text-foreground">{corr.nome.split(" ")[0]}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">—</span>
                                )}
                              </td>
                            )}
                            <td className="py-3 px-3 text-right">
                              <span className="text-sm font-black text-emerald-500">{formatCurrency(vgv)}</span>
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
    </div>
  );
}
