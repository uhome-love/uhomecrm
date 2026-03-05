import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Target, TrendingUp, Pencil, Check, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface MetaProgress {
  metaVgv: number;
  realVgv: number;
  metaVisitasMarcadas: number;
  realVisitasMarcadas: number;
  metaVisitasRealizadas: number;
  realVisitasRealizadas: number;
}

export default function MetasMensaisProgress() {
  const { user } = useAuth();
  const [data, setData] = useState<MetaProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState({ vgv: "", visitasM: "", visitasR: "" });
  const [metaId, setMetaId] = useState<string | null>(null);
  const mesAtual = format(new Date(), "yyyy-MM");
  const mesLabel = format(new Date(), "MMMM/yyyy", { locale: ptBR });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: meta } = await supabase
      .from("ceo_metas_mensais")
      .select("id, meta_vgv_assinado, meta_visitas_marcadas, meta_visitas_realizadas")
      .eq("gerente_id", user.id)
      .eq("mes", mesAtual)
      .maybeSingle();

    if (!meta) {
      setData(null);
      setMetaId(null);
      setLoading(false);
      return;
    }

    setMetaId(meta.id);

    const startDate = `${mesAtual}-01`;
    const endDate = `${mesAtual}-31`;
    const { data: cps } = await supabase
      .from("checkpoints")
      .select("id")
      .eq("gerente_id", user.id)
      .gte("data", startDate)
      .lte("data", endDate);

    const cpIds = (cps || []).map((c) => c.id);
    let realVgv = 0;
    let realVisitasMarcadas = 0;
    let realVisitasRealizadas = 0;

    if (cpIds.length > 0) {
      const { data: lines } = await supabase
        .from("checkpoint_lines")
        .select("real_visitas_marcadas, real_visitas_realizadas")
        .in("checkpoint_id", cpIds);

      (lines || []).forEach((l) => {
        realVisitasMarcadas += Number(l.real_visitas_marcadas || 0);
        realVisitasRealizadas += Number(l.real_visitas_realizadas || 0);
      });
    }

    const { data: pdns } = await supabase
      .from("pdn_entries")
      .select("vgv, situacao")
      .eq("gerente_id", user.id)
      .eq("mes", mesAtual)
      .eq("situacao", "assinado");

    realVgv = (pdns || []).reduce((sum, p) => sum + Number(p.vgv || 0), 0);

    const metaData = {
      metaVgv: Number(meta.meta_vgv_assinado),
      realVgv,
      metaVisitasMarcadas: meta.meta_visitas_marcadas,
      realVisitasMarcadas,
      metaVisitasRealizadas: meta.meta_visitas_realizadas,
      realVisitasRealizadas,
    };
    setData(metaData);
    setEditValues({
      vgv: String(metaData.metaVgv),
      visitasM: String(metaData.metaVisitasMarcadas),
      visitasR: String(metaData.metaVisitasRealizadas),
    });
    setLoading(false);
  }, [user, mesAtual]);

  useEffect(() => { load(); }, [load]);

  const startEdit = () => {
    if (data) {
      setEditValues({
        vgv: String(data.metaVgv),
        visitasM: String(data.metaVisitasMarcadas),
        visitasR: String(data.metaVisitasRealizadas),
      });
    }
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); };

  const saveMetas = async () => {
    if (!user) return;
    setSaving(true);

    const payload = {
      gerente_id: user.id,
      mes: mesAtual,
      meta_vgv_assinado: Number(editValues.vgv) || 0,
      meta_visitas_marcadas: Number(editValues.visitasM) || 0,
      meta_visitas_realizadas: Number(editValues.visitasR) || 0,
    };

    let error;
    if (metaId) {
      ({ error } = await supabase.from("ceo_metas_mensais").update(payload).eq("id", metaId));
    } else {
      ({ error } = await supabase.from("ceo_metas_mensais").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar metas: " + error.message);
      return;
    }
    toast.success("Metas do mês atualizadas!");
    setEditing(false);
    load();
  };

  const formatCurrency = (v: number) =>
    v >= 1_000_000
      ? `R$ ${(v / 1_000_000).toFixed(1)}M`
      : `R$ ${(v / 1_000).toFixed(0)}k`;

  // No meta yet — show creation form
  if (!loading && !data) {
    return (
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold text-foreground">
            Metas do Mês — <span className="capitalize text-primary">{mesLabel}</span>
          </h3>
        </div>
        {!editing ? (
          <div className="text-center py-3 space-y-2">
            <p className="text-sm text-muted-foreground">Nenhuma meta definida para este mês.</p>
            <Button size="sm" variant="outline" onClick={startEdit} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Definir metas
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">VGV Assinado (R$)</label>
              <Input type="number" className="h-8 text-xs mt-1" value={editValues.vgv} onChange={(e) => setEditValues(p => ({ ...p, vgv: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Visitas Marcadas</label>
              <Input type="number" className="h-8 text-xs mt-1" value={editValues.visitasM} onChange={(e) => setEditValues(p => ({ ...p, visitasM: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Visitas Realizadas</label>
              <Input type="number" className="h-8 text-xs mt-1" value={editValues.visitasR} onChange={(e) => setEditValues(p => ({ ...p, visitasR: e.target.value }))} />
            </div>
            <div className="col-span-3 flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={cancelEdit} className="gap-1 text-xs"><X className="h-3.5 w-3.5" /> Cancelar</Button>
              <Button size="sm" onClick={saveMetas} disabled={saving} className="gap-1 text-xs"><Check className="h-3.5 w-3.5" /> {saving ? "Salvando..." : "Salvar metas"}</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading || !data) return null;

  const items = [
    { label: "VGV Assinado", real: data.realVgv, meta: data.metaVgv, format: formatCurrency, editKey: "vgv" as const },
    { label: "Visitas Marcadas", real: data.realVisitasMarcadas, meta: data.metaVisitasMarcadas, format: (v: number) => String(v), editKey: "visitasM" as const },
    { label: "Visitas Realizadas", real: data.realVisitasRealizadas, meta: data.metaVisitasRealizadas, format: (v: number) => String(v), editKey: "visitasR" as const },
  ];

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold text-foreground">
            Metas do Mês — <span className="capitalize text-primary">{mesLabel}</span>
          </h3>
        </div>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={startEdit} className="gap-1 text-xs h-7">
            <Pencil className="h-3 w-3" /> Editar
          </Button>
        )}
      </div>

      {editing ? (
        <div className="grid grid-cols-3 gap-3">
          {items.map((item) => (
            <div key={item.editKey}>
              <label className="text-[10px] text-muted-foreground uppercase">{item.label}</label>
              <Input
                type="number"
                className="h-8 text-xs mt-1"
                value={editValues[item.editKey]}
                onChange={(e) => setEditValues(p => ({ ...p, [item.editKey]: e.target.value }))}
              />
            </div>
          ))}
          <div className="col-span-3 flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={cancelEdit} className="gap-1 text-xs"><X className="h-3.5 w-3.5" /> Cancelar</Button>
            <Button size="sm" onClick={saveMetas} disabled={saving} className="gap-1 text-xs"><Check className="h-3.5 w-3.5" /> {saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {items.map((item) => {
            const pct = item.meta > 0 ? Math.min(Math.round((item.real / item.meta) * 100), 100) : 0;
            const pctRaw = item.meta > 0 ? Math.round((item.real / item.meta) * 100) : 0;
            const colorClass = pctRaw >= 80 ? "text-success" : pctRaw >= 50 ? "text-warning" : "text-destructive";

            return (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <div className="flex items-center gap-1">
                    <TrendingUp className={`h-3 w-3 ${colorClass}`} />
                    <span className={`text-sm font-bold ${colorClass}`}>{pctRaw}%</span>
                  </div>
                </div>
                <Progress value={pct} className="h-2.5" />
                <p className="text-[10px] text-muted-foreground text-right">
                  {item.format(item.real)} / {item.format(item.meta)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
