import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, FileText } from "lucide-react";
import { HomiActionsRenderer, HomiResultsRenderer } from "@/components/homi/HomiActionCard";
import type { Message } from "@/contexts/HomiContext";

const homiMascot = "/images/homi-mascot-official.png";

interface Props {
  messages: Message[];
  isLoading: boolean;
  userName: string;
  onPrompt: (t: string) => void;
}

const EXEMPLOS = [
  "Me dá o briefing do dia",
  "Escreve um follow-up pro cliente que sumiu",
  "Quais leads estão esfriando?",
  "Me busca 3 dorms até 1,5M no Menino Deus",
];

export default function MessageList({ messages, isLoading, userName, onPrompt }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center gap-5 px-4 py-6 text-center">
        <img src={homiMascot} alt="HOMI, assistente de vendas da Uhome" className="h-14 w-14 sm:h-16 sm:w-16" loading="lazy" />
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">
            {userName ? `Oi, ${userName}. No que a gente mexe agora?` : "No que a gente mexe agora?"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Peça o dia, uma mensagem pronta, um imóvel ou uma tarefa — eu executo com você.
          </p>
        </div>
        <BriefingCard onPrompt={onPrompt} />
        <div className="flex flex-wrap justify-center gap-2">
          {EXEMPLOS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onPrompt(e)}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    );
  }


  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      {messages.map((msg, i) => (
        <div key={i} className={msg.role === "user" ? "flex justify-end" : ""}>
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
                <div className="rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {msg.content}
                </div>
              )}
            </div>
          ) : (

            <div className="space-y-3">
              {msg.content && (
                <div className="prose prose-sm max-w-none text-sm text-foreground dark:prose-invert">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}
              {msg.results && <HomiResultsRenderer results={msg.results} onPick={onPrompt} />}
              {msg.actions && <HomiActionsRenderer actions={msg.actions} />}
            </div>
          )}
        </div>
      ))}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> HOMI está pensando...
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
