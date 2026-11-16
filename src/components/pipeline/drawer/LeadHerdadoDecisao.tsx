import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  leadId: string;
  herdadoDeNome: string;
  onManter: () => void;
  onDescartar: () => void;
}

/** Caixa de decisão para lead herdado de corretor inativado. */
export default function LeadHerdadoDecisao({ leadId, herdadoDeNome, onManter, onDescartar }: Props) {
  const [salvando, setSalvando] = useState(false);

  const manter = async () => {
    setSalvando(true);
    const { error } = await supabase.rpc("decidir_lead_herdado_manter", { p_lead_id: leadId });
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível salvar a decisão. Tente de novo.");
      return;
    }
    toast.success("Lead mantido com você.");
    onManter();
  };

  return (
    <section className="rounded-xl border border-warning/40 bg-warning/10 p-4">
      <p className="text-sm font-semibold text-foreground">Lead herdado de {herdadoDeNome}</p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">
        Este corretor saiu da empresa. Decida o que fazer com este cliente. Para passar a outro corretor, use "Repassar lead" no menu ··· do cartão.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={manter} disabled={salvando}>Manter comigo</Button>
        <Button size="sm" variant="outline" onClick={onDescartar} disabled={salvando}>Descartar</Button>
      </div>
    </section>
  );
}
