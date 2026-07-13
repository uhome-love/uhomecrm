import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatBRT } from "@/lib/brtTime";

interface FailRow {
  phone: string;
  nome: string | null;
  template_name: string | null;
  error_text: string | null;
  created_at: string | null;
  metaIds: string[];
  count: number;
}

export default function FilaReenvioCard() {
  const qc = useQueryClient();
  const [retryingKey, setRetryingKey] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);

  const { data: falhas = [], isFetching } = useQuery({
    queryKey: ["reengajamento-fila-reenvio"],
    queryFn: async (): Promise<FailRow[]> => {
      const { data, error } = await supabase
        .from("reengajamento_meta_disparos")
        .select("id, lead_id, phone, template_name, error_text, created_at")
        .eq("status", "failed")
        .not("run_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const rows = data || [];

      // Nomes dos leads
      const leadIds = Array.from(new Set(rows.map((r) => r.lead_id).filter(Boolean))) as string[];
      const nameMap: Record<string, string> = {};
      if (leadIds.length > 0) {
        const { data: leads } = await supabase
          .from("pipeline_leads")
          .select("id, nome")
          .in("id", leadIds);
        for (const l of leads || []) nameMap[l.id] = l.nome || "";
      }

      // Agrupa por telefone (mantém o mais recente, junta os ids para reenvio)
      const grouped = new Map<string, FailRow>();
      for (const r of rows) {
        const key = r.phone || r.id;
        const existing = grouped.get(key);
        if (existing) {
          existing.metaIds.push(r.id);
          existing.count += 1;
        } else {
          grouped.set(key, {
            phone: r.phone || "—",
            nome: (r.lead_id && nameMap[r.lead_id]) || null,
            template_name: r.template_name,
            error_text: r.error_text,
            created_at: r.created_at,
            metaIds: [r.id],
            count: 1,
          });
        }
      }
      return Array.from(grouped.values());
    },
    refetchInterval: 20000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["reengajamento-fila-reenvio"] });
    qc.invalidateQueries({ queryKey: ["reengajamento-runs"] });
    qc.invalidateQueries({ queryKey: ["reengajamento-active-run"] });
    qc.invalidateQueries({ queryKey: ["auditoria-meta-today"] });
    qc.invalidateQueries({ queryKey: ["auditoria-webhook"] });
  };

  async function retry(metaIds: string[], label: string) {
    try {
      const { data, error } = await supabase.functions.invoke("reengajamento-retry-falhas", {
        body: { meta_ids: metaIds },
      });
      if (error) throw error;
      const reset = (data as { reset?: number } | null)?.reset ?? 0;
      if (reset === 0) toast.info("Nenhuma falha reprocessável encontrada.");
      else toast.success(`🔁 ${label}: ${reset} lead(s) reenviado(s) para a fila.`);
      invalidate();
    } catch (e) {
      toast.error("Erro no reenvio: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleRetryOne(row: FailRow) {
    setRetryingKey(row.phone);
    await retry(row.metaIds, "Reenvio");
    setRetryingKey(null);
  }

  async function handleRetryAll() {
    if (falhas.length === 0) return;
    setRetryingAll(true);
    await retry(falhas.flatMap((f) => f.metaIds), "Reenvio em lote");
    setRetryingAll(false);
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            Fila de reenvio
            {falhas.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">{falhas.length}</Badge>
            )}
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Leads cujo disparo falhou na entrega. Reenvie individualmente ou todos de uma vez — o
            disparador reprocessa em modo manual, com o template original.
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => qc.invalidateQueries({ queryKey: ["reengajamento-fila-reenvio"] })}
            title="Atualizar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleRetryAll}
            disabled={retryingAll || falhas.length === 0}
          >
            {retryingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
            Tentar todos
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {falhas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <p className="text-xs text-muted-foreground">Nenhuma falha na fila — tudo entregue ou pendente.</p>
          </div>
        ) : (
          <>
            {/* Desktop: tabela */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Lead</th>
                    <th className="text-left py-2 px-2 font-medium">Telefone</th>
                    <th className="text-center py-2 px-2 font-medium">Status</th>
                    <th className="text-left py-2 px-2 font-medium">Template</th>
                    <th className="text-left py-2 px-2 font-medium">Motivo da falha</th>
                    <th className="text-left py-2 px-2 font-medium">Quando</th>
                    <th className="text-center py-2 px-2 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {falhas.map((f) => (
                    <tr key={f.phone} className="border-b hover:bg-muted/30 align-top">
                      <td className="py-2 px-2 font-medium">
                        {f.nome || "—"}
                        {f.count > 1 && <Badge variant="outline" className="text-[9px] ml-1">{f.count}x</Badge>}
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">{f.phone}</td>
                      <td className="py-2 px-2 text-center">
                        <Badge className="bg-red-100 text-red-800 text-[10px]">❌ Falha</Badge>
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">{f.template_name || "—"}</td>
                      <td className="py-2 px-2 max-w-[300px]">
                        <span className="text-[11px] text-muted-foreground line-clamp-2 flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-600" />
                          {f.error_text || "Motivo não informado"}
                        </span>
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">{f.created_at ? formatBRT(f.created_at, "dd/MM HH:mm") : "—"}</td>
                      <td className="py-2 px-2 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px]"
                          onClick={() => handleRetryOne(f)}
                          disabled={retryingKey === f.phone || retryingAll}
                        >
                          {retryingKey === f.phone ? <Loader2 className="h-3 w-3 animate-spin" /> : "🔁 Tentar"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards */}
            <div className="md:hidden space-y-2">
              {falhas.map((f) => (
                <div key={f.phone} className="border rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{f.nome || "—"}</span>
                    <Badge className="bg-red-100 text-red-800 text-[10px] shrink-0">❌ Falha</Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {f.phone}{f.template_name ? ` · ${f.template_name}` : ""}{f.count > 1 ? ` · ${f.count}x` : ""}
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-600" />
                    {f.error_text || "Motivo não informado"}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-muted-foreground">{f.created_at ? formatBRT(f.created_at, "dd/MM HH:mm") : "—"}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      onClick={() => handleRetryOne(f)}
                      disabled={retryingKey === f.phone || retryingAll}
                    >
                      {retryingKey === f.phone ? <Loader2 className="h-3 w-3 animate-spin" /> : "🔁 Tentar novamente"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
