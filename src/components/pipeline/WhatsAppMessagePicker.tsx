import { useState } from "react";
import { Copy, ExternalLink, Pencil, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { WhatsAppMensagem } from "@/lib/whatsappMensagens";

interface Props {
  messages: WhatsAppMensagem[];
  hasPhone: boolean;
  busy: boolean;
  onCopy: (text: string) => void;
  onOpen: (text: string) => void;
}

function MessageActions({ text, hasPhone, busy, onCopy, onOpen }: Omit<Props, "messages"> & { text: string }) {
  const value = text.trim();
  return (
    <div className="grid grid-cols-2 gap-2 pt-2">
      <Button variant="outline" size="sm" disabled={busy || !value} onClick={() => onCopy(value)}>
        <Copy /> Copiar
      </Button>
      <Button variant="success" size="sm" className="px-2 text-xs sm:text-sm" disabled={busy || !hasPhone || !value} onClick={() => onOpen(value)}>
        <ExternalLink /> Abrir WhatsApp
      </Button>
    </div>
  );
}

export function WhatsAppMessagePicker({ messages, hasPhone, busy, onCopy, onOpen }: Props) {
  const [freeMode, setFreeMode] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const isFree = freeMode || messages.length === 0;
  const actions = { hasPhone, busy, onCopy, onOpen };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <p className="text-xs font-medium text-muted-foreground">{isFree ? "Mensagem livre" : "Escolha ou edite a mensagem"}</p>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-primary" disabled={busy}
            onClick={() => { setFreeMode(!freeMode); setEditing(null); }}>
            {isFree ? <MessageSquarePlus /> : <Pencil />}{isFree ? "Mensagens prontas" : "Mensagem livre"}
          </Button>
        )}
      </div>
      {isFree ? (
        <div>
          <Textarea aria-label="Mensagem livre" className="min-h-32 text-base sm:text-sm" placeholder="Escreva sua mensagem…"
            value={freeText} onChange={e => setFreeText(e.target.value)} autoFocus />
          <MessageActions {...actions} text={freeText} />
        </div>
      ) : messages.map(msg => {
        const active = editing === msg.id;
        const body = drafts[msg.id] ?? msg.body;
        return (
          <section key={msg.id} aria-label={msg.title} className={cn("rounded-lg border p-3", active ? "border-primary bg-primary/5" : "border-border bg-muted/30")}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-foreground sm:text-sm">{msg.title}</h3>
              <Button variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-xs text-muted-foreground" disabled={busy}
                onClick={() => {
                  if (active) {
                    setEditing(null);
                    setDrafts(current => { const next = { ...current }; delete next[msg.id]; return next; });
                  } else {
                    setEditing(msg.id);
                    setDrafts(current => ({ ...current, [msg.id]: body }));
                  }
                }}>
                <Pencil />{active ? "Cancelar" : "Editar"}
              </Button>
            </div>
            {active ? (
              <Textarea aria-label={`Editar ${msg.title}`} className="min-h-28 text-base sm:text-sm" value={body}
                onChange={e => setDrafts(current => ({ ...current, [msg.id]: e.target.value }))} autoFocus />
            ) : <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground sm:text-sm">{body}</p>}
            <MessageActions {...actions} text={body} />
          </section>
        );
      })}
    </div>
  );
}