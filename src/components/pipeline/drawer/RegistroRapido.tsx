// ─────────────────────────────────────────────────────────────────
// RegistroRapido — campo livre no topo do Histórico.
// Substitui os três jeitos de anotar (botão "Anotar", link "+ Anotação" e o
// botão grande "Registrar atividade"). O corretor digita, escolhe como foi o
// contato e clica em Registrar: abre o RegistrarAtividadeModal com o tipo e o
// texto já preenchidos, e o salvamento continua sendo do modal (nada muda na
// gravação).
// ─────────────────────────────────────────────────────────────────
import { useState } from "react";
import { MapPin, MessageCircle, Phone, StickyNote, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const registrar = () => {
    if (!podeRegistrar) return;
    onRegistrar({ tipo, texto: texto.trim() });
    setTexto("");
    setTipo(null);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-2.5 rounded-xl border border-input bg-card px-3.5 pb-2.5 pt-3 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/30">
        <label htmlFor="registro-rapido" className="sr-only">Registrar o que aconteceu</label>
        <textarea
          id="registro-rapido"
          rows={2}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) registrar(); }}
          placeholder={`Registre o que aconteceu com ${leadPrimeiroNome || "o cliente"} e o próximo passo…`}
          className="min-h-[44px] w-full resize-none border-0 bg-transparent p-0 text-[14px] leading-[22px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <div ref={linhaRef} className="flex items-end justify-between gap-2">
          <div role="group" aria-label="Como foi o contato" className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {TIPOS.map(({ tipo: t, label, icon: Icon }) => {
              const ativo = tipo === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setTipo(ativo ? null : t)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold transition-colors",
                    ativo ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={registrar}
            disabled={!podeRegistrar}
            aria-label="Registrar"
            className={cn("inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-input bg-card text-[13px] font-semibold text-foreground hover:bg-muted/50 disabled:opacity-50", compacto ? "w-8" : "px-3.5")}
          >
            {compacto ? <Send className="h-3.5 w-3.5" /> : "Registrar"}
          </button>
        </div>
      </div>
      {ajuda && <p className="text-[12px] text-muted-foreground">{ajuda}</p>}
    </div>
  );
}
