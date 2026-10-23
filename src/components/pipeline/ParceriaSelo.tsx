import { Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { textoParceria, useParceriasAtivas } from "@/hooks/useParceriasAtivas";

/** Selo de parceria ativa do cliente. Não renderiza nada sem parceria. */
export function ParceriaSelo({ leadId, className }: { leadId: string | null | undefined; className?: string }) {
  const { data } = useParceriasAtivas();
  const texto = leadId ? textoParceria(data?.get(leadId)) : null;
  if (!texto) return null;
  return (
    <span title={`${texto} · visita conta 0,5 para cada um na Roleta`} className={cn("inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-semibold text-primary", className)}>
      <Handshake className="h-3 w-3" />{texto}
    </span>
  );
}
