import { Link } from "react-router-dom";
import { FileSignature, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";

export function ContratoIntermediacao({ leadId }: { leadId: string }) {
  const { isGestor } = useUserRole();
  if (!isGestor) return null;
  return <section className="space-y-3 border-t border-border pt-4">
    <h3 className="text-sm font-semibold">Intermediação</h3>
    <Button variant="outline" asChild className="w-full"><Link to={`/intermediacao?lead=${encodeURIComponent(leadId)}`} target="_blank" rel="noopener noreferrer"><FileSignature className="mr-2 size-4" />Gerar intermediação<ExternalLink className="ml-auto size-3.5" /></Link></Button>
  </section>;
}