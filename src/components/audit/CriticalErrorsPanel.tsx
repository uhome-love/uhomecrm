import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/customClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { format, subHours } from "date-fns";
import type { Json } from "@/integrations/supabase/types";
import { formatBRT } from "@/lib/brtTime";

interface ErrorLog {
  id: string;
  automation_id: string;
  lead_id: string | null;
  actions_executed: Json;
  status: string;
  error_message: string | null;
  triggered_at: string;
}

export function CriticalErrorsPanel() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadErrors = async () => {
    setLoading(true);
    const since = subHours(new Date(), 48).toISOString();

    const { data } = await supabase
      .from("automation_logs")
      .select("id, automation_id, lead_id, actions_executed, status, error_message, triggered_at")
      .eq("status", "error")
      .gte("triggered_at", since)
      .order("triggered_at", { ascending: false })
      .limit(50);

    setErrors((data as ErrorLog[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadErrors(); }, []);

  return (
    <Card className={errors.length > 0 ? "border-destructive/40" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Erros Recentes
            {errors.length > 0 && (
              <Badge variant="destructive" className="text-[10px] ml-1">{errors.length}</Badge>
            )}
          </CardTitle>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={loadErrors} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Falhas de automação e sequências nas últimas 48h</p>
      </CardHeader>
      <CardContent>
        {errors.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              {loading ? "Verificando..." : "✅ Nenhum erro encontrado nas últimas 48h"}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[350px] overflow-auto">
            {errors.map((err) => (
              <div key={err.id} className="border rounded-lg p-3 bg-destructive/5">
                <div
                  className="flex items-start gap-2 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === err.id ? null : err.id)}
                >
                  {expandedId === err.id
                    ? <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="destructive" className="text-[10px]">ERROR</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatBRT(err.triggered_at, "dd/MM HH:mm:ss")}
                      </span>
                    </div>
                    <p className="text-xs mt-1 truncate">
                      {err.error_message || "Erro sem mensagem"}
                    </p>
                  </div>
                </div>

                {expandedId === err.id && (
                  <div className="mt-3 pt-3 border-t space-y-2 text-xs">
                    <dl className="space-y-1">
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground shrink-0">Automação:</dt>
                        <dd className="font-mono text-[10px] truncate">{err.automation_id}</dd>
                      </div>
                      {err.lead_id && (
                        <div className="flex gap-2">
                          <dt className="text-muted-foreground shrink-0">Lead:</dt>
                          <dd className="font-mono text-[10px] truncate">{err.lead_id}</dd>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground shrink-0">Ações tentadas:</dt>
                        <dd className="font-mono text-[10px]">
                          {JSON.stringify(err.actions_executed)}
                        </dd>
                      </div>
                    </dl>
                    {err.error_message && (
                      <div>
                        <p className="text-muted-foreground mb-1">Mensagem completa:</p>
                        <pre className="bg-background rounded p-2 text-[10px] font-mono whitespace-pre-wrap">
                          {err.error_message}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
