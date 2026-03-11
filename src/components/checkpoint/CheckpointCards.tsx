import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Phone, UserCheck, MapPin, CalendarIcon, ChevronLeft, ChevronRight,
  MessageSquare, Save, Lock, RefreshCw, Copy, Pencil, AlertTriangle,
  Check, X, Clock, Coffee, FileText, Send,
} from "lucide-react";

// ─── Types ───
interface CorretorCard {
  user_id: string;
  team_member_id: string;
  nome: string;
  telefone: string | null;
  avatar_url: string | null;
  presenca: string;
  meta_ligacoes: number;
  meta_aproveitados: number;
  meta_visitas_marcar: number;
  res_ligacoes: number;
  res_aproveitados: number;
  res_visitas_marcadas: number;
  res_visitas_realizadas: number;
  res_propostas: number;
  obs_gerente: string;
  obs_dia: string;
  status_online: string | null;
}

interface Props {
  teamUserIds: string[];
  teamNameMap: Record<string, string>;
}

const PRESENCA_OPTIONS = [
  { value: "presente", label: "Presente", icon: "✅", style: "bg-emerald-500/15 text-emerald-700 border-emerald-300" },
  { value: "meio_periodo", label: "½ Período", icon: "⏰", style: "bg-blue-500/15 text-blue-700 border-blue-300" },
  { value: "ausente", label: "Ausente", icon: "❌", style: "bg-destructive/15 text-destructive border-destructive/30" },
  { value: "atestado", label: "Atestado", icon: "🏥", style: "bg-amber-500/15 text-amber-700 border-amber-300" },
  { value: "folga", label: "Folga", icon: "🏖️", style: "bg-cyan-500/15 text-cyan-700 border-cyan-300" },
];

function CircularProgress({ value, max, size = 64, strokeWidth = 5, color = "hsl(var(--primary))" }: {
  value: number; max: number; size?: number; strokeWidth?: number; color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference - pct * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="hsl(var(--muted))" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-extrabold text-foreground leading-none">{value}</span>
        <span className="text-[8px] text-muted-foreground">/{max}</span>
      </div>
    </div>
  );
}

function getStatusSemaphore(row: CorretorCard): { color: string; label: string; emoji: string } {
  if (["ausente", "atestado", "folga"].includes(row.presenca)) return { color: "bg-muted", label: "Fora", emoji: "💤" };
  const pctLig = row.meta_ligacoes > 0 ? row.res_ligacoes / row.meta_ligacoes : 1;
  if (pctLig >= 0.8) return { color: "bg-emerald-500", label: "No ritmo", emoji: "🔥" };
  if (pctLig >= 0.4) return { color: "bg-amber-500", label: "Atenção", emoji: "⚠️" };
  if (row.res_ligacoes > 0) return { color: "bg-amber-500", label: "Baixo", emoji: "⚠️" };
  return { color: "bg-destructive", label: "Parado", emoji: "🚨" };
}

function getWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export default function CheckpointCards({ teamUserIds, teamNameMap }: Props) {
  const { user } = useAuth();
  const [cards, setCards] = useState<CorretorCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingObs, setEditingObs] = useState<string | null>(null);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const dateFmt = format(selectedDate, "dd/MM/yyyy");
  const isToday = dateStr === format(new Date(), "yyyy-MM-dd");

  const loadData = useCallback(async () => {
    if (!user || teamUserIds.length === 0) return;
    setLoading(true);

    // Fetch all data in parallel
    const q1: any = supabase.from("team_members").select("id, nome, user_id, equipe").eq("gerente_id", user.id).eq("status", "ativo");
    const q2: any = supabase.from("profiles").select("user_id, telefone, avatar_url, status_online").in("user_id", teamUserIds);
    const q3: any = supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado").in("corretor_id", teamUserIds).gte("created_at", `${dateStr}T00:00:00`).lte("created_at", `${dateStr}T23:59:59`);
    const q4: any = supabase.from("visitas").select("corretor_id, status").in("corretor_id", teamUserIds).eq("data_visita", dateStr);
    const q5: any = supabase.from("checkpoint_diario").select("*").eq("data", dateStr).in("corretor_id", teamUserIds);
    const q6: any = supabase.from("corretor_daily_goals").select("corretor_id, meta_ligacoes, meta_aproveitados, meta_visitas_marcadas").in("corretor_id", teamUserIds).eq("data", dateStr);
    const q7: any = supabase.from("corretor_disponibilidade").select("user_id, status").in("user_id", teamUserIds);

    const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([q1, q2, q3, q4, q5, q6, q7]);

    const members = r1.data || [];
    const profiles: Record<string, any> = {};
    (r2.data || []).forEach((p: any) => { profiles[p.user_id] = p; });
    
    // OA stats
    const oaLig: Record<string, number> = {};
    const oaAprov: Record<string, number> = {};
    (r3.data || []).forEach((t: any) => {
      oaLig[t.corretor_id] = (oaLig[t.corretor_id] || 0) + 1;
      if (t.resultado === "com_interesse") oaAprov[t.corretor_id] = (oaAprov[t.corretor_id] || 0) + 1;
    });

    // Visitas
    const vmCount: Record<string, number> = {};
    const vrCount: Record<string, number> = {};
    (r4.data || []).forEach((v: any) => {
      vmCount[v.corretor_id] = (vmCount[v.corretor_id] || 0) + 1;
      if (v.status === "realizada") vrCount[v.corretor_id] = (vrCount[v.corretor_id] || 0) + 1;
    });

    // Saved checkpoint
    const saved: Record<string, any> = {};
    (r5.data || []).forEach((s: any) => { saved[s.corretor_id] = s; });

    // Goals
    const goals: Record<string, any> = {};
    (r6.data || []).forEach((g: any) => { goals[g.corretor_id] = g; });

    // Disponibilidade
    const dispStatus: Record<string, string> = {};
    (r7.data || []).forEach((d: any) => { dispStatus[d.user_id] = d.status; });

    const newCards: CorretorCard[] = members
      .filter((m: any) => m.user_id && teamUserIds.includes(m.user_id))
      .map((m: any) => {
        const uid = m.user_id;
        const s = saved[uid];
        const g = goals[uid];
        const prof = profiles[uid];
        const isOnline = dispStatus[uid] === "online";
        const hadActivity = (oaLig[uid] || 0) > 0;

        let presenca = s?.presenca ?? "nao_informado";
        if (presenca === "nao_informado" && (hadActivity || isOnline)) presenca = "presente";

        return {
          user_id: uid,
          team_member_id: m.id,
          nome: m.nome,
          telefone: prof?.telefone || null,
          avatar_url: prof?.avatar_url || null,
          presenca,
          meta_ligacoes: s?.meta_ligacoes > 0 ? s.meta_ligacoes : (g?.meta_ligacoes ?? 30),
          meta_aproveitados: s?.meta_aproveitados > 0 ? s.meta_aproveitados : (g?.meta_aproveitados ?? 3),
          meta_visitas_marcar: s?.meta_visitas_marcar > 0 ? s.meta_visitas_marcar : (g?.meta_visitas_marcadas ?? 1),
          res_ligacoes: oaLig[uid] ?? s?.res_ligacoes ?? 0,
          res_aproveitados: oaAprov[uid] ?? s?.res_aproveitados ?? 0,
          res_visitas_marcadas: vmCount[uid] ?? s?.res_visitas_marcadas ?? 0,
          res_visitas_realizadas: vrCount[uid] ?? s?.res_visitas_realizadas ?? 0,
          res_propostas: s?.res_propostas ?? 0,
          obs_gerente: s?.obs_gerente ?? "",
          obs_dia: s?.obs_dia ?? "",
          status_online: prof?.status_online || (isOnline ? "online" : null),
        };
      });

    // Sort: online first, then by ligações desc
    newCards.sort((a, b) => {
      const aOnline = a.status_online === "online" ? 1 : 0;
      const bOnline = b.status_online === "online" ? 1 : 0;
      if (aOnline !== bOnline) return bOnline - aOnline;
      return b.res_ligacoes - a.res_ligacoes;
    });

    setCards(newCards);
    setLoading(false);
  }, [user, teamUserIds, dateStr]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime
  useEffect(() => {
    if (teamUserIds.length === 0) return;
    const channel = supabase.channel("checkpoint-cards-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "oferta_ativa_tentativas" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "visitas" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamUserIds, loadData]);

  // ─── Actions ───
  const updateCard = (uid: string, field: keyof CorretorCard, value: any) => {
    setCards(prev => prev.map(c => c.user_id === uid ? { ...c, [field]: value } : c));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => autoSave(), 2000);
  };

  const autoSave = async () => {
    const upserts = cards.map(c => ({
      corretor_id: c.user_id, data: dateStr,
      presenca: c.presenca === "nao_informado" ? "presente" : c.presenca,
      meta_ligacoes: c.meta_ligacoes, meta_aproveitados: c.meta_aproveitados, meta_visitas_marcar: c.meta_visitas_marcar,
      obs_gerente: c.obs_gerente,
      res_ligacoes: c.res_ligacoes, res_aproveitados: c.res_aproveitados,
      res_visitas_marcadas: c.res_visitas_marcadas, res_visitas_realizadas: c.res_visitas_realizadas,
      res_propostas: c.res_propostas, obs_dia: c.obs_dia,
    }));
    await supabase.from("checkpoint_diario").upsert(upserts, { onConflict: "corretor_id,data" });
  };

  const saveAndPublish = async () => {
    setSaving(true);
    await autoSave();
    await supabase.from("checkpoint_diario").update({ publicado: true }).eq("data", dateStr).in("corretor_id", cards.map(c => c.user_id));
    setSaving(false);
    toast.success("🔒 Checkpoint publicado!");
  };

  const nudgeWhatsApp = (card: CorretorCard) => {
    if (!card.telefone) { toast.error("Corretor sem telefone cadastrado."); return; }
    const hora = new Date().getHours();
    const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
    const msg = `${saudacao}, ${card.nome.split(" ")[0]}! 📊\n\nSeu checkpoint de hoje:\n📞 Ligações: ${card.res_ligacoes}/${card.meta_ligacoes}\n✅ Aproveitados: ${card.res_aproveitados}\n📅 Visitas: ${card.res_visitas_marcadas}\n\nBora aumentar esses números! 💪🔥`;
    window.open(getWhatsAppUrl(card.telefone, msg), "_blank");
    toast.success(`💬 WhatsApp aberto para ${card.nome.split(" ")[0]}`);
  };

  const nudgeAllBelowTarget = () => {
    const below = cards.filter(c => {
      if (["ausente", "atestado", "folga"].includes(c.presenca)) return false;
      return c.meta_ligacoes > 0 && c.res_ligacoes < c.meta_ligacoes * 0.5;
    });
    if (below.length === 0) { toast.info("Todos estão acima de 50% da meta!"); return; }
    below.forEach(c => {
      if (c.telefone) nudgeWhatsApp(c);
    });
    toast.success(`📢 Cobrança enviada para ${below.length} corretores`);
  };

  const copyFromYesterday = async () => {
    const yesterday = format(subDays(selectedDate, 1), "yyyy-MM-dd");
    const { data } = await supabase.from("checkpoint_diario").select("corretor_id, meta_ligacoes, meta_aproveitados, meta_visitas_marcar").eq("data", yesterday).in("corretor_id", cards.map(c => c.user_id));
    if (!data?.length) { toast.error("Sem dados de ontem."); return; }
    const map: Record<string, any> = {};
    data.forEach((d: any) => { map[d.corretor_id] = d; });
    setCards(prev => prev.map(c => {
      const y = map[c.user_id];
      if (!y) return c;
      return { ...c, meta_ligacoes: y.meta_ligacoes, meta_aproveitados: y.meta_aproveitados, meta_visitas_marcar: y.meta_visitas_marcar };
    }));
    toast.success("📋 Metas copiadas de ontem!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mr-3" />
        Carregando checkpoint...
      </div>
    );
  }

  // ─── Totals ───
  const totalLig = cards.reduce((a, c) => a + c.res_ligacoes, 0);
  const totalAprov = cards.reduce((a, c) => a + c.res_aproveitados, 0);
  const totalVM = cards.reduce((a, c) => a + c.res_visitas_marcadas, 0);
  const totalVR = cards.reduce((a, c) => a + c.res_visitas_realizadas, 0);
  const presentes = cards.filter(c => !["ausente", "atestado", "folga", "nao_informado"].includes(c.presenca)).length;
  const totalMetaLig = cards.filter(c => !["ausente", "atestado", "folga"].includes(c.presenca)).reduce((a, c) => a + c.meta_ligacoes, 0);
  const pctGeral = totalMetaLig > 0 ? Math.round((totalLig / totalMetaLig) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* ═══ TOOLBAR ═══ */}
      <div className="flex flex-wrap items-center gap-2 bg-card border border-border rounded-xl px-4 py-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => subDays(d, 1))}>
          <ChevronLeft size={16} />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[150px] justify-center gap-2 font-medium">
              <CalendarIcon size={14} /> {dateFmt}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar mode="single" selected={selectedDate} onSelect={d => d && setSelectedDate(d)} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => addDays(d, 1))}>
          <ChevronRight size={16} />
        </Button>

        {isToday && (
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> AO VIVO
          </span>
        )}

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8" onClick={() => loadData()}>
            <RefreshCw size={13} /> Sync
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8" onClick={copyFromYesterday}>
            <Copy size={13} /> Copiar ontem
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8 text-amber-700 border-amber-300 hover:bg-amber-50" onClick={nudgeAllBelowTarget}>
            <Send size={13} /> Cobrar time
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8" onClick={() => { autoSave(); toast.success("✅ Salvo!"); }}>
            <Save size={13} /> Salvar
          </Button>
          <Button size="sm" className="text-xs gap-1.5 h-8 font-semibold" onClick={saveAndPublish} disabled={saving}>
            <Lock size={13} /> {saving ? "Publicando..." : "Publicar"}
          </Button>
        </div>
      </div>

      {/* ═══ PRESENÇA BAR ═══ */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Presença — {presentes}/{cards.length} presentes
          </h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Phone size={12} className="text-blue-500" /> <b className="text-foreground">{totalLig}</b></span>
            <span className="flex items-center gap-1"><UserCheck size={12} className="text-emerald-500" /> <b className="text-foreground">{totalAprov}</b></span>
            <span className="flex items-center gap-1"><MapPin size={12} className="text-purple-500" /> <b className="text-foreground">{totalVM}</b></span>
            <span className={cn("font-bold px-2 py-0.5 rounded-full text-[10px]", pctGeral >= 80 ? "bg-emerald-500/15 text-emerald-700" : pctGeral >= 40 ? "bg-amber-500/15 text-amber-700" : "bg-destructive/10 text-destructive")}>
              {pctGeral}% da meta
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {cards.map(card => {
            const status = getStatusSemaphore(card);
            const isAbsent = ["ausente", "atestado", "folga"].includes(card.presenca);
            const initial = card.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
            return (
              <div key={card.user_id} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs", isAbsent ? "opacity-50 bg-muted/30 border-border" : "bg-card border-border hover:border-primary/30")}>
                <div className="relative">
                  {card.avatar_url ? (
                    <img src={card.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{initial}</div>
                  )}
                  <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card", status.color)} />
                </div>
                <span className="font-medium text-foreground">{card.nome.split(" ")[0]}</span>
                <select
                  value={card.presenca}
                  onChange={e => updateCard(card.user_id, "presenca", e.target.value)}
                  className="text-[10px] font-medium bg-transparent border-0 cursor-pointer text-muted-foreground p-0"
                >
                  {PRESENCA_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ CORRETOR CARDS ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {cards.map(card => {
          const isAbsent = ["ausente", "atestado", "folga"].includes(card.presenca);
          const status = getStatusSemaphore(card);
          const ligPct = card.meta_ligacoes > 0 ? Math.round((card.res_ligacoes / card.meta_ligacoes) * 100) : 0;
          const ligColor = ligPct >= 80 ? "hsl(160, 60%, 42%)" : ligPct >= 40 ? "hsl(40, 96%, 50%)" : "hsl(0, 72%, 51%)";

          if (isAbsent) {
            return (
              <div key={card.user_id} className="bg-card border border-border rounded-xl p-4 opacity-50">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {card.avatar_url ? (
                      <img src={card.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover grayscale" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                        {card.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">{card.nome}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {PRESENCA_OPTIONS.find(o => o.value === card.presenca)?.icon} {PRESENCA_OPTIONS.find(o => o.value === card.presenca)?.label}
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={card.user_id} className={cn(
              "bg-card border rounded-xl p-4 transition-all hover:shadow-md",
              status.emoji === "🚨" ? "border-destructive/30" : status.emoji === "⚠️" ? "border-amber-300" : "border-border hover:border-primary/20"
            )}>
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {card.avatar_url ? (
                      <img src={card.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {card.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                    )}
                    <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card", status.color)} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{card.nome}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      {status.emoji} {status.label}
                      {card.status_online === "online" && <span className="text-emerald-600 font-semibold ml-1">• Online</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {card.telefone && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50" onClick={() => nudgeWhatsApp(card)} title="Cobrar via WhatsApp">
                      <MessageSquare size={14} />
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress Circles */}
              <div className="flex items-center justify-around mb-3">
                <div className="flex flex-col items-center gap-1">
                  <CircularProgress value={card.res_ligacoes} max={card.meta_ligacoes} color={ligColor} />
                  <span className="text-[9px] text-muted-foreground font-medium">Ligações</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <CircularProgress
                    value={card.res_aproveitados} max={card.meta_aproveitados} size={52} strokeWidth={4}
                    color={card.res_aproveitados >= card.meta_aproveitados ? "hsl(160, 60%, 42%)" : "hsl(231, 100%, 65%)"}
                  />
                  <span className="text-[9px] text-muted-foreground font-medium">Aproveit.</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <CircularProgress
                    value={card.res_visitas_marcadas} max={card.meta_visitas_marcar} size={52} strokeWidth={4}
                    color={card.res_visitas_marcadas >= card.meta_visitas_marcar ? "hsl(160, 60%, 42%)" : "hsl(280, 60%, 55%)"}
                  />
                  <span className="text-[9px] text-muted-foreground font-medium">Visitas M.</span>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 font-medium">
                  📞 {card.res_ligacoes} lig
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 font-medium">
                  ✅ {card.res_aproveitados} aprov
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 font-medium">
                  📅 {card.res_visitas_marcadas} vis.m / {card.res_visitas_realizadas} vis.r
                </span>
                {card.res_propostas > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 font-medium">
                    📝 {card.res_propostas} prop
                  </span>
                )}
              </div>

              {/* Metas (editable inline) */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] text-muted-foreground font-medium uppercase">Metas:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number" min={0} value={card.meta_ligacoes || ""}
                    onChange={e => updateCard(card.user_id, "meta_ligacoes", parseInt(e.target.value) || 0)}
                    className="w-10 text-center text-[10px] border border-border rounded py-0.5 bg-background text-foreground"
                    title="Meta ligações"
                  />
                  <input
                    type="number" min={0} value={card.meta_aproveitados || ""}
                    onChange={e => updateCard(card.user_id, "meta_aproveitados", parseInt(e.target.value) || 0)}
                    className="w-10 text-center text-[10px] border border-border rounded py-0.5 bg-background text-foreground"
                    title="Meta aproveitados"
                  />
                  <input
                    type="number" min={0} value={card.meta_visitas_marcar || ""}
                    onChange={e => updateCard(card.user_id, "meta_visitas_marcar", parseInt(e.target.value) || 0)}
                    className="w-10 text-center text-[10px] border border-border rounded py-0.5 bg-background text-foreground"
                    title="Meta visitas"
                  />
                </div>
              </div>

              {/* Feedback */}
              <div className="mt-2">
                {editingObs === card.user_id ? (
                  <div className="relative">
                    <textarea
                      value={card.obs_gerente}
                      onChange={e => updateCard(card.user_id, "obs_gerente", e.target.value)}
                      onBlur={() => setEditingObs(null)}
                      autoFocus
                      rows={2}
                      placeholder="Feedback para o corretor..."
                      className="w-full text-xs border border-primary/30 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none bg-background text-foreground"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingObs(card.user_id)}
                    className="w-full flex items-center gap-2 text-xs border border-border rounded-lg py-2 px-3 hover:border-primary/30 transition-colors text-left"
                  >
                    <Pencil size={10} className="text-muted-foreground shrink-0" />
                    <span className={card.obs_gerente ? "text-foreground" : "text-muted-foreground"}>
                      {card.obs_gerente || "Adicionar feedback..."}
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
