import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Phone, UserCheck, MapPin, CalendarIcon, ChevronLeft, ChevronRight,
  MessageSquare, Save, Lock, Pencil, Send,
} from "lucide-react";

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
  goal_status: string | null;
  goal_id: string | null;
}

interface Props {
  teamUserIds: string[];
  teamNameMap: Record<string, string>;
}

const PRESENCA_OPTIONS = [
  { value: "presente", label: "Presente", icon: "✅" },
  { value: "meio_periodo", label: "½ Período", icon: "⏰" },
  { value: "ausente", label: "Ausente", icon: "❌" },
  { value: "atestado", label: "Atestado", icon: "🏥" },
  { value: "folga", label: "Folga", icon: "🏖️" },
];

function MiniRing({ value, max, size = 52, strokeWidth = 4, color = "hsl(var(--primary))" }: {
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
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-extrabold text-foreground leading-none">{value}</span>
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

    const oaLig: Record<string, number> = {};
    const oaAprov: Record<string, number> = {};
    (r3.data || []).forEach((t: any) => { oaLig[t.corretor_id] = (oaLig[t.corretor_id] || 0) + 1; if (t.resultado === "com_interesse") oaAprov[t.corretor_id] = (oaAprov[t.corretor_id] || 0) + 1; });

    const vmCount: Record<string, number> = {};
    const vrCount: Record<string, number> = {};
    (r4.data || []).forEach((v: any) => { vmCount[v.corretor_id] = (vmCount[v.corretor_id] || 0) + 1; if (v.status === "realizada") vrCount[v.corretor_id] = (vrCount[v.corretor_id] || 0) + 1; });

    const saved: Record<string, any> = {};
    (r5.data || []).forEach((s: any) => { saved[s.corretor_id] = s; });

    const goals: Record<string, any> = {};
    (r6.data || []).forEach((g: any) => { goals[g.corretor_id] = g; });

    const dispStatus: Record<string, string> = {};
    (r7.data || []).forEach((d: any) => { dispStatus[d.user_id] = d.status; });

    const newCards: CorretorCard[] = members.filter((m: any) => m.user_id && teamUserIds.includes(m.user_id)).map((m: any) => {
      const uid = m.user_id;
      const s = saved[uid]; const g = goals[uid]; const prof = profiles[uid];
      const isOnline = dispStatus[uid] === "online";
      let presenca = s?.presenca ?? "nao_informado";
      if (presenca === "nao_informado" && ((oaLig[uid] || 0) > 0 || isOnline)) presenca = "presente";

      return {
        user_id: uid, team_member_id: m.id, nome: m.nome,
        telefone: prof?.telefone || null, avatar_url: prof?.avatar_url || null, presenca,
        meta_ligacoes: s?.meta_ligacoes > 0 ? s.meta_ligacoes : (g?.meta_ligacoes ?? 30),
        meta_aproveitados: s?.meta_aproveitados > 0 ? s.meta_aproveitados : (g?.meta_aproveitados ?? 3),
        meta_visitas_marcar: s?.meta_visitas_marcar > 0 ? s.meta_visitas_marcar : (g?.meta_visitas_marcadas ?? 1),
        res_ligacoes: oaLig[uid] ?? s?.res_ligacoes ?? 0,
        res_aproveitados: oaAprov[uid] ?? s?.res_aproveitados ?? 0,
        res_visitas_marcadas: vmCount[uid] ?? s?.res_visitas_marcadas ?? 0,
        res_visitas_realizadas: vrCount[uid] ?? s?.res_visitas_realizadas ?? 0,
        res_propostas: s?.res_propostas ?? 0,
        obs_gerente: s?.obs_gerente ?? "", obs_dia: s?.obs_dia ?? "",
        status_online: prof?.status_online || (isOnline ? "online" : null),
      };
    });

    newCards.sort((a, b) => {
      const aOn = a.status_online === "online" ? 1 : 0;
      const bOn = b.status_online === "online" ? 1 : 0;
      if (aOn !== bOn) return bOn - aOn;
      return b.res_ligacoes - a.res_ligacoes;
    });

    setCards(newCards);
    setLoading(false);
  }, [user, teamUserIds, dateStr]);

  useEffect(() => { loadData(); }, [loadData]);

  // NO realtime - removed to prevent infinite refresh

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
    const msg = `${saudacao}, ${card.nome.split(" ")[0]}! 📊\n\n📞 Ligações: ${card.res_ligacoes}/${card.meta_ligacoes}\n✅ Aproveitados: ${card.res_aproveitados}\n📅 Visitas: ${card.res_visitas_marcadas}\n\nBora aumentar esses números! 💪🔥`;
    window.open(getWhatsAppUrl(card.telefone, msg), "_blank");
  };

  const nudgeAllBelowTarget = () => {
    const below = cards.filter(c => { if (["ausente", "atestado", "folga"].includes(c.presenca)) return false; return c.meta_ligacoes > 0 && c.res_ligacoes < c.meta_ligacoes * 0.5; });
    if (below.length === 0) { toast.info("Todos acima de 50% da meta!"); return; }
    below.forEach(c => { if (c.telefone) nudgeWhatsApp(c); });
    toast.success(`📢 Cobrança enviada para ${below.length} corretores`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mr-3" />
        Carregando checkpoint...
      </div>
    );
  }

  const totalLig = cards.reduce((a, c) => a + c.res_ligacoes, 0);
  const totalAprov = cards.reduce((a, c) => a + c.res_aproveitados, 0);
  const totalVM = cards.reduce((a, c) => a + c.res_visitas_marcadas, 0);
  const presentes = cards.filter(c => !["ausente", "atestado", "folga", "nao_informado"].includes(c.presenca)).length;
  const totalMetaLig = cards.filter(c => !["ausente", "atestado", "folga"].includes(c.presenca)).reduce((a, c) => a + c.meta_ligacoes, 0);
  const pctGeral = totalMetaLig > 0 ? Math.round((totalLig / totalMetaLig) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Toolbar - compact, aligned */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDate(d => subDays(d, 1))}>
          <ChevronLeft size={14} />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-[130px] justify-center gap-2 font-medium text-xs h-8">
              <CalendarIcon size={12} /> {dateFmt}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar mode="single" selected={selectedDate} onSelect={d => d && setSelectedDate(d)} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDate(d => addDays(d, 1))}>
          <ChevronRight size={14} />
        </Button>

        {isToday && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> AO VIVO
          </span>
        )}

        {/* Quick stats */}
        <div className="hidden sm:flex items-center gap-2.5 ml-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><Phone size={10} className="text-blue-500" /> <b className="text-foreground">{totalLig}</b></span>
          <span className="flex items-center gap-1"><UserCheck size={10} className="text-emerald-500" /> <b className="text-foreground">{totalAprov}</b></span>
          <span className="flex items-center gap-1"><MapPin size={10} className="text-purple-500" /> <b className="text-foreground">{totalVM}</b></span>
          <span className={cn("font-bold px-1.5 py-0.5 rounded-full", pctGeral >= 80 ? "bg-emerald-500/15 text-emerald-700" : pctGeral >= 40 ? "bg-amber-500/15 text-amber-700" : "bg-destructive/10 text-destructive")}>{pctGeral}%</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="text-[10px] gap-1 h-7 text-amber-700 border-amber-300 hover:bg-amber-50" onClick={nudgeAllBelowTarget}>
            <Send size={11} /> Cobrar time
          </Button>
          <Button variant="outline" size="sm" className="text-[10px] gap-1 h-7" onClick={() => { autoSave(); toast.success("✅ Salvo!"); }}>
            <Save size={11} /> Salvar
          </Button>
          <Button size="sm" className="text-[10px] gap-1 h-7 font-semibold" onClick={saveAndPublish} disabled={saving}>
            <Lock size={11} /> Publicar
          </Button>
        </div>
      </div>

      {/* Presença compacta - inline horizontal */}
      <div className="flex items-center gap-1.5 flex-wrap bg-card border border-border rounded-xl px-3 py-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
          Presença {presentes}/{cards.length}
        </span>
        {cards.map(card => {
          const status = getStatusSemaphore(card);
          const initial = card.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
          const isAbsent = ["ausente", "atestado", "folga"].includes(card.presenca);
          return (
            <div key={card.user_id} className={cn("flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px]", isAbsent ? "opacity-40" : "")}>
              <div className="relative">
                {card.avatar_url ? (
                  <img src={card.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[7px] font-bold text-primary">{initial}</div>
                )}
                <span className={cn("absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-card", status.color)} />
              </div>
              <select
                value={card.presenca}
                onChange={e => updateCard(card.user_id, "presenca", e.target.value)}
                className="text-[9px] bg-transparent border-0 cursor-pointer text-muted-foreground p-0 w-auto"
              >
                {PRESENCA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.icon}</option>)}
              </select>
            </div>
          );
        })}
      </div>

      {/* Compact Corretor Cards - 3-4 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(card => {
          const isAbsent = ["ausente", "atestado", "folga"].includes(card.presenca);
          const status = getStatusSemaphore(card);
          const ligPct = card.meta_ligacoes > 0 ? Math.round((card.res_ligacoes / card.meta_ligacoes) * 100) : 0;
          const ligColor = ligPct >= 80 ? "hsl(160,60%,42%)" : ligPct >= 40 ? "hsl(40,96%,50%)" : "hsl(0,72%,51%)";

          if (isAbsent) {
            return (
              <div key={card.user_id} className="bg-card border border-border rounded-xl p-4 opacity-40">
                <div className="flex items-center gap-3">
                  {card.avatar_url ? (
                    <img src={card.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {card.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">{card.nome.split(" ").slice(0, 2).join(" ")}</span>
                    <p className="text-xs text-muted-foreground">{PRESENCA_OPTIONS.find(o => o.value === card.presenca)?.icon} {PRESENCA_OPTIONS.find(o => o.value === card.presenca)?.label}</p>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={card.user_id} className={cn(
              "bg-card border rounded-xl p-4 transition-all hover:shadow-md",
              status.emoji === "🚨" ? "border-destructive/40" : status.emoji === "⚠️" ? "border-amber-400/60" : "border-border"
            )}>
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    {card.avatar_url ? (
                      <img src={card.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {card.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                    )}
                    <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card", status.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{card.nome.split(" ").slice(0, 2).join(" ")}</p>
                    <p className="text-xs text-muted-foreground">{status.emoji} {status.label}</p>
                  </div>
                </div>
                {card.telefone && (
                  <button onClick={() => nudgeWhatsApp(card)} className="h-7 w-7 flex items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-500/10 transition-colors">
                    <MessageSquare size={14} />
                  </button>
                )}
              </div>

              {/* Rings */}
              <div className="flex items-center justify-around mb-3">
                <div className="flex flex-col items-center gap-1">
                  <MiniRing value={card.res_ligacoes} max={card.meta_ligacoes} color={ligColor} />
                  <span className="text-[10px] font-medium text-muted-foreground">Ligações</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <MiniRing value={card.res_aproveitados} max={card.meta_aproveitados}
                    color={card.res_aproveitados >= card.meta_aproveitados ? "hsl(160,60%,42%)" : "hsl(231,100%,65%)"} />
                  <span className="text-[10px] font-medium text-muted-foreground">Aprov</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <MiniRing value={card.res_visitas_marcadas} max={card.meta_visitas_marcar}
                    color={card.res_visitas_marcadas >= card.meta_visitas_marcar ? "hsl(160,60%,42%)" : "hsl(280,60%,55%)"} />
                  <span className="text-[10px] font-medium text-muted-foreground">Visitas</span>
                </div>
              </div>

              {/* Metas */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Meta:</span>
                <input type="number" min={0} value={card.meta_ligacoes || ""} onChange={e => updateCard(card.user_id, "meta_ligacoes", parseInt(e.target.value) || 0)}
                  className="w-10 text-center text-xs border border-border rounded-md py-0.5 bg-background text-foreground" title="Ligações" />
                <input type="number" min={0} value={card.meta_aproveitados || ""} onChange={e => updateCard(card.user_id, "meta_aproveitados", parseInt(e.target.value) || 0)}
                  className="w-10 text-center text-xs border border-border rounded-md py-0.5 bg-background text-foreground" title="Aproveit." />
                <input type="number" min={0} value={card.meta_visitas_marcar || ""} onChange={e => updateCard(card.user_id, "meta_visitas_marcar", parseInt(e.target.value) || 0)}
                  className="w-10 text-center text-xs border border-border rounded-md py-0.5 bg-background text-foreground" title="Visitas" />
              </div>

              {/* Feedback */}
              {editingObs === card.user_id ? (
                <textarea value={card.obs_gerente} onChange={e => updateCard(card.user_id, "obs_gerente", e.target.value)}
                  onBlur={() => setEditingObs(null)} autoFocus rows={1}
                  placeholder="Feedback..."
                  className="w-full text-xs border border-primary/30 rounded-lg py-1.5 px-2 focus:outline-none resize-none bg-background text-foreground" />
              ) : (
                <button onClick={() => setEditingObs(card.user_id)}
                  className="w-full flex items-center gap-1.5 text-xs border border-border rounded-lg py-1.5 px-2 hover:border-primary/30 text-left truncate transition-colors">
                  <Pencil size={10} className="text-muted-foreground shrink-0" />
                  <span className={card.obs_gerente ? "text-foreground truncate" : "text-muted-foreground truncate"}>
                    {card.obs_gerente || "Feedback..."}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
