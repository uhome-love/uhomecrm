import { useMemo, useState } from "react";
import { useConferenciaVisitas, type VisitaConferencia } from "@/hooks/useConferenciaVisitas";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CalendarCheck, ArrowRight, ArrowLeft, XCircle, HelpCircle, ExternalLink } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";

const BUCKET_META: Record<VisitaConferencia["bucket"], { label: string; icon: any; className: string }> = {
  pos_visita:  { label: "Em Pós-Visita",      icon: CalendarCheck, className: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30" },
  avancou:     { label: "Avançou p/ Negócio", icon: ArrowRight,    className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  regrediu:    { label: "Regrediu",            icon: ArrowLeft,     className: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  caiu:        { label: "Caiu / Arquivado",   icon: XCircle,       className: "bg-red-500/10 text-red-700 border-red-500/30" },
  sem_lead:    { label: "Sem lead vinculado", icon: HelpCircle,    className: "bg-muted text-muted-foreground border-border" },
};

const ORDEM: VisitaConferencia["bucket"][] = ["pos_visita", "regrediu", "avancou", "caiu", "sem_lead"];

interface Props {
  mes: string;
  onOpenLead?: (leadId: string) => void;
}

export function ConferenciaVisitasMes({ mes, onOpenLead }: Props) {
  const { rows, loading, totais } = useConferenciaVisitas(mes);
  const [q, setQ] = useState("");
  const [bucketFilter, setBucketFilter] = useState<VisitaConferencia["bucket"] | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter(r => {
      if (bucketFilter && r.bucket !== bucketFilter) return false;
      if (!query) return true;
      return (
        r.nome_cliente?.toLowerCase().includes(query) ||
        r.empreendimento?.toLowerCase().includes(query) ||
        r.corretor_nome?.toLowerCase().includes(query)
      );
    });
  }, [rows, q, bucketFilter]);

  const grouped = useMemo(() => {
    const map = new Map<VisitaConferencia["bucket"], VisitaConferencia[]>();
    for (const b of ORDEM) map.set(b, []);
    for (const r of filtered) map.get(r.bucket)?.push(r);
    return map;
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando visitas do mês…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs de contagem por bucket (clicáveis para filtrar) */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <Card
          className={`cursor-pointer p-3 transition ${bucketFilter === null ? "border-primary shadow-sm" : "hover:border-primary/40"}`}
          onClick={() => setBucketFilter(null)}
        >
          <div className="text-xs text-muted-foreground">Total do mês</div>
          <div className="text-2xl font-semibold">{totais.total}</div>
        </Card>
        {ORDEM.map(b => {
          const meta = BUCKET_META[b];
          const Icon = meta.icon;
          const count = (totais as any)[b] as number;
          const active = bucketFilter === b;
          return (
            <Card
              key={b}
              className={`cursor-pointer p-3 transition ${active ? "border-primary shadow-sm" : "hover:border-primary/40"}`}
              onClick={() => setBucketFilter(active ? null : b)}
            >
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" /> {meta.label}
              </div>
              <div className="text-2xl font-semibold">{count}</div>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar por cliente, empreendimento ou corretor…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <div className="text-sm text-muted-foreground">
          Mostrando {filtered.length} de {rows.length}
        </div>
      </div>

      {ORDEM.filter(b => (grouped.get(b) || []).length > 0).map(b => {
        const meta = BUCKET_META[b];
        const Icon = meta.icon;
        const list = grouped.get(b)!;
        return (
          <Card key={b} className="overflow-hidden">
            <div className={`flex items-center justify-between border-b px-4 py-2.5 ${meta.className}`}>
              <div className="flex items-center gap-2 font-semibold">
                <Icon className="h-4 w-4" /> {meta.label}
              </div>
              <Badge variant="outline" className="bg-background">{list.length}</Badge>
            </div>
            <div className="divide-y">
              {list.map(v => (
                <div key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{v.nome_cliente}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatBRT(v.data_visita, "dd/MM")}{v.hora_visita ? ` · ${v.hora_visita.slice(0, 5)}` : ""}
                      {v.empreendimento ? ` · ${v.empreendimento}` : ""}
                      {" · "}{v.corretor_nome}
                    </div>
                  </div>
                  <div className="hidden shrink-0 md:block">
                    <Badge variant="outline" className="text-xs">
                      {v.lead_stage_nome || (v.pipeline_lead_id ? "—" : "Sem lead")}
                    </Badge>
                  </div>
                  {v.pipeline_lead_id && onOpenLead && (
                    <Button variant="ghost" size="sm" onClick={() => onOpenLead(v.pipeline_lead_id!)}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {filtered.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma visita encontrada com os filtros atuais.
        </Card>
      )}
    </div>
  );
}
