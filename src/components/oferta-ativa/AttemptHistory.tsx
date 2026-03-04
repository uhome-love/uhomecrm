import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { History, Phone, MessageCircle, Mail } from "lucide-react";
import { format } from "date-fns";

interface Props {
  leadId: string;
}

const RESULTADO_LABELS: Record<string, { label: string; color: string }> = {
  com_interesse: { label: "Com interesse", color: "bg-emerald-500/10 text-emerald-600" },
  sem_interesse: { label: "Sem interesse", color: "bg-red-500/10 text-red-600" },
  numero_errado: { label: "Número errado", color: "bg-amber-500/10 text-amber-600" },
};

const CANAL_ICONS: Record<string, React.ReactNode> = {
  ligacao: <Phone className="h-3 w-3" />,
  whatsapp: <MessageCircle className="h-3 w-3" />,
  email: <Mail className="h-3 w-3" />,
};

export default function AttemptHistory({ leadId }: Props) {
  const { data: attempts = [] } = useQuery({
    queryKey: ["oa-lead-attempts", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oferta_ativa_tentativas")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });

  if (attempts.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
        <History className="h-3 w-3" /> Tentativas anteriores
      </p>
      <div className="space-y-1 max-h-28 overflow-y-auto">
        {attempts.map((a) => {
          const res = RESULTADO_LABELS[a.resultado] || { label: a.resultado, color: "bg-muted text-muted-foreground" };
          return (
            <div key={a.id} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-muted/50 border border-border">
              {CANAL_ICONS[a.canal] || null}
              <Badge variant="outline" className={`text-[9px] h-4 ${res.color}`}>{res.label}</Badge>
              <span className="text-muted-foreground flex-1 truncate">{a.feedback}</span>
              <span className="text-muted-foreground shrink-0">
                {format(new Date(a.created_at), "dd/MM HH:mm")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}