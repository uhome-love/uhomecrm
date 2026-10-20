import { CheckCircle2, XCircle } from "lucide-react";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { StateWrapper } from "@/components/ui/StateWrapper";
import { MobileSection } from "./MobilePrimitives";

export default function MobileApprovals({ model: m }: { model: CeoDashboardController }) {
  if (!m.errors.roleta && m.localPendentes.length === 0) return null;
  return <MobileSection title="Aprovações Pendentes">
    <StateWrapper error={m.errors.roleta} onRetry={() => { m.reloadRoleta(); }} errorTitle="Falha ao carregar a fila de credenciamento" errorDescription="Pode haver credenciamentos pendentes não exibidos.">
      {m.localPendentes.length > 1 && <Button className="mb-3 h-11 w-full bg-success text-primary-foreground hover:bg-success/90" onClick={m.aprovarTodos}><CheckCircle2 />Aprovar todos ({m.localPendentes.length})</Button>}
      <div className="space-y-3">{m.localPendentes.map((c) => <article key={c.id} className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3"><Avatar className="h-9 w-9"><AvatarImage src={c.avatar ?? undefined} /><AvatarFallback>{c.corretor_nome.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><p className="break-words text-sm font-semibold text-foreground">{c.corretor_nome}</p><p className="mt-1 text-xs text-muted-foreground">{c.janela}</p><p className="mt-1 break-words text-xs text-muted-foreground">{c.empreendimentos_alocados.length > 0 ? c.empreendimentos_alocados.join(" · ") : "Sem alocação"}</p></div></div>
        <div className="mt-4 grid grid-cols-2 gap-3"><Button className="h-11 bg-success text-primary-foreground hover:bg-success/90" onClick={() => m.aprovar(c.id)}><CheckCircle2 />Aprovar</Button><Button variant="outline" className="h-11 text-danger" onClick={() => m.recusar(c.id)}><XCircle />Recusar</Button></div>
      </article>)}</div>
    </StateWrapper>
  </MobileSection>;
}