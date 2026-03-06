import { useState } from "react";
import { MessageSquare, PhoneCall, RefreshCw, ShieldQuestion, MapPin, Sparkles, Copy, ArrowLeft, MessageCircle, Clock } from "lucide-react";
import HomiChat from "@/components/homi/HomiChat";
import HomiHistory from "@/components/homi/HomiHistory";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
const homiMascot = "/images/homi-mascot-opt.png";

type Acao = "responder_whatsapp" | "criar_followup" | "script_ligacao" | "quebrar_objecao" | "preparar_visita";

const ACOES: { id: Acao; label: string; icon: typeof MessageSquare; description: string }[] = [
  { id: "responder_whatsapp", label: "Responder WhatsApp", icon: MessageSquare, description: "Crie a resposta perfeita" },
  { id: "criar_followup", label: "Criar Follow Up", icon: RefreshCw, description: "Retome a conversa" },
  { id: "script_ligacao", label: "Script de Ligação", icon: PhoneCall, description: "Roteiro para ligar" },
  { id: "quebrar_objecao", label: "Quebrar Objeção", icon: ShieldQuestion, description: "Contorne resistências" },
  { id: "preparar_visita", label: "Preparar Visita", icon: MapPin, description: "Conduza para a visita" },
];

const EMPREENDIMENTOS = [
  "Casa Tua", "Open Bosque", "Melnick Day", "Alto Lindóia",
  "Orygem", "Casa Bastian", "Shift", "Lake Eyre", "Las Casas",
];

const SITUACOES = [
  "Lead novo", "Pediu mais informações", "Parou de responder",
  "Disse que vai pensar", "Disse que está caro", "Quer ver outras opções",
  "Pós visita", "Negociação",
];

const OBJETIVOS = ["Gerar visita", "Retomar conversa", "Qualificar cliente", "Enviar material"];

type Step = "home" | "form" | "result" | "chat" | "history";

export default function HomiAssistant() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("home");
  const [acao, setAcao] = useState<Acao | null>(null);
  const [empreendimento, setEmpreendimento] = useState("");
  const [situacao, setSituacao] = useState("");
  const [mensagemCliente, setMensagemCliente] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [resultado, setResultado] = useState("");
  const [generating, setGenerating] = useState(false);

  const selectAcao = (a: Acao) => { setAcao(a); setStep("form"); };

  const reset = () => {
    setStep("home"); setAcao(null); setResultado("");
    setEmpreendimento(""); setSituacao(""); setMensagemCliente(""); setObjetivo("");
  };

  const generate = async () => {
    if (!empreendimento || !situacao || !objetivo) {
      toast.error("Preencha empreendimento, situação e objetivo");
      return;
    }
    setGenerating(true); setResultado(""); setStep("result");

    const { data, error } = await supabase.functions.invoke("homi-assistant", {
      body: { acao, empreendimento, situacao, mensagem_cliente: mensagemCliente, objetivo },
    });

    if (error) {
      toast.error("Erro ao gerar resposta");
      console.error(error);
      setStep("form");
    } else {
      const content = data?.content || "Sem resposta.";
      setResultado(content);

      // Save to history
      if (user) {
        const titulo = `${ACOES.find(a => a.id === acao)?.label} · ${empreendimento}`;
        supabase.from("homi_conversations").insert({
          user_id: user.id,
          tipo: "acao",
          acao,
          empreendimento,
          situacao,
          objetivo,
          titulo,
          resultado: content,
        } as any).then(({ error: e }) => { if (e) console.error("Save history error:", e); });
      }
    }
    setGenerating(false);
  };

  const copySection = (text: string) => {
    const cleaned = text.replace(/^##\s*[^\n]+\n/, "").trim();
    navigator.clipboard.writeText(cleaned);
    toast.success("Copiado!");
  };

  const copyAll = () => { navigator.clipboard.writeText(resultado); toast.success("Tudo copiado!"); };

  const rawSections = resultado.split(/(?=## )/).filter(s => s.trim());
  const sections = rawSections.map((s, i) => {
    if (i === 0 && !s.startsWith("## ")) return `## 🧠 Análise da Situação\n${s}`;
    return s;
  });

  const acaoInfo = ACOES.find(a => a.id === acao);

  return (
    <div className={`max-w-2xl mx-auto ${step === "chat" ? "" : "px-4 py-6"}`}>
      <AnimatePresence mode="wait">
        {/* HOME */}
        {step === "home" && (
          <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            <div className="text-center mb-8">
              <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }} className="inline-block mb-4">
                <img src={homiMascot} alt="HOMI" className="h-20 w-20 mx-auto rounded-2xl shadow-lg" />
              </motion.div>
              <h1 className="font-display text-2xl font-bold text-foreground mb-1">HOMI</h1>
              <p className="text-sm text-muted-foreground">Como posso te ajudar com esse lead?</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {ACOES.map((a, i) => (
                <motion.div key={a.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07, duration: 0.3 }}>
                  <button onClick={() => selectAcao(a.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md hover:bg-primary/5 transition-all duration-200 group text-left">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200">
                      <a.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">{a.label}</p>
                      <p className="text-xs text-muted-foreground">{a.description}</p>
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Chat Livre + Histórico */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: ACOES.length * 0.07, duration: 0.3 }}>
                <button onClick={() => setStep("chat")}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:border-primary/60 hover:shadow-md hover:bg-primary/10 transition-all duration-200 group text-left">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all duration-200">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">Chat Livre</p>
                    <p className="text-[11px] text-muted-foreground">Converse com o HOMI</p>
                  </div>
                </button>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: ACOES.length * 0.07 + 0.05, duration: 0.3 }}>
                <button onClick={() => setStep("history")}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md hover:bg-primary/5 transition-all duration-200 group text-left">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all duration-200">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">Histórico</p>
                    <p className="text-[11px] text-muted-foreground">Consultas anteriores</p>
                  </div>
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* CHAT */}
        {step === "chat" && (
          <motion.div key="chat" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }} className="h-full">
            <HomiChat onBack={reset} />
          </motion.div>
        )}

        {/* HISTORY */}
        {step === "history" && (
          <motion.div key="history" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}>
            <HomiHistory onBack={reset} />
          </motion.div>
        )}

        {/* FORM */}
        {step === "form" && (
          <motion.div key="form" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}>
            <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </button>
            <div className="flex items-center gap-3 mb-6">
              {acaoInfo && (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <acaoInfo.icon className="h-5 w-5" />
                </div>
              )}
              <div>
                <h2 className="font-display font-bold text-lg text-foreground">{acaoInfo?.label}</h2>
                <p className="text-xs text-muted-foreground">{acaoInfo?.description}</p>
              </div>
            </div>
            <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Empreendimento *</Label>
                <Select value={empreendimento} onValueChange={setEmpreendimento}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{EMPREENDIMENTOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Situação do lead *</Label>
                <Select value={situacao} onValueChange={setSituacao}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{SITUACOES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Mensagem do cliente <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Textarea placeholder='Ex: "vou pensar", "achei caro"...' value={mensagemCliente} onChange={e => setMensagemCliente(e.target.value)} rows={2} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Objetivo *</Label>
                <Select value={objetivo} onValueChange={setObjetivo}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{OBJETIVOS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={generate} disabled={generating} className="w-full gap-2 h-11 text-sm font-semibold">
                <Sparkles className="h-4 w-4" /> Gerar Resposta
              </Button>
            </div>
          </motion.div>
        )}

        {/* RESULT */}
        {step === "result" && (
          <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <button onClick={() => setStep("form")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao formulário
            </button>
            {generating ? (
              <div className="rounded-xl border border-border bg-card shadow-card p-12 text-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="inline-block mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </motion.div>
                <p className="text-sm font-medium text-foreground mb-1">HOMI está pensando...</p>
                <p className="text-xs text-muted-foreground">Gerando a melhor resposta para seu lead</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-1">
                    <img src={homiMascot} alt="HOMI" className="h-7 w-7 rounded-lg" />
                    <span className="font-display font-bold text-sm text-foreground">Resposta do HOMI</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyAll} className="gap-1.5 text-xs h-8"><Copy className="h-3 w-3" /> Copiar tudo</Button>
                  <Button variant="outline" size="sm" onClick={generate} className="gap-1.5 text-xs h-8"><RefreshCw className="h-3 w-3" /> Nova versão</Button>
                </div>
                <div className="space-y-3">
                  {sections.map((section, i) => {
                    const titleMatch = section.match(/^##\s*(.+)/);
                    const title = titleMatch ? titleMatch[1].trim() : "";
                    const body = section.replace(/^##\s*[^\n]+\n/, "").trim();
                    if (!body) return null;
                    const isWhatsApp = title.includes("💬") || title.toLowerCase().includes("whatsapp");
                    const isAlternative = title.includes("🔄") || title.toLowerCase().includes("alternativ");
                    const isScript = title.includes("📞") || title.toLowerCase().includes("script");
                    const isAction = title.includes("🎯") || title.toLowerCase().includes("ação");
                    const isAnalysis = title.includes("🧠") || title.toLowerCase().includes("anális");
                    const headerColor = isWhatsApp ? "bg-emerald-500/10 border-emerald-500/20"
                      : isAlternative ? "bg-blue-500/10 border-blue-500/20"
                      : isScript ? "bg-amber-500/10 border-amber-500/20"
                      : isAction ? "bg-primary/10 border-primary/20"
                      : isAnalysis ? "bg-violet-500/10 border-violet-500/20"
                      : "bg-muted/30 border-border";
                    const borderColor = isWhatsApp ? "border-emerald-500/20" : isAlternative ? "border-blue-500/20" : isScript ? "border-amber-500/20" : isAction ? "border-primary/20" : isAnalysis ? "border-violet-500/20" : "border-border";
                    return (
                      <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                        className={`rounded-xl border ${borderColor} bg-card shadow-card overflow-hidden`}>
                        {title && (
                          <div className={`flex items-center justify-between px-4 py-2.5 border-b ${headerColor}`}>
                            <span className="text-xs font-bold text-foreground">{title}</span>
                            <Button variant="ghost" size="sm" onClick={() => copySection(section)} className="h-7 gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                              <Copy className="h-3 w-3" /> Copiar
                            </Button>
                          </div>
                        )}
                        <div className="p-4 prose prose-sm max-w-none text-foreground prose-p:my-1.5 prose-strong:text-foreground prose-headings:font-display leading-relaxed">
                          <ReactMarkdown>{body}</ReactMarkdown>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="mt-6 text-center">
                  <Button variant="outline" onClick={reset} className="gap-2"><Sparkles className="h-4 w-4" /> Nova consulta</Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
