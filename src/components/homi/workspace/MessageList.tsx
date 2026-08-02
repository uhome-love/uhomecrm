import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { FileText, CalendarClock, PenLine, Search, BarChart3 } from "lucide-react";
import { HomiActionsRenderer, HomiResultsRenderer } from "@/components/homi/HomiActionCard";
import BriefingCard from "@/components/homi/workspace/BriefingCard";
import ThinkingIndicator from "@/components/homi/workspace/ThinkingIndicator";

import type { Message } from "@/contexts/HomiContext";

const homiFull = "/images/homi-3d-full.png";
const homiBust = "/images/homi-3d-bust.png";

interface Props {
  messages: Message[];
  isLoading: boolean;
  userName: string;
  onPrompt: (t: string) => void;
}

const INTENCOES = [
  { icon: CalendarClock, grupo: "Meu dia", titulo: "Briefing do dia", sub: "Tarefas, visitas e prioridades", prompt: "Me dá o briefing do dia" },
  { icon: PenLine, grupo: "Escrever", titulo: "Follow-up pronto", sub: "Mensagem pro cliente que sumiu", prompt: "Escreve um follow-up pro cliente que sumiu" },
  { icon: Search, grupo: "Buscar", titulo: "Achar imóvel", sub: "Por bairro, valor e dormitórios", prompt: "Me busca 3 dorms até 1,5M no Menino Deus" },
  { icon: BarChart3, grupo: "Números", titulo: "Como está o mês", sub: "VGV, funil e conversão", prompt: "Como estão meus números do mês?" },
];


export default function MessageList({ messages, isLoading, userName, onPrompt }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-8 text-center">
        <img
          src={homiFull}
          alt="HOMI, assistente de vendas da Uhome"
          className="h-24 w-24 object-contain drop-shadow-[0_12px_24px_hsl(var(--primary)/0.25)] animate-scale-in sm:h-28 sm:w-28"
          loading="lazy"
        />
        <div className="animate-fade-in">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {userName ? `Oi, ${userName}. No que a gente mexe agora?` : "No que a gente mexe agora?"}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Peça o dia, uma mensagem pronta, um imóvel ou uma tarefa — eu executo com você.
          </p>
        </div>
        <BriefingCard onPrompt={onPrompt} />
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          {INTENCOES.map((it, i) => (
            <button
              key={it.titulo}
              type="button"
              onClick={() => onPrompt(it.prompt)}
              style={{ animationDelay: `${i * 60}ms` }}
              className="hover-scale group flex animate-fade-in items-start gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/30"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <it.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">{it.grupo}</span>
                <span className="block text-sm font-medium text-foreground">{it.titulo}</span>
                <span className="block truncate text-xs text-muted-foreground">{it.sub}</span>
              </span>
            </button>
          ))}
        </div>

      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-7 px-4 py-6">
      {messages.map((msg, i) => (
        <div key={i} className={`animate-fade-in ${msg.role === "user" ? "flex justify-end" : ""}`}>
          {msg.role === "user" ? (
            <div className="flex max-w-[85%] flex-col items-end gap-1.5">
              {!!msg.anexos?.length && (
                <div className="flex flex-wrap justify-end gap-1.5">
                  {msg.anexos.map((a, j) =>
                    a.tipo?.startsWith("image/") && a.url ? (
                      <img key={j} src={a.url} alt={a.nome} className="max-h-40 rounded-xl border border-border object-cover" />
                    ) : (
                      <span key={j} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs text-foreground">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        <span className="max-w-[180px] truncate">{a.nome}</span>
                      </span>
                    )
                  )}
                </div>
              )}
              {msg.content && (
                <div className="rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm">
                  {msg.content}
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-3">
              <img
                src={homiBust}
                alt=""
                aria-hidden
                className="mt-0.5 hidden h-7 w-7 shrink-0 rounded-full object-cover sm:block"
                loading="lazy"
              />
              <div className="min-w-0 flex-1 space-y-3">
                {msg.content && (
                  <div className="prose prose-sm max-w-none text-[0.9375rem] leading-relaxed text-foreground dark:prose-invert prose-headings:mb-2 prose-headings:mt-4 prose-headings:text-base prose-headings:font-semibold prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-strong:text-foreground">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
                {msg.results && <HomiResultsRenderer results={msg.results} onPick={onPrompt} />}
                {msg.actions && <HomiActionsRenderer actions={msg.actions} />}
              </div>
            </div>
          )}
        </div>
      ))}

      {isLoading && <ThinkingIndicator />}
      <div ref={endRef} />
    </div>
  );
}

