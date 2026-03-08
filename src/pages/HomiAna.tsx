import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Copy, Check, Megaphone, Camera, Film, Smartphone, CalendarDays, PenLine, Building2, DollarSign, ClipboardList, Mail, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const homiMascot = "/images/homi-mascot-opt.png";

type Msg = { role: "user" | "assistant"; content: string };

// Uses dedicated homi-ana edge function

const SYSTEM_CONTEXT = `Você é o HOMI, assistente especializado de marketing imobiliário e backoffice da Uhome Negócios Imobiliários, Porto Alegre/RS.

Sua personalidade: energético, criativo, direto, fala como criador de conteúdo profissional. Usa emojis com moderação. Conhece os empreendimentos de cor.

EMPREENDIMENTOS ATIVOS:
- Seg 1 (MCMV/até 500k): Open Bosque
- Seg 2 (Médio-alto): Orygem, Casa Tua, Las Casas
- Seg 3 (Altíssimo padrão): Lake Eyre
- Seg 4 (Investimento): Casa Bastian, Shift

HASHTAGS POR EMPREENDIMENTO:
Open Bosque: #OpenBosque #ApartamentoPOA #MCMV #MinhaCasaMinhaVida #ImóvelAcessível #UhomePOA #PortoAlegre
Lake Eyre: #LakeEyre #LuxuryLiving #ImóvelDeLuxo #AltopadrãoPOA #UhomeLuxury #ViverBem #PortoAlegre
Casa Bastian / Shift: #CasaBastian #Shift #InvestimentoImobiliário #RendaPassiva #ImóvelComoInvestimento #Uhome
Orygem / Casa Tua / Las Casas: #Orygem #CasaTua #LasCasas #ImóvelMédiopadrão #SeuNovoLar #UhomePOA
Gerais: #Uhome #UhomeNegócios #ImóvelPortoAlegre #CorretorPOA #MercadoImobiliário #NovoComeço

TIME COMERCIAL: ~25 corretores, 3 gerentes (Gabrielle, Bruno, Gabriel)
CEO: Lucas Sarmento

Você ajuda Ana Paula com:
1. Criação de conteúdo para Instagram, TikTok e Reels
2. Planejamento de calendário de conteúdo semanal/mensal
3. Geração de legendas, roteiros e CTAs
4. Apoio operacional: pagadorias, contratos, tarefas
5. Briefings criativos para campanhas dos empreendimentos

Fale de forma criativa mas profissional. Seja direto e prático.
Quando sugerir conteúdo, sempre entregue pronto para usar.
Quando criar legendas, inclua emojis, CTA e hashtags otimizadas.
Quando criar roteiros, numere com timestamps (0:00, 0:05...).
Quando criar calendários, use formato de tabela: Dia | Formato | Empreendimento | Tema | Horário sugerido.`;

// ── Shortcut definitions ──
type Shortcut = { label: string; icon: React.ComponentType<{ className?: string }>; prompt: string; sub?: { label: string; prompt: string }[] };
type ShortcutGroup = { title: string; icon: string; items: Shortcut[] };

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Conteúdo",
    icon: "📣",
    items: [
      {
        label: "Ideia de Post",
        icon: Camera,
        prompt: "Me dê 5 ideias de posts para Instagram da Uhome para esta semana. Inclua: tema, formato (foto/carrossel/reels), legenda completa com emojis e hashtags. Foque nos empreendimentos ativos.",
      },
      {
        label: "Roteiro de Reels",
        icon: Film,
        prompt: "Crie um roteiro completo de Reels de 30-60 segundos para a Uhome. Inclua: gancho (primeiros 3 segundos), desenvolvimento, CTA final, sugestão de música trending, texto para colocar na tela.",
      },
      {
        label: "Vídeo TikTok",
        icon: Smartphone,
        prompt: "Crie um roteiro de vídeo TikTok de 15-30 segundos para a Uhome. Estilo: informativo/entretenimento imobiliário. Inclua gancho irresistível, estrutura do vídeo e legenda com hashtags.",
      },
      {
        label: "Plano Semanal",
        icon: CalendarDays,
        prompt: "Monte um calendário de conteúdo para esta semana (Seg a Sex + Sáb). Para cada dia: 1 post feed + 1 story + (opcional) 1 reels. Distribua os empreendimentos ao longo da semana. Formato de tabela: Dia | Formato | Empreendimento | Tema | Horário sugerido",
      },
      {
        label: "Legenda Pronta",
        icon: PenLine,
        prompt: "",
        sub: [
          { label: "Open Bosque", prompt: "Crie uma legenda completa para post do Instagram sobre o Open Bosque. Inclua emojis, CTA forte e hashtags otimizadas (#OpenBosque #MCMV etc). Pronta para copiar e colar." },
          { label: "Lake Eyre", prompt: "Crie uma legenda completa para post do Instagram sobre o Lake Eyre. Inclua emojis, CTA forte e hashtags otimizadas (#LakeEyre #LuxuryLiving etc). Pronta para copiar e colar." },
          { label: "Casa Bastian", prompt: "Crie uma legenda completa para post do Instagram sobre o Casa Bastian. Inclua emojis, CTA forte e hashtags otimizadas (#CasaBastian #InvestimentoImobiliário etc). Pronta para copiar e colar." },
          { label: "Orygem", prompt: "Crie uma legenda completa para post do Instagram sobre o Orygem. Inclua emojis, CTA forte e hashtags otimizadas (#Orygem #SeuNovoLar etc). Pronta para copiar e colar." },
          { label: "Shift", prompt: "Crie uma legenda completa para post do Instagram sobre o Shift. Inclua emojis, CTA forte e hashtags otimizadas (#Shift #InvestimentoImobiliário etc). Pronta para copiar e colar." },
          { label: "Casa Tua", prompt: "Crie uma legenda completa para post do Instagram sobre o Casa Tua. Inclua emojis, CTA forte e hashtags otimizadas (#CasaTua #SeuNovoLar etc). Pronta para copiar e colar." },
          { label: "Las Casas", prompt: "Crie uma legenda completa para post do Instagram sobre o Las Casas. Inclua emojis, CTA forte e hashtags otimizadas (#LasCasas #UhomePOA etc). Pronta para copiar e colar." },
        ],
      },
    ],
  },
  {
    title: "Empreendimentos",
    icon: "🏠",
    items: [
      { label: "Open Bosque", icon: Building2, prompt: "Preciso de conteúdo para o Open Bosque. Me dê:\n1. Post para feed (carrossel ou foto)\n2. Story interativo (enquete ou pergunta)\n3. Reels de 30s\nPara cada um: tema, legenda completa, hashtags." },
      { label: "Lake Eyre", icon: Building2, prompt: "Preciso de conteúdo para o Lake Eyre. Me dê:\n1. Post para feed (carrossel ou foto)\n2. Story interativo (enquete ou pergunta)\n3. Reels de 30s\nPara cada um: tema, legenda completa, hashtags." },
      { label: "Casa Bastian", icon: Building2, prompt: "Preciso de conteúdo para o Casa Bastian. Me dê:\n1. Post para feed (carrossel ou foto)\n2. Story interativo (enquete ou pergunta)\n3. Reels de 30s\nPara cada um: tema, legenda completa, hashtags." },
      { label: "Orygem / Casa Tua", icon: Building2, prompt: "Preciso de conteúdo para Orygem e Casa Tua. Me dê:\n1. Post para feed (carrossel ou foto)\n2. Story interativo (enquete ou pergunta)\n3. Reels de 30s\nPara cada um: tema, legenda completa, hashtags." },
      { label: "Shift / Las Casas", icon: Building2, prompt: "Preciso de conteúdo para Shift e Las Casas. Me dê:\n1. Post para feed (carrossel ou foto)\n2. Story interativo (enquete ou pergunta)\n3. Reels de 30s\nPara cada um: tema, legenda completa, hashtags." },
    ],
  },
  {
    title: "Operacional",
    icon: "💼",
    items: [
      { label: "Ajuda com Pagadoria", icon: DollarSign, prompt: "Vou te passar os dados de uma pagadoria. Me ajude a:\n1. Verificar se os valores estão corretos\n2. Formatar o texto da descrição\n3. Identificar se falta alguma informação\nPode começar me perguntando os dados necessários." },
      { label: "Criar Tarefa", icon: ClipboardList, prompt: "Preciso criar uma nova tarefa. Me pergunte: título, prazo e prioridade, e me ajude a organizar." },
      { label: "Rascunho de E-mail", icon: Mail, prompt: "Preciso de um e-mail profissional. Me diga o objetivo e eu escrevo um rascunho completo pronto para enviar." },
      { label: "Relatório Semanal", icon: BarChart3, prompt: "Gere um resumo semanal de performance da Uhome baseado nos dados disponíveis. Inclua visitas, leads, aproveitamentos e sugestões de melhoria." },
    ],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-[10px] gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado!" : "Copiar"}
    </Button>
  );
}

export default function HomiAna() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Generate daily briefing on first load
  useEffect(() => {
    if (messages.length > 0) return;
    const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
    const briefingPrompt = `Hoje é ${today}. Me dê um briefing rápido do dia como meu sócio criativo. Inclua:
- Uma sugestão de conteúdo ideal para hoje (baseado no dia da semana)
- Uma frase motivacional criativa
- Pergunte por onde quero começar.
Seja breve e energético. Comece com "Oi Ana! 👋"`;
    send(briefingPrompt, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(async (text?: string, isSystem = false) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    if (!isSystem) setInput("");

    const userMsg: Msg = { role: "user", content: msg };
    const updated: Msg[] = isSystem ? [] : [...messages, userMsg];
    if (!isSystem) setMessages(updated);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("homi-ana", {
        body: { messages: isSystem ? [userMsg] : updated },
      });
      if (error) throw error;
      const reply = data?.reply || data?.message || "Sem resposta.";
      setMessages((prev) => [...prev, { role: "assistant" as const, content: reply }]);
    } catch {
      toast.error("Ops! O HOMI está descansando um segundo. Tente novamente 🤖");
    }
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleShortcut = (prompt: string) => {
    setExpandedSub(null);
    send(prompt);
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      {/* ── Left Column: Shortcuts ── */}
      <div className="w-64 shrink-0 hidden lg:flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <img src={homiMascot} alt="HOMI" className="h-8 w-8 object-contain" />
          <div>
            <h2 className="text-sm font-bold text-foreground">HOMI Ana</h2>
            <p className="text-[10px] text-muted-foreground">Sócio criativo & operacional</p>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 pr-2">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <span>{group.icon}</span> {group.title}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <div key={item.label}>
                      <button
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-accent/50 transition-colors text-foreground/80 hover:text-foreground"
                        onClick={() => {
                          if (item.sub) {
                            setExpandedSub(expandedSub === item.label ? null : item.label);
                          } else {
                            handleShortcut(item.prompt);
                          }
                        }}
                      >
                        <item.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>{item.label}</span>
                        {item.sub && <span className="ml-auto text-[10px] text-muted-foreground">▸</span>}
                      </button>
                      {item.sub && expandedSub === item.label && (
                        <div className="ml-6 mt-0.5 space-y-0.5 animate-fade-in">
                          {item.sub.map((s) => (
                            <button
                              key={s.label}
                              className="w-full text-left px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
                              onClick={() => handleShortcut(s.prompt)}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* ── Right Column: Chat ── */}
      <div className="flex-1 flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-semibold text-foreground">Chat com HOMI</span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {format(new Date(), "EEEE, d MMM", { locale: ptBR })}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center gap-4 py-12">
              <img src={homiMascot} alt="HOMI Ana" className="h-20 w-20 object-contain" />
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Preparando seu briefing do dia...
              </p>
            </div>
          )}

          <AnimatePresence>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} group/msg`}
              >
                <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm relative ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}>
                  {m.role === "assistant" ? (
                    <>
                      <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                      <div className="flex gap-1 mt-1.5">
                        <CopyButton text={m.content} />
                      </div>
                    </>
                  ) : m.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">HOMI está criando...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Mobile shortcuts */}
        <div className="lg:hidden border-t border-border px-3 py-2 overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            {SHORTCUT_GROUPS.flatMap((g) => g.items.filter((i) => !i.sub).slice(0, 2)).map((item) => (
              <Button
                key={item.label}
                variant="outline"
                size="sm"
                className="text-[10px] h-7 px-2 shrink-0"
                onClick={() => handleShortcut(item.prompt)}
              >
                <item.icon className="h-3 w-3 mr-1" />
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border p-3 flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Peça conteúdo, roteiros, legendas, ajuda operacional..."
            className="resize-none min-h-[44px] max-h-32 text-sm"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
          />
          <Button size="icon" onClick={() => send()} disabled={loading || !input.trim()} className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
