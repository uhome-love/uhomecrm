import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Target, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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
  const mesAtual = format(new Date(), "yyyy-MM");
  const mesLabel = format(new Date(), "MMMM/yyyy", { locale: ptBR });

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      // Fetch CEO meta for this manager
      const { data: meta } = await supabase
        .from("ceo_metas_mensais")
        .select("meta_vgv_assinado, meta_visitas_marcadas, meta_visitas_realizadas")
        .eq("gerente_id", user.id)
        .eq("mes", mesAtual)
        .maybeSingle();

      if (!meta) {
        setData(null);
        setLoading(false);
        return;
      }

      // Fetch all checkpoints for this month
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

      // VGV Assinado comes from PDN (source of truth)
      const { data: pdns } = await supabase
        .from("pdn_entries")
        .select("vgv, situacao")
        .eq("gerente_id", user.id)
        .eq("mes", mesAtual)
        .eq("situacao", "assinado");

      realVgv = (pdns || []).reduce((sum, p) => sum + Number(p.vgv || 0), 0);

      setData({
        metaVgv: Number(meta.meta_vgv_assinado),
        realVgv,
        metaVisitasMarcadas: meta.meta_visitas_marcadas,
        realVisitasMarcadas,
        metaVisitasRealizadas: meta.meta_visitas_realizadas,
        realVisitasRealizadas,
      });
      setLoading(false);
    };

    load();
  }, [user, mesAtual]);

  if (loading || !data) return null;

  const items = [
    {
      label: "VGV Assinado",
      real: data.realVgv,
      meta: data.metaVgv,
      format: (v: number) =>
        v >= 1_000_000
          ? `R$ ${(v / 1_000_000).toFixed(1)}M`
          : `R$ ${(v / 1_000).toFixed(0)}k`,
    },
    {
      label: "Visitas Marcadas",
      real: data.realVisitasMarcadas,
      meta: data.metaVisitasMarcadas,
      format: (v: number) => String(v),
    },
    {
      label: "Visitas Realizadas",
      real: data.realVisitasRealizadas,
      meta: data.metaVisitasRealizadas,
      format: (v: number) => String(v),
    },
  ];

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold text-foreground">
          Metas do Mês — <span className="capitalize text-primary">{mesLabel}</span>
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((item) => {
          const pct = item.meta > 0 ? Math.min(Math.round((item.real / item.meta) * 100), 100) : 0;
          const pctRaw = item.meta > 0 ? Math.round((item.real / item.meta) * 100) : 0;
          const colorClass =
            pctRaw >= 80
              ? "text-success"
              : pctRaw >= 50
              ? "text-warning"
              : "text-destructive";

          return (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <div className="flex items-center gap-1">
                  <TrendingUp className={`h-3 w-3 ${colorClass}`} />
                  <span className={`text-sm font-bold ${colorClass}`}>{pctRaw}%</span>
                </div>
              </div>
              <Progress
                value={pct}
                className="h-2.5"
              />
              <p className="text-[10px] text-muted-foreground text-right">
                {item.format(item.real)} / {item.format(item.meta)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
