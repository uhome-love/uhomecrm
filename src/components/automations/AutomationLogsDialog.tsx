import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LogEntry {
  id: string;
  lead_id: string | null;
  triggered_at: string;
  actions_executed: any[];
  status: string;
  error_message: string | null;
}

interface Props {
  automationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AutomationLogsDialog({ automationId, open, onOpenChange }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("automation_logs")
      .select("*")
      .eq("automation_id", automationId)
      .order("triggered_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setLogs((data || []) as LogEntry[]);
        setLoading(false);
      });
  }, [automationId, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Histórico de Execuções
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhuma execução registrada ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                {log.status === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={log.status === "success" ? "secondary" : "destructive"} className="text-[10px]">
                      {log.status === "success" ? "Sucesso" : "Erro"}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(log.triggered_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  {log.lead_id && (
                    <p className="text-xs text-muted-foreground">Lead: {log.lead_id}</p>
                  )}
                  {log.error_message && (
                    <p className="text-xs text-destructive">{log.error_message}</p>
                  )}
                  {log.actions_executed?.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {log.actions_executed.map((a: any) => a.type || a).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
