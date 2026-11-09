/** Cartão do cliente: nome, telefone grande, empreendimento, contexto e botões Ligar/WhatsApp. */
import { useState } from "react";
import { Phone, MessageCircle, Copy, Building2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { contatoPermitido } from "@/lib/contatoPermitido";
import { formatBRT } from "@/lib/brtTime";
import { ORIGEM_INFO, foneInternacional, formatarFone, haQuanto, primeiroNome, type ClienteOA, type OrigemOA } from "./tipos";

interface Props { cliente: ClienteOA; origem: OrigemOA; onLigou: () => void }

export default function ClientePainel({ cliente, origem, onLigou }: Props) {
  const fone = foneInternacional(cliente.telefone);
  const [verificando, setVerificando] = useState(false);
  const quando = haQuanto(cliente.entrouEm);

  const contatar = async (canal: "ligacao" | "whatsapp") => {
    if (!fone || verificando) return;
    setVerificando(true);
    const ok = await contatoPermitido(cliente.telefone);
    setVerificando(false);
    if (!ok) return;
    if (canal === "ligacao") { onLigou(); window.location.href = `tel:+${fone}`; return; }
    const msg = `Oi ${primeiroNome(cliente.nome)}, tudo bem? Aqui é da Uhome${cliente.empreendimento ? `, sobre o ${cliente.empreendimento}` : ""}. Podemos conversar rapidinho?`;
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  const copiar = () => { if (cliente.telefone) { void navigator.clipboard.writeText(cliente.telefone); toast.success("Telefone copiado"); } };

  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-label="Cliente">
      <p className="text-xs font-medium text-muted-foreground">
        {ORIGEM_INFO[origem].titulo}{quando ? ` · entrou ${quando}` : ""}{cliente.origemLead ? ` · ${cliente.origemLead}` : ""}
      </p>
      <h2 className="mt-1 break-words text-2xl font-bold leading-tight">{cliente.nome || "Cliente sem nome"}</h2>

      <button type="button" onClick={copiar} className="group mt-2 flex w-fit items-center gap-2 text-xl font-semibold tabular-nums tracking-wide" title="Copiar telefone">
        {formatarFone(cliente.telefone)} <Copy className="h-4 w-4 text-muted-foreground opacity-60 group-hover:opacity-100" aria-hidden />
      </button>

      {cliente.empreendimento && (
        <span className="mt-3 flex w-fit max-w-full items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary">
          <Building2 className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">{cliente.empreendimento}</span>
        </span>
      )}
      <p className="mt-3 text-sm text-muted-foreground">{ORIGEM_INFO[origem].contexto}</p>

      <div className="mt-4 grid gap-2">
        <Button size="lg" onClick={() => void contatar("ligacao")} disabled={!fone || verificando}
          className="h-14 gap-2 bg-success text-lg font-bold text-primary-foreground shadow-sm hover:bg-success-600">
          <Phone className="h-5 w-5" aria-hidden /> Ligar agora
        </Button>
        <Button variant="secondary" onClick={() => void contatar("whatsapp")} disabled={!fone || verificando} className="h-11 gap-2">
          <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
        </Button>
        {!fone && <p className="text-center text-xs text-destructive">Telefone inválido. Use "Número errado" ou pule.</p>}
      </div>

      {(cliente.observacoes || cliente.entrouEm || cliente.tentativas > 0) && (
        <Collapsible className="mt-4 border-t border-border pt-3">
          <CollapsibleTrigger className="group flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground">
            Mais detalhes <ChevronDown className="h-4 w-4 transition-transform duration-fast group-data-[state=open]:rotate-180" aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-1 text-sm">
            {cliente.entrouEm && <p><span className="text-muted-foreground">Entrou em:</span> {formatBRT(cliente.entrouEm, "dd/MM/yyyy")}</p>}
            {cliente.tentativas > 0 && <p><span className="text-muted-foreground">Tentativas anteriores:</span> {cliente.tentativas}</p>}
            {cliente.observacoes && <p className="whitespace-pre-line text-muted-foreground">{cliente.observacoes}</p>}
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}
