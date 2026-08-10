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

const CHAVE = "agenda_onboarding_v4";

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

function MiniDiaADia() {
  const itens: [LucideIcon, string, string, string][] = [
    [Target, "Agenda", "seu foco do dia — em quem falar agora", "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10"],
    [HandCoins, "Pipeline", "todos os seus leads, por etapa e saúde", "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10"],
    [Home, "Visitas", "sua agenda de visitas marcadas", "text-amber-600 bg-amber-50 dark:bg-amber-500/10"],
  ];
  return (
    <div className="space-y-2">
      {itens.map(([Ic, t, d, c]) => (
        <div key={t} className="flex items-center gap-2.5">
          <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", c)}><Ic className="h-3.5 w-3.5" /></span>
          <span className="text-left"><span className="block text-[12.5px] font-semibold text-foreground">{t}</span><span className="block text-[10.5px] text-muted-foreground">{d}</span></span>
        </div>
      ))}
    </div>
  );
}

function MiniBeneficios() {
  const b = ["Menos burocracia, mais conversa com o cliente", "O CRM te diz em quem focar agora", "Nada mais cai no esquecimento", "Mais tempo pra fazer o que importa: vender"];
  return (
    <div className="space-y-1.5">
      {b.map((t) => (
        <div key={t} className="flex items-start gap-2">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" strokeWidth={2.5} />
          <span className="text-[12.5px] text-foreground">{t}</span>
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
    titulo: "O problema das tarefas",
    texto: "Antes, pra manter um lead vivo você tinha que ficar criando e concluindo tarefa atrás de tarefa. No fim do dia o trabalho virava \"limpar tarefas\" — uma burocracia que te prendia e roubava seu foco de quem importa: o cliente.",
    destaque: "Tarefa demais, venda de menos",
  },
  {
    icon: Zap, cor: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
    titulo: "Criamos a Atividade",
    texto: "Agora é o contrário. Você só registra o que fez com o lead — liguei, mandei whatsapp, visitei — e o CRM cuida do resto. Uma ação simples que carrega todo o trabalho pesado por você.",
    destaque: "Registrar o que fez > marcar tarefa",
  },
  {
    icon: HandCoins, cor: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    titulo: "Seu pipeline ficou vivo",
    texto: "Cada atividade que você registra atualiza o lead sozinho: a saúde (a cor), a etapa e o próximo retorno. A cor mostra há quanto tempo você não fala com ele — verde é bom, vermelho pede ação. Registrou, ficou verde de novo.",
    visual: <MiniSaude />,
    destaque: "A atividade atualiza tudo",
  },
  {
    icon: Thermometer, cor: "text-rose-600 bg-rose-50 dark:bg-rose-500/10",
    titulo: "Temperatura + nova ordenação",
    texto: "A partir da Qualificação, você marca o lead como quente, morno ou frio. Essa marca sua, junto com a saúde, define uma nova ordem: o CRM ordena seus leads por VALOR — quem tá quente e pedindo ação vem primeiro, não mais por ordem de chegada.",
    visual: <MiniTemperatura />,
    destaque: "Ordenado por valor, não por data",
  },
  {
    icon: Target, cor: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
    titulo: "Adeus central de tarefas",
    texto: "A antiga central de tarefas saiu de cena. No lugar nasceu a Agenda: uma página inteligente que te guia no que fazer. Duas abas — Prioridades (o CRM sugere em quem focar) e Lembretes (a sua organização pessoal).",
    visual: <MiniAbas />,
  },
  {
    icon: Target, cor: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
    titulo: "Prioridades — em quem focar",
    texto: "A fila do mais quente pro mais frio: negócio e quer-proposta primeiro, depois pós-visita, novo lead, no-show e retornos. Cada card mostra o motivo, a temperatura e sua última anotação. Comece sempre pelo topo.",
    visual: <MiniCardPrioridade />,
    destaque: "Ataque de cima pra baixo",
  },
  {
    icon: Zap, cor: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
    titulo: "⚡ Registrar — o coração",
    texto: "Falou com o lead? Toque em Registrar. Diga o que fez, escreva uma observação e agende o próximo contato. Se quiser, já avança a etapa no mesmo toque. Isso atualiza o lead e tira o card da fila. Se não é pra agora, Dispensar guarda pra depois.",
    visual: <MiniRegistrar />,
    destaque: "Só o registro conta como progresso",
  },
  {
    icon: Bell, cor: "text-amber-600 bg-amber-50 dark:bg-amber-500/10",
    titulo: "Lembretes — sua organização",
    texto: "Sua agenda pessoal: Atrasados, Hoje e Futuro. Quando você registra uma atividade e agenda o próximo passo, ele aparece aqui — e volta pro topo das Prioridades na data certa. Nada mais cai no esquecimento.",
    destaque: "Atrasados · Hoje · Futuro",
  },
  {
    icon: ArrowRight, cor: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
    titulo: "Seu dia a dia em 3 telas",
    texto: "É simples: comece pela Agenda pra saber em quem focar, use o Pipeline pra ver todos os seus leads por etapa, e a Visitas pra sua agenda de visitas marcadas. Tudo conversa entre si.",
    visual: <MiniDiaADia />,
  },
  {
    icon: Check, cor: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    titulo: "O que você ganha",
    texto: "No fim das contas, é isso que muda pra você no dia a dia:",
    visual: <MiniBeneficios />,
  },
  {
    icon: Flame, cor: "text-rose-600 bg-rose-50 dark:bg-rose-500/10",
    titulo: "Bora vender! 🚀",
    texto: "Você tem tudo pra fazer um dia brabo. Abra as Prioridades, comece pelo topo e registre cada contato — o resto o CRM faz por você. Quer rever este tour? Toque no 🎓 lá em cima, ao lado do HOMI. Sucesso! 💪",
    destaque: "Agora é com você",
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
