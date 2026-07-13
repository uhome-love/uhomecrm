import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, RefreshCw, RotateCcw, AlertTriangle, CheckCircle2, Layers } from "lucide-react";
import { toast } from "sonner";
import { formatBRT } from "@/lib/brtTime";

interface BaseRow {
  template_name: string;
  total: number;
  telefones: number;
  ultima: string | null;
  motivo_predominante: string | null;
}

interface LeadRow {
  id: string;
  phone: string;
  nome: string | null;
  error_text: string | null;
  created_at: string | null;
}

export default function FilaReenvioCard() {
  const qc = useQueryClient();
  const [retryingKey, setRetryingKey] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);

  // Gate global — reflete se o motor de disparo está liberado.
  const { data: gateEnabled = false } = useQuery({
    queryKey: ["reengajamento-dispatch-gate"],
    queryFn: async (): Promise<boolean> => {
      const { data } = await supabase
        .from("system_flags")
        .select("flag_value")
        .eq("flag_name", "campaign_dispatch_enabled")
        .maybeSingle();
      return !!data?.flag_value;
    },
    refetchInterval: 30000,
  });

  // Fila agrupada por base (template).
  const { data: bases = [], isFetching } = useQuery({
    queryKey: ["reengajamento-fila-bases"],
    queryFn: async (): Promise<BaseRow[]> => {
      const { data, error } = await supabase.rpc("get_reengajamento_fila_bases");
      if (error) throw error;
      return (data || []) as BaseRow[];
    },
    refetchInterval: 30000,
  });

  const isBlocked = !gateEnabled;
  const totalFalhas = bases.reduce((acc, b) => acc + Number(b.total || 0), 0);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["reengajamento-fila-bases"] });
    qc.invalidateQueries({ queryKey: ["reengajamento-fila-base-leads"] });
    qc.invalidateQueries({ queryKey: ["reengajamento-runs"] });
    qc.invalidateQueries({ queryKey: ["reengajamento-active-run"] });
    qc.invalidateQueries({ queryKey: ["auditoria-meta-today"] });
    qc.invalidateQueries({ queryKey: ["auditoria-webhook"] });
  };

  async function retry(body: Record<string, unknown>, label: string) {
    try {
      const { data, error } = await supabase.functions.invoke("reengajamento-retry-falhas", { body });
      if (error) throw error;
      const res = data as { reset?: number; blocked?: boolean; message?: string } | null;
      if (res?.blocked) {
        toast.warning(res.message || "Reenvio bloqueado pela proteção de qualidade.");
        invalidate();
        return;
      }
      const reset = res?.reset ?? 0;
      if (reset === 0) toast.info("Nenhuma falha reprocessável encontrada.");
      else toast.success(`🔁 ${label}: ${reset} lead(s) reenviado(s) para a fila.`);
      invalidate();
    } catch (e) {
      toast.error("Erro no reenvio: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleRetryBase(base: BaseRow) {
    setRetryingKey(base.template_name);
    await retry({ template_name: base.template_name }, `Base ${base.template_name}`);
    setRetryingKey(null);
  }

  async function handleRetryLead(lead: LeadRow) {
    setRetryingKey(lead.id);
    await retry({ meta_ids: [lead.id] }, "Reenvio");
    setRetryingKey(null);
  }

  async function handleRetryAll() {
    if (bases.length === 0) return;
    setRetryingAll(true);
    // Reenvia base a base para não estourar limites por chamada.
    for (const b of bases) {
      await retry({ template_name: b.template_name }, `Base ${b.template_name}`);
    }
    setRetryingAll(false);
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            Histórico de envios
            {totalFalhas > 0 && (
              <Badge variant="destructive" className="text-[10px]">{totalFalhas}</Badge>
            )}
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Falhas de entrega agrupadas por base (template). Expanda para ver os leads. Reenvie uma
            base inteira ou todas — o disparador reprocessa em modo manual, com o template original.
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => qc.invalidateQueries({ queryKey: ["reengajamento-fila-bases"] })}
            title="Atualizar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleRetryAll}
            disabled={retryingAll || bases.length === 0 || isBlocked}
          >
            {retryingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
            Tentar todas as bases
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isBlocked && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
            <div className="text-[11px] leading-relaxed">
              <p className="font-semibold text-destructive">Reenvio bloqueado — motor de disparo desligado</p>
              <p className="text-muted-foreground mt-0.5">
                O reenvio só é liberado quando o motor global de disparo está ligado (conta Meta
                saudável / pagamento regularizado). Ligue o disparo nas configurações para reenviar.
              </p>
            </div>
          </div>
        )}
        {bases.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <p className="text-xs text-muted-foreground">Nenhuma falha na fila — tudo entregue ou pendente.</p>
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {bases.map((b) => (
              <AccordionItem key={b.template_name} value={b.template_name} className="border rounded-lg px-3">
                <div className="flex items-center gap-2">
                  <AccordionTrigger className="flex-1 py-3 hover:no-underline">
                    <div className="flex items-center gap-2 text-left">
                      <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium flex items-center gap-2">
                          {b.template_name}
                          <Badge variant="destructive" className="text-[10px]">{b.total}</Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {b.telefones} telefone(s) · última {b.ultima ? formatBRT(b.ultima, "dd/MM HH:mm") : "—"}
                          {b.motivo_predominante ? ` · ${b.motivo_predominante}` : ""}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] shrink-0"
                    onClick={() => handleRetryBase(b)}
                    disabled={retryingKey === b.template_name || retryingAll || isBlocked}
                  >
                    {retryingKey === b.template_name ? <Loader2 className="h-3 w-3 animate-spin" /> : "🔁 Tentar base"}
                  </Button>
                </div>
                <AccordionContent className="pb-3">
                  <BaseLeads
                    templateName={b.template_name}
                    onRetryLead={handleRetryLead}
                    retryingKey={retryingKey}
                    retryingAll={retryingAll}
                    isBlocked={isBlocked}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

function BaseLeads({
  templateName,
  onRetryLead,
  retryingKey,
  retryingAll,
  isBlocked,
}: {
  templateName: string;
  onRetryLead: (lead: LeadRow) => void;
  retryingKey: string | null;
  retryingAll: boolean;
  isBlocked: boolean;
}) {
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["reengajamento-fila-base-leads", templateName],
    queryFn: async (): Promise<LeadRow[]> => {
      const { data, error } = await supabase
        .from("reengajamento_meta_disparos")
        .select("id, lead_id, phone, error_text, created_at")
        .eq("status", "failed")
        .eq("template_name", templateName)
        .not("run_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = data || [];
      const leadIds = Array.from(new Set(rows.map((r) => r.lead_id).filter(Boolean))) as string[];
      const nameMap: Record<string, string> = {};
      if (leadIds.length > 0) {
        const { data: pl } = await supabase.from("pipeline_leads").select("id, nome").in("id", leadIds);
        for (const l of pl || []) nameMap[l.id] = l.nome || "";
      }
      return rows.map((r) => ({
        id: r.id,
        phone: r.phone || "—",
        nome: (r.lead_id && nameMap[r.lead_id]) || null,
        error_text: r.error_text,
        created_at: r.created_at,
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (leads.length === 0) {
    return <p className="text-[11px] text-muted-foreground py-2">Sem leads para exibir.</p>;
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-muted-foreground">Mostrando até 100 leads mais recentes desta base.</p>
      {leads.map((l) => (
        <div key={l.id} className="flex items-center justify-between gap-2 border-b py-1.5 last:border-b-0">
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">{l.nome || "—"} · <span className="text-muted-foreground">{l.phone}</span></div>
            <p className="text-[10px] text-muted-foreground flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-600" />
              {l.error_text || "Motivo não informado"}
              {l.created_at ? ` · ${formatBRT(l.created_at, "dd/MM HH:mm")}` : ""}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] shrink-0"
            onClick={() => onRetryLead(l)}
            disabled={retryingKey === l.id || retryingAll || isBlocked}
          >
            {retryingKey === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "🔁 Tentar"}
          </Button>
        </div>
      ))}
    </div>
  );
}
