import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { History, Phone, MessageCircle, Mail, ChevronDown, User } from "lucide-react";
import { format } from "date-fns";

const RESULTADO_LABELS: Record<string, { label: string; color: string }> = {
  com_interesse: { label: "Aproveitado", color: "bg-emerald-500/10 text-emerald-600" },
  sem_interesse: { label: "Sem interesse", color: "bg-red-500/10 text-red-600" },
  numero_errado: { label: "Nº errado", color: "bg-amber-500/10 text-amber-600" },
  nao_atendeu: { label: "Não atendeu", color: "bg-muted text-muted-foreground" },
  retornar: { label: "Retornar", color: "bg-blue-500/10 text-blue-600" },
};

const CANAL_ICONS: Record<string, React.ReactNode> = {
  ligacao: <Phone className="h-3 w-3" />,
  whatsapp: <MessageCircle className="h-3 w-3" />,
  email: <Mail className="h-3 w-3" />,
};

export default function RecentCallsHistory() {
  const { user } = useAuth();

  const { data: recentCalls = [] } = useQuery({
    queryKey: ["recent-calls-history", user?.id],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("oferta_ativa_tentativas")
        .select("id, canal, resultado, feedback, created_at, lead_id, empreendimento")
        .eq("corretor_id", user!.id)
        .gte("created_at", today.toISOString())
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch lead names
      const leadIds = [...new Set(data.map((d) => d.lead_id))];
      const { data: leads } = await supabase
        .from("oferta_ativa_leads")
        .select("id, nome, telefone")
        .in("id", leadIds);

      const leadMap = new Map((leads || []).map((l) => [l.id, l]));

      return data.map((t) => ({
        ...t,
        lead_nome: leadMap.get(t.lead_id)?.nome || "Lead desconhecido",
        lead_telefone: leadMap.get(t.lead_id)?.telefone || null,
      }));
    },
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  if (recentCalls.length === 0) return null;

  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <History className="h-4 w-4 text-primary" /> ÚLTIMAS LIGAÇÕES ({recentCalls.length})
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {recentCalls.map((call) => {
            const res = RESULTADO_LABELS[call.resultado] || {
              label: call.resultado,
              color: "bg-muted text-muted-foreground",
            };
            return (
              <div
                key={call.id}
                className="flex items-center gap-2 text-[11px] p-2.5 rounded-lg bg-background border border-border/60 hover:border-border transition-colors"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted shrink-0">
                  {CANAL_ICONS[call.canal] || <Phone className="h-3 w-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground truncate">{call.lead_nome}</span>
                    <Badge variant="outline" className={`text-[9px] h-4 shrink-0 ${res.color}`}>
                      {res.label}
                    </Badge>
                  </div>
                  {call.feedback && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{call.feedback}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(call.created_at), "HH:mm")}
                  </span>
                  {call.empreendimento && (
                    <p className="text-[9px] text-muted-foreground/70 truncate max-w-[80px]">
                      {call.empreendimento}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
