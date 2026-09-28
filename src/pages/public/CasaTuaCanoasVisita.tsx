/**
 * Página pública pós-formulário Meta — Casa Tua Canoas (/v/casa-tua-canoas).
 * Fase 1: só salva respostas via edge function `pagina-empreendimento-resposta`.
 * Não lê nem expõe dados de leads. Sem preço/tabela/planta.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import VideoLite from "@/components/landing-casatua-canoas/VideoLite";
import GaleriaSnap from "@/components/landing-casatua-canoas/GaleriaSnap";
import QuizToques from "@/components/landing-casatua-canoas/QuizToques";
import ReservaVisita from "@/components/landing-casatua-canoas/ReservaVisita";
import { CHIPS, LAZER, LANDING_SLUG, PROXIMIDADES, type QuizKey } from "@/config/landingCasaTuaCanoas";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

function Logo() {
  return (
    <svg height="28" viewBox="0 0 180 40" fill="none" aria-label="Uhome">
      <circle cx="20" cy="20" r="18" stroke="#4E6BFF" strokeWidth="2.5" fill="none" />
      <text x="12" y="27" fontFamily="Montserrat, sans-serif" fontSize="20" fontWeight="700" fill="#4E6BFF">U</text>
      <text x="44" y="28" fontFamily="Montserrat, sans-serif" fontSize="22" fontWeight="700" fill="#1F2A44">Home.</text>
    </svg>
  );
}

function Grid({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <section className="border-t border-[hsl(var(--lp-line))] px-[18px] py-5">
      <h2 className="mb-3 text-lg font-extrabold">{titulo}</h2>
      <div className="grid grid-cols-2 gap-2">
        {itens.map((t) => (
          <div key={t} className="rounded-xl bg-[hsl(var(--lp-soft))] p-3 text-[13px] font-semibold">{t}</div>
        ))}
      </div>
    </section>
  );
}

export default function CasaTuaCanoasVisita() {
  const [params] = useSearchParams();
  const [quiz, setQuiz] = useState<Partial<Record<QuizKey, string>>>({});

  useEffect(() => {
    document.title = "Casa Tua Canoas · Uhome";
  }, []);

  const enviar = async (periodo: string, telefone: string) => {
    const utm: Record<string, string> = {};
    UTM_KEYS.forEach((k) => { const v = params.get(k); if (v) utm[k] = v.slice(0, 100); });
    const f = params.get("f");
    const { data, error } = await supabase.functions.invoke("pagina-empreendimento-resposta", {
      body: {
        slug: LANDING_SLUG,
        f: f && /^[a-zA-Z0-9_-]{1,40}$/.test(f) ? f : null,
        telefone,
        periodo,
        respostas: quiz,
        utm,
      },
    });
    if (error || !data?.ok) throw new Error("Não foi possível reservar agora. Tente de novo em instantes.");
  };

  return (
    <div className="lp-casatua min-h-screen bg-[hsl(var(--lp-bg))] text-[hsl(var(--lp-ink))]">
      <div className="mx-auto max-w-[440px] bg-[hsl(var(--lp-white))]">
        <header className="flex items-center gap-3 border-b border-[hsl(var(--lp-line))] px-[18px] py-3.5">
          <Logo />
          <span className="text-[13px] text-[hsl(var(--lp-muted))]">Casa Tua · Canoas</span>
        </header>
        <div className="flex gap-2 bg-[hsl(var(--lp-green-bg))] px-[18px] py-3 text-[13px] font-semibold text-[hsl(var(--lp-green-ink))]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          Recebemos seu contato! Um corretor da Uhome vai te chamar no WhatsApp em instantes.
        </div>
        <h1 className="px-[18px] pb-2 pt-5 text-[26px] font-extrabold leading-[1.15]">Dá uma volta pela casa que pode ser sua</h1>
        <p className="px-[18px] pb-4 text-sm text-[hsl(var(--lp-muted))]">Casas em condomínio no Marechal Rondon, com pátio próprio e clube completo.</p>
        <VideoLite />
        <div className="flex flex-wrap gap-2 px-[18px] py-4">
          {CHIPS.map((c) => (
            <span key={c} className="rounded-full bg-[hsl(var(--lp-blue-soft))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--lp-blue-ink))]">{c}</span>
          ))}
        </div>
        <GaleriaSnap />
        <Grid titulo="Vida de condomínio, espaço de casa" itens={LAZER} />
        <Grid titulo="Perto de tudo em Canoas" itens={PROXIMIDADES} />
        <QuizToques value={quiz} onChange={(k, v) => setQuiz((q) => ({ ...q, [k]: v }))} />
        <ReservaVisita onSubmit={enviar} />
        <footer className="px-[18px] py-5 text-center text-xs text-[hsl(var(--lp-muted))]">
          Valores, condições e plantas são apresentados pelo corretor.
        </footer>
      </div>
    </div>
  );
}
