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
  ligacoes: number;
  visitas_marcadas: number;
  visitas_realizadas: number;
  vgv: number;
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

    const [r1, r2, r3, r4] = await Promise.all([
      // Ligações — corretor_id = user_id
      supabase.from("oferta_ativa_tentativas").select("corretor_id").in("corretor_id", teamUserIds).gte("created_at", `${mesInicio}T00:00:00-03:00`).lte("created_at", `${mesFim}T23:59:59.999-03:00`),
      // Visitas — corretor_id = user_id
      supabase.from("visitas").select("corretor_id, status").in("corretor_id", teamUserIds).gte("data_visita", mesInicio).lte("data_visita", mesFim),
      // Negócios — corretor_id = profiles.id, filter by data_assinatura in month
      supabase.from("negocios").select("id, vgv_estimado, vgv_final, corretor_id").in("corretor_id", teamProfileIds).in("fase", ["assinado", "vendido"]).gte("data_assinatura", mesInicio).lte("data_assinatura", mesFim),
      // Saved metas
      supabase.from("ceo_metas_mensais").select("*").eq("gerente_id", user.id).eq("mes", mesAtual).maybeSingle(),
    ]);

    const tentativas = r1.data || [];
    const visitas = r2.data || [];
    const negociosArr = r3.data || [];
    const metasSalvas = r4.data as any;

    const ligR = tentativas.length;
    const vmR = visitas.filter(v => v.status !== "cancelada").length;
    const vrR = visitas.filter(v => v.status === "realizada").length;
    const vgvReal = negociosArr.reduce((s, n) => s + Number(n.vgv_final || n.vgv_estimado || 0), 0);

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
      contribMap[uid] = { user_id: uid, nome: teamNameMap[uid] || "Corretor", ligacoes: 0, visitas_marcadas: 0, visitas_realizadas: 0, vgv: 0 };
    });
    tentativas.forEach(t => { if (contribMap[t.corretor_id]) contribMap[t.corretor_id].ligacoes++; });
    visitas.forEach(v => {
      if (v.corretor_id && contribMap[v.corretor_id]) {
        if (v.status !== "cancelada") contribMap[v.corretor_id].visitas_marcadas++;
        if (v.status === "realizada") contribMap[v.corretor_id].visitas_realizadas++;
      }
    });
    // Negócios use profile_id → resolve to user_id
    negociosArr.forEach(n => {
      if (!n.corretor_id) return;
      const uid = profileToUser[n.corretor_id];
      if (uid && contribMap[uid]) {
        contribMap[uid].vgv += Number(n.vgv_final || n.vgv_estimado || 0);
      }
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
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-2.5 px-3 text-[11px] text-muted-foreground font-semibold">Corretor</th>
                  <th className="text-center py-2.5 px-3 text-[11px] text-muted-foreground font-semibold">Ligações</th>
                  <th className="text-center py-2.5 px-3 text-[11px] text-muted-foreground font-semibold">% Lig</th>
                  <th className="text-center py-2.5 px-3 text-[11px] text-muted-foreground font-semibold">Vis Marc</th>
                  <th className="text-center py-2.5 px-3 text-[11px] text-muted-foreground font-semibold">% V.Marc</th>
                  <th className="text-center py-2.5 px-3 text-[11px] text-muted-foreground font-semibold">Vis Real</th>
                  <th className="text-center py-2.5 px-3 text-[11px] text-muted-foreground font-semibold">% V.Real</th>
                  <th className="text-center py-2.5 px-3 text-[11px] text-muted-foreground font-semibold">VGV</th>
                  <th className="text-center py-2.5 px-3 text-[11px] text-muted-foreground font-semibold">% VGV</th>
                </tr>
              </thead>
              <tbody>
                {contrib.map(c => {
                  const totalLig = metas.ligacoes_realizado || 1;
                  const totalVm = metas.visitas_marcadas_realizado || 1;
                  const totalVr = metas.visitas_realizadas_realizado || 1;
                  const totalVgv = metas.vgv_realizado || 1;
                  return (
                    <tr key={c.user_id} className="border-b border-border/20 hover:bg-accent/30">
                      <td className="py-2 px-3 text-xs font-semibold text-foreground">{c.nome.split(" ").slice(0, 2).join(" ")}</td>
                      <td className="py-2 px-3 text-center text-xs">{c.ligacoes}</td>
                      <td className="py-2 px-3 text-center text-xs text-muted-foreground">{pct(c.ligacoes, totalLig)}%</td>
                      <td className="py-2 px-3 text-center text-xs">{c.visitas_marcadas}</td>
                      <td className="py-2 px-3 text-center text-xs text-muted-foreground">{pct(c.visitas_marcadas, totalVm)}%</td>
                      <td className="py-2 px-3 text-center text-xs">{c.visitas_realizadas}</td>
                      <td className="py-2 px-3 text-center text-xs text-muted-foreground">{pct(c.visitas_realizadas, totalVr)}%</td>
                      <td className="py-2 px-3 text-center text-xs font-bold text-emerald-600">{fmtR(c.vgv)}</td>
                      <td className="py-2 px-3 text-center text-xs text-muted-foreground">{pct(c.vgv, totalVgv)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
