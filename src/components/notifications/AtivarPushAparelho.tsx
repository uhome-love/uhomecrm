import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushSubscription } from "@/hooks/usePushSubscription";

/** Linha discreta no sino: ativa push neste aparelho ou explica como liberar. */
export default function AtivarPushAparelho() {
  const { isSupported, isCheckingSupport, isIOSNotPWA, isSubscribed, isLoading, permission, subscribe, sendTestPush } =
    usePushSubscription();

  if (isCheckingSupport) return null;

  if (isSubscribed) {
    return (
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-muted/40">
        <span className="text-xs text-muted-foreground">Notificações ativas neste aparelho</span>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={() => sendTestPush()}>
          Enviar teste
        </Button>
      </div>
    );
  }

  let texto: string;
  let podeAtivar = false;
  if (isIOSNotPWA) {
    texto = "No iPhone: Compartilhar → Adicionar à Tela de Início, e abra o CRM pelo ícone.";
  } else if (!isSupported) {
    texto = "Este navegador não recebe notificações. Use o Chrome.";
  } else if (permission === "denied") {
    texto = "Notificações bloqueadas. Toque no cadeado ao lado do endereço → Permissões → Notificações → Permitir.";
  } else {
    texto = "Receba avisos de leads e tarefas neste aparelho.";
    podeAtivar = true;
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border bg-primary/5">
      <BellRing className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-xs font-medium text-foreground">Ativar notificações neste aparelho</p>
        <p className="text-xs text-muted-foreground">{texto}</p>
        {podeAtivar && (
          <Button size="sm" className="h-8 text-xs" disabled={isLoading} onClick={() => subscribe()}>
            {isLoading ? "Ativando…" : "Ativar notificações"}
          </Button>
        )}
      </div>
    </div>
  );
}
