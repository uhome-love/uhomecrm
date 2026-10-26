import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileSignature, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

const FORMA: Record<string, string> = { zemo: "ZemoBank", zemobank: "ZemoBank", nf: "Nota fiscal", nota_fiscal: "Nota fiscal", pix: "PIX" };

export function ContratoIntermediacao({ leadId }: { leadId: string }) {
  const { isGestor, isAdmin, isDiretor } = useUserRole();
  const gestao = isGestor || isAdmin || isDiretor;
  const q = useQuery({
    queryKey: ["contrato-intermediacao", leadId],
    enabled: gestao,
    queryFn: async () => {
      const { data, error } = await supabase.from("intermediacoes")
        .select("id, empreendimento, unidade, forma_pagamento, negocio_id, created_at")
        .eq("pipeline_lead_id", leadId).eq("status", "ativa")
        .order("created_at", { ascending: false }).limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  if (!gestao) return null;
  const inter = q.data;
  return <section className="space-y-3 border-t border-border pt-4">
    <h3 className="text-sm font-semibold">Intermediação</h3>
    {inter ? <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-1">
      <p className="flex items-center gap-2 font-medium text-foreground"><CheckCircle2 className="size-4 text-primary" />Intermediação pronta</p>
      <p className="text-muted-foreground">{[inter.empreendimento, inter.unidade, inter.forma_pagamento ? FORMA[inter.forma_pagamento] ?? inter.forma_pagamento : null].filter(Boolean).join(" · ")}</p>
      <p className="text-xs text-muted-foreground">Já vinculada a este cliente. Não precisa gerar outra para seguir para Contrato.</p>
    </div> : <Button variant="outline" asChild className="w-full"><Link to={`/intermediacao?lead=${encodeURIComponent(leadId)}`} target="_blank" rel="noopener noreferrer"><FileSignature className="mr-2 size-4" />Gerar intermediação<ExternalLink className="ml-auto size-3.5" /></Link></Button>}
    {!inter && !q.isPending && <p className="text-xs text-muted-foreground">Opcional nesta etapa. A intermediação só é obrigatória para confirmar a venda.</p>}
  </section>;
}
