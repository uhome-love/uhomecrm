// ─────────────────────────────────────────────────────────────────
// RegistroRapido — campo livre no topo do Histórico.
// Substitui os três jeitos de anotar (botão "Anotar", link "+ Anotação" e o
// botão grande "Registrar atividade"). O corretor digita, escolhe como foi o
// contato e clica em Registrar: abre o RegistrarAtividadeModal com o tipo e o
// texto já preenchidos, e o salvamento continua sendo do modal (nada muda na
// gravação).
// ─────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { MapPin, Send, MessageCircle, Phone, StickyNote, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Mesmos tipos do RegistrarAtividadeModal (ATIVIDADES). */
export type TipoRegistro = "ligacao" | "whatsapp" | "presencial" | "nota";

const TIPOS: { tipo: TipoRegistro; label: string; icon: LucideIcon }[] = [
  { tipo: "ligacao", label: "Ligação", icon: Phone },
  { tipo: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { tipo: "presencial", label: "Presencial", icon: MapPin },
  { tipo: "nota", label: "Nota", icon: StickyNote },
];

interface Props {
  leadPrimeiroNome?: string;
  onRegistrar: (dados: { tipo: TipoRegistro | null; texto: string }) => void;
  /** linha de ajuda embaixo do campo (opcional) */
  ajuda?: string;
}

export default function RegistroRapido({ leadPrimeiroNome, onRegistrar, ajuda }: Props) {
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<TipoRegistro | null>(null);
  const podeRegistrar = texto.trim().length > 0 || tipo !== null;
  // Botão vira só ícone quando a linha não comporta chips + "Registrar" (nunca desce sozinho).
  const linhaRef = useRef<HTMLDivElement>(null);
  const [compacto, setCompacto] = useState(false);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const campo = campoRef.current;
    if (!campo) return;
    campo.style.height = "auto";
    campo.style.height = `${Math.max(44, campo.scrollHeight)}px`;
  }, [texto]);
  useEffect(() => {
    const el = linhaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setCompacto(e.contentRect.width < 470));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const registrar = () => {
    if (!podeRegistrar) return;
    onRegistrar({ tipo, texto: texto.trim() });
    setTexto("");
    setTipo(null);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-2.5 rounded-xl border border-input bg-card px-3.5 pb-2.5 pt-3 transition-colors duration-short focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        <label htmlFor="registro-rapido" className="sr-only">Registrar o que aconteceu</label>
        <textarea
          id="registro-rapido"
          ref={campoRef}
          rows={2}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) registrar(); }}
          placeholder={`O que aconteceu com ${leadPrimeiroNome || "o cliente"}?`}
          className="min-h-[44px] w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[14px] leading-[22px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <div ref={linhaRef} className="flex items-end justify-between gap-2">
          <div role="group" aria-label="Como foi o contato" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scrollbar-none py-1 px-1">
            {TIPOS.map(({ tipo: t, label, icon: Icon }) => {
              const ativo = tipo === t;
              return (
                <Button variant="outline"
                  key={t}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setTipo(ativo ? null : t)}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold transition-colors",
                    ativo ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </Button>
              );
            })}
          </div>
          <Button variant="outline"
            type="button"
            onClick={registrar}
            disabled={!podeRegistrar}
            aria-label="Registrar"
            title="Registrar"
            className={cn("inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-input bg-card text-[13px] font-semibold text-foreground hover:bg-muted/50 disabled:opacity-50", compacto ? "w-8" : "px-3.5")}
          >
            {compacto ? <Send className="h-3.5 w-3.5" /> : "Registrar"}
          </Button>
        </div>
      </div>
      {ajuda && <p className="text-[12px] text-muted-foreground">{ajuda}</p>}
    </div>
  );
}
