import { useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Target, Bell, Zap, Thermometer, ArrowRight, Check, Sparkles,
  HandCoins, Home, ClockAlert, MessageCircle, PhoneCall, Flame,
  type LucideIcon,
} from "lucide-react";

/**
 * AgendaOnboarding — treinamento guiado da Nova Gestão.
 * Ensina o corretor a trabalhar no novo formato: a atividade atualiza o lead,
 * ele se organiza por (1) Prioridades que o CRM sugere e (2) seus Lembretes.
 * Mostra 1x automático (localStorage); reabre pelo botão "Como funciona".
 */

const CHAVE = "agenda_onboarding_v3";

export function jaViuOnboarding(): boolean {
  try { return localStorage.getItem(CHAVE) === "1"; } catch { return true; }
}
function marcarVisto() {
  try { localStorage.setItem(CHAVE, "1"); } catch { /* ignore */ }
}

/* ————— mini-exemplos visuais (tema claro/escuro) ————— */

function MiniCardPrioridade() {
  return (
    <div className="rounded-xl border border-border bg-card p-3 pl-4 relative overflow-hidden text-left before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-emerald-500">
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
          <HandCoins className="h-2.5 w-2.5" /> Negócio
        </span>
        <span className="text-[10.5px] font-medium text-foreground/80">Quer proposta</span>
        <span className="text-[10.5px] font-semibold text-red-600">· Quente</span>
      </div>
      <div className="mt-1 text-[13px] font-semibold text-foreground">Rodrigo Maués <span className="text-[10.5px] font-normal text-muted-foreground">Em Negociação</span></div>
      <div className="mt-1 rounded-lg bg-muted/60 px-2 py-1 text-[10.5px] italic text-foreground/70">"Pediu um tempo, retornar semana que vem"</div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white"><MessageCircle className="h-2.5 w-2.5" /> WhatsApp</span>
        <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground"><Zap className="h-2.5 w-2.5" /> Registrar</span>
      </div>
    </div>
  );
}

function MiniRegistrar() {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-left">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Registrei</div>
      <div className="mt-1 flex gap-1.5">
        {[["Liguei", PhoneCall], ["WhatsApp", MessageCircle], ["Presencial", Home]].map(([l, Ic], k) => (
          <span key={k} className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-medium", k === 0 ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-border text-foreground")}>
            {k === 0 ? <Check className="h-2.5 w-2.5" /> : (() => { const I = Ic as LucideIcon; return <I className="h-2.5 w-2.5" />; })()} {l as string}
          </span>
        ))}
      </div>
      <div className="mt-2 rounded-md border border-border px-2 py-1.5 text-[10.5px] text-muted-foreground">"Falei com ele, marcou de retornar quinta"</div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px]">
        <span className="text-muted-foreground">Próximo passo:</span>
        <span className="rounded-md border border-primary bg-primary/10 px-2 py-0.5 font-semibold text-primary">Quinta 09:00</span>
      </div>
    </div>
  );
}

function MiniTemperatura() {
  return (
    <div className="flex items-center justify-center gap-2">
      {[["Frio", "text-blue-600 bg-blue-50 dark:bg-blue-500/10"], ["Morno", "text-amber-600 bg-amber-50 dark:bg-amber-500/10"], ["Quente", "text-red-600 bg-red-50 dark:bg-red-500/10"]].map(([l, c]) => (
        <span key={l} className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold", c)}>
          {l === "Quente" && <Flame className="h-3.5 w-3.5" />}{l}
        </span>
      ))}
    </div>
  );
}

function MiniSaude() {
  const dados = [
    ["bg-emerald-500", "Em dia", "no prazo de contato"],
    ["bg-amber-500", "Atenção", "passou do prazo"],
    ["bg-red-500", "Desatualizado", "há muito tempo sem falar"],
  ];
  return (
    <div className="space-y-2">
      {dados.map(([c, t, d]) => (
        <div key={t} className="flex items-center gap-2.5">
          <span className={cn("h-3 w-3 shrink-0 rounded-full", c)} />
          <span className="text-[13px] font-semibold text-foreground">{t}</span>
          <span className="text-[11.5px] text-muted-foreground">— {d}</span>
        </div>
      ))}
    </div>
  );
}

function MiniAbas() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/[0.04] px-3 py-2">
        <Target className="h-4 w-4 text-primary" />
        <div className="text-left">
          <div className="text-[12.5px] font-semibold text-foreground">Prioridades</div>
          <div className="text-[10.5px] text-muted-foreground">o CRM sugere em quem focar</div>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
        <Bell className="h-4 w-4 text-amber-500" />
        <div className="text-left">
          <div className="text-[12.5px] font-semibold text-foreground">Lembretes</div>
          <div className="text-[10.5px] text-muted-foreground">sua organização (Atrasados · Hoje · Futuro)</div>
        </div>
      </div>
    </div>
  );
}

function MiniLoop() {
  const passos = ["Abre a Agenda", "Foca no topo da fila", "Fala pelo WhatsApp", "⚡ Registra o que fez", "Lead atualiza sozinho"];
  return (
    <div className="space-y-1.5">
      {passos.map((p, k) => (
        <div key={k} className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{k + 1}</span>
          <span className="text-[12.5px] text-foreground">{p}</span>
        </div>
      ))}
    </div>
  );
}

interface Slide {
  icon: LucideIcon;
  cor: string;
  titulo: string;
  texto: string;
  destaque?: string;
  visual?: ReactNode;
}

const SLIDES: Slide[] = [
  {
    icon: Sparkles, cor: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
    titulo: "O CRM mudou 🎉",
    texto: "E mudou pra facilitar a sua vida. Nas próximas telas, um tour rápido do novo jeito de trabalhar — leva 1 minutinho e vai te fazer vender com menos esforço. Bora?",
    destaque: "Tour guiado · 1 minuto",
  },
  {
    icon: ClockAlert, cor: "text-zinc-600 bg-zinc-100 dark:bg-zinc-500/10",
    titulo: "O problema de antes",
    texto: "Pra manter um lead vivo, você tinha que ficar criando e concluindo tarefa atrás de tarefa. No fim do dia, o trabalho virava \"limpar tarefas\" — uma burocracia que te prendia e tirava seu foco de quem realmente importava: o cliente.",
    destaque: "Tarefa demais, venda de menos",
  },
  {
    icon: Zap, cor: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
    titulo: "A virada: a Atividade",
    texto: "Agora é o contrário. Você só registra o que fez com o lead — liguei, mandei whatsapp, visitei — e o CRM atualiza o lead sozinho: a saúde, a etapa e o próximo retorno. Menos burocracia, mais conversa com o cliente.",
    destaque: "Registrar o que fez atualiza tudo",
  },
  {
    icon: ArrowRight, cor: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
    titulo: "O novo fluxo, na prática",
    texto: "É um ciclo simples que se repete o dia todo. Você registra, o lead se atualiza e já nasce o próximo passo — que volta pra você na hora certa. Sem planilha, sem decoreba.",
    visual: <MiniLoop />,
  },
  {
    icon: Target, cor: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
    titulo: "Sua nova tela: Agenda",
    texto: "É aqui que seu dia acontece. Duas abas que se completam: Prioridades é o CRM te dizendo em quem focar agora; Lembretes é a sua organização pessoal — o que você mesmo agendou.",
    visual: <MiniAbas />,
  },
  {
    icon: Target, cor: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
    titulo: "Prioridades — em quem focar",
    texto: "O CRM monta a fila do mais quente pro mais frio: negócio e quer-proposta primeiro, depois pós-visita, novo lead, no-show e retornos. Cada card mostra o motivo, a temperatura e sua última anotação. Comece sempre pelo topo.",
    visual: <MiniCardPrioridade />,
    destaque: "Ataque de cima pra baixo",
  },
  {
    icon: Zap, cor: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
    titulo: "⚡ Registrar — o coração",
    texto: "Falou com o lead? Toque em Registrar. Diga o que fez, escreva uma observação e agende o próximo contato. Se quiser, já avança a etapa no mesmo toque. Isso atualiza o lead e tira o card da fila.",
    visual: <MiniRegistrar />,
    destaque: "Só o registro conta como progresso",
  },
  {
    icon: PhoneCall, cor: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    titulo: "Trabalhe do seu WhatsApp",
    texto: "Cada card tem o número à mão: toque em WhatsApp pra abrir a conversa ou Ligar pra discar. Converse como você já faz — e depois volte e ⚡ registre o que rolou. Se um card não é pra agora, Dispensar tira ele da sugestão de hoje.",
    destaque: "WhatsApp · Ligar · Dispensar",
  },
  {
    icon: Bell, cor: "text-amber-600 bg-amber-50 dark:bg-amber-500/10",
    titulo: "Lembretes — sua organização",
    texto: "Sua agenda pessoal: Atrasados, Hoje e Futuro. Quando você registra uma atividade e agenda o próximo passo, ele aparece aqui — e volta pro topo das Prioridades na data certa. Nada mais cai no esquecimento.",
    destaque: "Atrasados · Hoje · Futuro",
  },
  {
    icon: Thermometer, cor: "text-rose-600 bg-rose-50 dark:bg-rose-500/10",
    titulo: "No pipeline: temperatura",
    texto: "No seu pipeline de leads, a partir da Qualificação você marca se o lead está quente, morno ou frio. Essa marca sua entra na conta da fila: quente esfriando sobe pro topo. Marque com sinceridade — é o que faz o CRM te priorizar certo.",
    visual: <MiniTemperatura />,
  },
  {
    icon: ClockAlert, cor: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
    titulo: "A cor do lead = saúde",
    texto: "A barrinha colorida de cada lead mostra a saúde: há quanto tempo você não fala com ele, comparado ao ritmo ideal da etapa. Verde é bom, vermelho pede ação. Registrar uma atividade deixa o lead verde de novo.",
    visual: <MiniSaude />,
  },
  {
    icon: Check, cor: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    titulo: "Pronto pra começar! 🚀",
    texto: "É isso! Abra as Prioridades, comece pelo topo e registre cada contato. Quer rever este tour a qualquer momento? Toque no 🎓 lá em cima, ao lado do HOMI. Bora vender!",
    destaque: "Bom trabalho 💪",
  },
];

export default function AgendaOnboarding({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => { if (open) setI(0); }, [open]);

  const slide = SLIDES[i];
  const Icon = slide.icon;
  const ultimo = i === SLIDES.length - 1;
  const pct = ((i + 1) / SLIDES.length) * 100;

  const fechar = () => { marcarVisto(); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="sm:max-w-md gap-0 overflow-hidden p-0">
        {/* barra de progresso */}
        <div className="h-1 w-full bg-muted">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>

        <div className="px-6 pt-6 pb-5">
          <div className={cn("inline-flex h-12 w-12 items-center justify-center rounded-2xl", slide.cor)}>
            <Icon className="h-6 w-6" strokeWidth={2} />
          </div>
          <div className="mt-4 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Passo {i + 1} de {SLIDES.length}
          </div>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">{slide.titulo}</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{slide.texto}</p>

          {slide.visual && (
            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">{slide.visual}</div>
          )}

          {slide.destaque && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[12.5px] font-semibold text-primary">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> {slide.destaque}
            </div>
          )}
        </div>

        {/* dots */}
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {SLIDES.map((_, k) => (
            <button
              key={k}
              type="button"
              aria-label={`Ir para o passo ${k + 1}`}
              onClick={() => setI(k)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                k === i ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/40"
              )}
            />
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-3.5">
          <button
            type="button"
            onClick={i === 0 ? fechar : () => setI((v) => Math.max(v - 1, 0))}
            className="text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            {i === 0 ? "Pular" : "Voltar"}
          </button>
          {ultimo ? (
            <button
              type="button"
              onClick={fechar}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-[13px] font-bold text-primary-foreground hover:bg-primary/90"
            >
              Começar <Check className="h-4 w-4" strokeWidth={2.5} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setI((v) => Math.min(v + 1, SLIDES.length - 1))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-[13px] font-bold text-primary-foreground hover:bg-primary/90"
            >
              Próximo <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
