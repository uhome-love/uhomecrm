import { QUIZ, type QuizKey } from "@/config/landingCasaTuaCanoas";
import { cn } from "@/lib/utils";

type Props = { value: Partial<Record<QuizKey, string>>; onChange: (k: QuizKey, v: string) => void };

export default function QuizToques({ value, onChange }: Props) {
  const feitos = QUIZ.filter((q) => value[q.key]).length;
  const atual = QUIZ.find((q) => !value[q.key]) ?? null;
  return (
    <section className="border-t border-[hsl(var(--lp-line))] px-[18px] py-5">
      <div className="mb-1.5 text-[11px] font-extrabold tracking-[0.08em] text-[hsl(var(--lp-blue))]">3 TOQUES · 10 SEGUNDOS</div>
      <h2 className="text-lg font-extrabold">Conta pra gente o que você procura</h2>
      <div className="mb-3.5 mt-2 h-1.5 rounded-full bg-[hsl(var(--lp-line))]">
        <i className="block h-full rounded-full bg-[hsl(var(--lp-blue))] transition-all" style={{ width: `${(Math.max(feitos, 0.33) / 3) * 100}%` }} />
      </div>
      {atual ? (
        <>
          <div className="mb-2.5 font-bold">{atual.pergunta}</div>
          {atual.opcoes.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(atual.key, o.value)}
              className={cn(
                "mb-2 block w-full rounded-xl border-[1.5px] border-[hsl(var(--lp-line-2))] bg-[hsl(var(--lp-white))] p-3 text-left text-sm font-semibold active:scale-[0.99]",
              )}
            >
              {o.label}
            </button>
          ))}
        </>
      ) : (
        <p className="text-sm font-semibold text-[hsl(var(--lp-green-ink))]">Valeu! Agora é só escolher o melhor horário abaixo.</p>
      )}
    </section>
  );
}
