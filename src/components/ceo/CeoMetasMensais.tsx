import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Target, DollarSign, MapPin, Save, Edit2, Check } from "lucide-react";
import { toast } from "sonner";

interface GerenteMeta {
  gerente_id: string;
  gerente_nome: string;
  meta_vgv_assinado: number;
  meta_visitas_marcadas: number;
  meta_visitas_realizadas: number;
  real_vgv_assinado: number;
  real_visitas_marcadas: number;
  real_visitas_realizadas: number;
}

export default function CeoMetasMensais() {
  const [mes, setMes] = useState(format(new Date(), "yyyy-MM"));
  const [gerenteMetas, setGerenteMetas] = useState<GerenteMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ vgv: string; vmarc: string; vreal: string }>({ vgv: "", vmarc: "", vreal: "" });

  const load = useCallback(async () => {
    setLoading(true);

    // Get all gerentes (users with gestor/admin role)
    const { data: gerenteRoles } = await supabase.from("user_roles").select("user_id").in("role", ["gestor", "admin"]);
    const gerenteIds = (gerenteRoles || []).map(r => r.user_id);
    if (gerenteIds.length === 0) { setGerenteMetas([]); setLoading(false); return; }

    const { data: profiles } = await supabase.from("profiles").select("user_id, nome").in("user_id", gerenteIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.nome]));

    // Get saved metas for this month
    const { data: metas } = await supabase.from("ceo_metas_mensais").select("*").eq("mes", mes).in("gerente_id", gerenteIds);
    const metaMap = new Map((metas || []).map((m: any) => [m.gerente_id, m]));

    // Get real data from checkpoints for this month
    const start = format(startOfMonth(new Date(mes + "-01")), "yyyy-MM-dd");
    const end = format(endOfMonth(new Date(mes + "-01")), "yyyy-MM-dd");

    const { data: cps } = await supabase.from("checkpoints").select("id, gerente_id").gte("data", start).lte("data", end).in("gerente_id", gerenteIds);
    const cpIds = (cps || []).map(c => c.id);
    const cpGerenteMap = new Map((cps || []).map(c => [c.id, c.gerente_id]));

    // Visitas from checkpoint
    let visitasByGerente = new Map<string, { vmarc: number; vreal: number }>();
    if (cpIds.length > 0) {
      const { data: lines } = await supabase.from("checkpoint_lines").select("checkpoint_id, real_visitas_marcadas, real_visitas_realizadas").in("checkpoint_id", cpIds);
      for (const l of (lines || [])) {
        const gId = cpGerenteMap.get(l.checkpoint_id);
        if (!gId) continue;
        const curr = visitasByGerente.get(gId) || { vmarc: 0, vreal: 0 };
        curr.vmarc += (l.real_visitas_marcadas ?? 0);
        curr.vreal += (l.real_visitas_realizadas ?? 0);
        visitasByGerente.set(gId, curr);
      }
    }

    // VGV from negocios (source of truth)
    const { data: pdns } = await supabase.from("negocios").select("gerente_id, vgv_final, vgv_estimado, fase").in("fase", ["assinado", "vendido"]).gte("data_assinatura", `${mes}-01`).lte("data_assinatura", `${mes}-31`).in("gerente_id", gerenteIds);
    const vgvByGerente = new Map<string, number>();
    for (const p of (pdns || [])) {
      if (!p.gerente_id) continue;
      vgvByGerente.set(p.gerente_id, (vgvByGerente.get(p.gerente_id) || 0) + Number(p.vgv_final || p.vgv_estimado || 0));
    }

    const result: GerenteMeta[] = gerenteIds.map(gId => {
      const meta = metaMap.get(gId);
      const visitas = visitasByGerente.get(gId) || { vmarc: 0, vreal: 0 };
      const realVgv = vgvByGerente.get(gId) || 0;
      return {
        gerente_id: gId,
        gerente_nome: profileMap.get(gId) || "Gerente",
        meta_vgv_assinado: Number(meta?.meta_vgv_assinado ?? 0),
        meta_visitas_marcadas: Number(meta?.meta_visitas_marcadas ?? 0),
        meta_visitas_realizadas: Number(meta?.meta_visitas_realizadas ?? 0),
        real_vgv_assinado: realVgv,
        real_visitas_marcadas: visitas.vmarc,
        real_visitas_realizadas: visitas.vreal,
      };
    });

    setGerenteMetas(result);
    setLoading(false);
  }, [mes]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (g: GerenteMeta) => {
    setEditing(g.gerente_id);
    setEditValues({
      vgv: String(g.meta_vgv_assinado),
      vmarc: String(g.meta_visitas_marcadas),
      vreal: String(g.meta_visitas_realizadas),
    });
  };

  const saveMeta = async (gerenteId: string) => {
    const payload = {
      gerente_id: gerenteId,
      mes,
      meta_vgv_assinado: Number(editValues.vgv) || 0,
      meta_visitas_marcadas: Number(editValues.vmarc) || 0,
      meta_visitas_realizadas: Number(editValues.vreal) || 0,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("ceo_metas_mensais").upsert(payload, { onConflict: "gerente_id,mes" });
    if (error) { toast.error("Erro ao salvar meta"); console.error(error); return; }
    toast.success("Meta salva!");
    setEditing(null);
    load();
  };

  const pct = (real: number, meta: number) => meta > 0 ? Math.round((real / meta) * 100) : 0;

  // Company totals
  const companyMeta = gerenteMetas.reduce((acc, g) => ({
    meta_vgv: acc.meta_vgv + g.meta_vgv_assinado,
    real_vgv: acc.real_vgv + g.real_vgv_assinado,
    meta_vmarc: acc.meta_vmarc + g.meta_visitas_marcadas,
    real_vmarc: acc.real_vmarc + g.real_visitas_marcadas,
    meta_vreal: acc.meta_vreal + g.meta_visitas_realizadas,
    real_vreal: acc.real_vreal + g.real_visitas_realizadas,
  }), { meta_vgv: 0, real_vgv: 0, meta_vmarc: 0, real_vmarc: 0, meta_vreal: 0, real_vreal: 0 });

  const companyCards = [
    { label: "VGV Assinado", icon: DollarSign, real: companyMeta.real_vgv, meta: companyMeta.meta_vgv, currency: true },
    { label: "Visitas Marcadas", icon: MapPin, real: companyMeta.real_vmarc, meta: companyMeta.meta_vmarc },
    { label: "Visitas Realizadas", icon: Target, real: companyMeta.real_vreal, meta: companyMeta.meta_vreal },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h3 className="font-display font-semibold text-sm">Metas Mensais CEO</h3>
        <Input type="month" value={mes} onChange={e => setMes(e.target.value)} className="w-44" />
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : (
        <>
          {/* Company progress cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {companyCards.map(c => {
              const p = pct(c.real, c.meta);
              return (
                <div key={c.label} className="rounded-xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <c.icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{c.label}</span>
                  </div>
                  <p className="text-xl font-display font-bold text-foreground">
                    {c.currency ? `R$ ${c.real.toLocaleString("pt-BR")}` : c.real}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${p >= 80 ? "bg-success" : p >= 50 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${Math.min(p, 100)}%` }} />
                    </div>
                    <span className={`text-xs font-bold ${p >= 80 ? "text-success" : p >= 50 ? "text-warning" : "text-destructive"}`}>{p}%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Meta: {c.currency ? `R$ ${c.meta.toLocaleString("pt-BR")}` : c.meta}</p>
                </div>
              );
            })}
          </div>

          {/* Per-gerente table */}
          <div className="rounded-xl border border-border bg-card shadow-card overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-3 py-2 font-display font-semibold">Gerente</th>
                  <th className="px-2 py-2 text-center">Meta VGV</th>
                  <th className="px-2 py-2 text-center">Real VGV</th>
                  <th className="px-2 py-2 text-center">%</th>
                  <th className="px-2 py-2 text-center">Meta V.Mar</th>
                  <th className="px-2 py-2 text-center">Real V.Mar</th>
                  <th className="px-2 py-2 text-center">%</th>
                  <th className="px-2 py-2 text-center">Meta V.Real</th>
                  <th className="px-2 py-2 text-center">Real V.Real</th>
                  <th className="px-2 py-2 text-center">%</th>
                  <th className="px-2 py-2 text-center w-16">Ações</th>
                </tr>
              </thead>
              <tbody>
                {gerenteMetas.map(g => {
                  const isEditing = editing === g.gerente_id;
                  const pVgv = pct(g.real_vgv_assinado, g.meta_vgv_assinado);
                  const pVmarc = pct(g.real_visitas_marcadas, g.meta_visitas_marcadas);
                  const pVreal = pct(g.real_visitas_realizadas, g.meta_visitas_realizadas);
                  return (
                    <tr key={g.gerente_id} className="border-b border-border hover:bg-muted/10">
                      <td className="px-3 py-2 font-medium">{g.gerente_nome}</td>
                      <td className="px-2 py-2 text-center">
                        {isEditing ? <Input type="number" value={editValues.vgv} onChange={e => setEditValues(v => ({ ...v, vgv: e.target.value }))} className="h-7 w-24 text-xs mx-auto" /> : `R$ ${g.meta_vgv_assinado.toLocaleString("pt-BR")}`}
                      </td>
                      <td className="px-2 py-2 text-center">R$ {g.real_vgv_assinado.toLocaleString("pt-BR")}</td>
                      <td className="px-2 py-2 text-center"><span className={`font-bold ${pVgv >= 80 ? "text-success" : pVgv >= 50 ? "text-warning" : "text-destructive"}`}>{pVgv}%</span></td>
                      <td className="px-2 py-2 text-center">
                        {isEditing ? <Input type="number" value={editValues.vmarc} onChange={e => setEditValues(v => ({ ...v, vmarc: e.target.value }))} className="h-7 w-16 text-xs mx-auto" /> : g.meta_visitas_marcadas}
                      </td>
                      <td className="px-2 py-2 text-center">{g.real_visitas_marcadas}</td>
                      <td className="px-2 py-2 text-center"><span className={`font-bold ${pVmarc >= 80 ? "text-success" : pVmarc >= 50 ? "text-warning" : "text-destructive"}`}>{pVmarc}%</span></td>
                      <td className="px-2 py-2 text-center">
                        {isEditing ? <Input type="number" value={editValues.vreal} onChange={e => setEditValues(v => ({ ...v, vreal: e.target.value }))} className="h-7 w-16 text-xs mx-auto" /> : g.meta_visitas_realizadas}
                      </td>
                      <td className="px-2 py-2 text-center">{g.real_visitas_realizadas}</td>
                      <td className="px-2 py-2 text-center"><span className={`font-bold ${pVreal >= 80 ? "text-success" : pVreal >= 50 ? "text-warning" : "text-destructive"}`}>{pVreal}%</span></td>
                      <td className="px-2 py-2 text-center">
                        {isEditing ? (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => saveMeta(g.gerente_id)}>
                            <Check className="h-3.5 w-3.5 text-success" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(g)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
