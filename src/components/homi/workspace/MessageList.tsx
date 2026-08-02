import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2 } from "lucide-react";
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
      <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
        <img src={homiMascot} alt="HOMI, assistente de vendas da Uhome" className="h-16 w-16" loading="lazy" />
        <div>
          <h2 className="text-xl font-semibold">
            {userName ? `Oi, ${userName}. No que a gente mexe agora?` : "No que a gente mexe agora?"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Peça o dia, uma mensagem pronta, um imóvel ou uma tarefa — eu executo com você.
          </p>
        </div>
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
            <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
              {msg.content}
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
