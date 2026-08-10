import { useState } from "react";
import { Sparkles, MessageCircle, Copy, RefreshCw, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { waLink } from "@/lib/phone";
import { personalizarComHomi, substituirVariaveis } from "@/hooks/useComunicacao";

/**
 * HomiSugestaoMensagem — sugestão de mensagem pronta por card (Nova Gestão).
 * Sob demanda (o corretor pede): usa um template-semente conforme o motivo da
 * fila + o contexto do lead (última interação, etapa) e devolve algo pronto pra
 * enviar no WhatsApp. Opcional — o ⚡ Registrar continua sendo a ação principal.
 */

const SEED: Record<string, string> = {
  negocio: "Oi {{nome}}, tudo bem? Estou cuidando pessoalmente da sua proposta no {{empreendimento}} e queria alinhar os próximos passos com você. Posso te ligar hoje?",
  pos_visita: "Oi {{nome}}! Foi ótimo te receber na visita ao {{empreendimento}}. Queria saber o que você achou e tirar qualquer dúvida. Como posso te ajudar?",
  no_show: "Oi {{nome}}, tudo bem? Acabamos não conseguindo fazer a visita ao {{empreendimento}}. Quer que eu remarque pra um horário melhor pra você?",
  novo_lead: "Oi {{nome}}! Aqui é {{corretor}}, da Uhome. Vi seu interesse no {{empreendimento}} e queria te ajudar a conhecer melhor. Qual o melhor horário pra conversarmos?",
  retorno_hoje: "Oi {{nome}}, tudo bem? Passando pra retomar nossa conversa sobre o {{empreendimento}}. Você tem um tempinho hoje?",
  quente_esfriando: "Oi {{nome}}! Faz um tempinho que não conversamos sobre o {{empreendimento}}. Surgiram novidades boas e queria te atualizar. Posso te mandar?",
  sem_proximo_passo: "Oi {{nome}}, tudo bem? Fiquei de te retornar sobre o {{empreendimento}} e não quero te deixar sem resposta. Ainda faz sentido pra você?",
  default: "Oi {{nome}}, tudo bem? Passando pra retomar nosso contato sobre o {{empreendimento}}. Como posso te ajudar?",
};

interface Props {
  nome: string;
  empreendimento: string | null;
  telefone: string | null;
  motivo: string;
  stageNome: string;
  ultimoRegistro: string | null;
}

export default function HomiSugestaoMensagem({ nome, empreendimento, telefone, motivo, stageNome, ultimoRegistro }: Props) {
  const { user } = useAuth();
  const corretorNome =
    (user?.user_metadata as { full_name?: string; nome?: string } | undefined)?.full_name ||
    (user?.user_metadata as { nome?: string } | undefined)?.nome ||
    "seu corretor Uhome";
  const [estado, setEstado] = useState<"idle" | "loading" | "pronta">("idle");
  const [msg, setMsg] = useState("");

  const leadCtx = {
    nome,
    empreendimento: empreendimento ?? undefined,
    ultima_interacao: ultimoRegistro ?? undefined,
    fase: stageNome,
  };

  const gerar = async () => {
    setEstado("loading");
    try {
      const base = substituirVariaveis(SEED[motivo] ?? SEED.default, leadCtx as never, corretorNome);
      const texto = await personalizarComHomi(base, leadCtx as never, corretorNome);
      setMsg(texto.trim());
      setEstado("pronta");
    } catch {
      toast.error("O HOMI não conseguiu gerar agora. Tenta de novo.");
      setEstado("idle");
    }
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(msg); toast.success("Mensagem copiada"); }
    catch { toast.error("Não deu pra copiar"); }
  };

  const wa = waLink(telefone);
  const waComTexto = wa && msg ? `${wa}?text=${encodeURIComponent(msg)}` : null;

  if (estado === "idle") {
    // Se já foi gerada, reabrir mostra a mensagem em cache (não gasta IA de novo).
    const reabrir = (e: React.MouseEvent) => { e.stopPropagation(); setEstado(msg ? "pronta" : "loading"); if (!msg) gerar(); };
    return (
      <button
        type="button"
        onClick={reabrir}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[12px] font-semibold text-violet-700 hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300"
      >
        <Sparkles className="h-3.5 w-3.5" /> {msg ? "Ver mensagem do HOMI" : "Ver mensagem que o HOMI preparou"}
      </button>
    );
  }

  if (estado === "loading") {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[12px] font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> HOMI escrevendo…
      </div>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-2 overflow-hidden rounded-xl border border-violet-200 bg-violet-50/60 dark:border-violet-500/30 dark:bg-violet-500/5"
    >
      <div className="flex items-center gap-1.5 border-b border-violet-200/70 bg-violet-100/60 px-3 py-1.5 text-[11px] font-bold text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
        <Sparkles className="h-3.5 w-3.5" /> HOMI sugere
        <span className="font-medium text-violet-500/80 dark:text-violet-300/60">· revise antes de enviar</span>
        <button
          type="button"
          aria-label="Fechar sugestão"
          onClick={(e) => { e.stopPropagation(); setEstado("idle"); }}
          className="ml-auto -mr-1 rounded-md p-1 text-violet-500/70 hover:bg-violet-200/60 hover:text-violet-700 dark:hover:bg-violet-500/20"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="px-3 pt-2 text-[13px] leading-snug text-foreground/90">{msg}</p>
      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2.5 pt-2">
        {waComTexto && (
          <a
            href={waComTexto} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-violet-700"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Enviar no WhatsApp
          </a>
        )}
        <button type="button" onClick={copiar} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] font-semibold text-foreground hover:bg-muted">
          <Copy className="h-3.5 w-3.5" /> Copiar
        </button>
        <button type="button" onClick={gerar} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
          <RefreshCw className="h-3.5 w-3.5" /> Outra
        </button>
      </div>
    </div>
  );
}
