import { useState } from "react";
import { Loader2 } from "lucide-react";
import { HORARIOS } from "@/config/landingCasaTuaCanoas";
import { cn } from "@/lib/utils";

function mask(d: string) {
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

type Props = { onSubmit: (periodo: string, telefone: string) => Promise<void> };

export default function ReservaVisita({ onSubmit }: Props) {
  const [periodo, setPeriodo] = useState<string | null>(null);
  const [digits, setDigits] = useState("");
  const [sending, setSending] = useState(false);
  const [erro, setErro] = useState("");
  const [done, setDone] = useState(false);
  const valido = !!periodo && digits.length >= 10 && digits.length <= 11;
  const label = HORARIOS.find((h) => h.value === periodo)?.label.toLowerCase();

  const enviar = async () => {
    if (!valido || !periodo) return;
    setSending(true); setErro("");
    try { await onSubmit(periodo, digits); setDone(true); }
    catch (e) { setErro((e as Error).message || "Não foi possível reservar agora. Tente de novo."); }
    finally { setSending(false); }
  };

  return (
    <section className="bg-[hsl(var(--lp-blue))] px-[18px] py-6 text-[hsl(var(--lp-white))]">
      {done ? (
        <div className="py-6 text-center">
          <h2 className="mb-2 text-2xl font-extrabold">Combinado!</h2>
          <p className="text-sm font-semibold opacity-95">Seu corretor vai te chamar no WhatsApp para confirmar {label}.</p>
        </div>
      ) : (
        <>
          <h2 className="mb-3 text-lg font-extrabold">Quer garantir um horário pra conhecer a casa pessoalmente?</h2>
          {HORARIOS.map((h) => (
            <button
              key={h.value}
              type="button"
              onClick={() => setPeriodo(h.value)}
              className={cn(
                "mb-2 block w-full rounded-xl border-[1.5px] p-3 text-left text-sm font-semibold",
                periodo === h.value
                  ? "border-[hsl(var(--lp-white))] bg-[hsl(var(--lp-white))] text-[hsl(var(--lp-blue-ink))]"
                  : "border-[hsl(var(--lp-white)/0.35)] bg-[hsl(var(--lp-white)/0.12)]",
              )}
            >
              {h.label}
            </button>
          ))}
          <label htmlFor="lp-tel" className="mt-2 block text-xs opacity-90">Confirme seu WhatsApp pra reservar o horário</label>
          <div className="mb-1 mt-1.5 flex items-center rounded-xl bg-[hsl(var(--lp-white))]">
            <b className="pl-3.5 pr-1 text-[hsl(var(--lp-ink))]">+55</b>
            <input
              id="lp-tel"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="(51) 99999-9999"
              value={mask(digits)}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 11))}
              className="flex-1 bg-transparent py-3.5 pl-1.5 pr-3.5 text-base font-semibold text-[hsl(var(--lp-ink))] outline-none placeholder:text-[hsl(var(--lp-placeholder))]"
            />
          </div>
          <p className="mb-3 text-xs opacity-85">O mesmo número que você colocou no cadastro.</p>
          {erro && <p className="mb-2 text-xs font-semibold">{erro}</p>}
          <button
            type="button"
            disabled={!valido || sending}
            onClick={enviar}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--lp-white))] py-3.5 text-[15px] font-extrabold text-[hsl(var(--lp-blue))] disabled:opacity-50"
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            Reservar meu horário
          </button>
        </>
      )}
    </section>
  );
}
