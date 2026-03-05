import { useState } from "react";
import { MessageSquare, PhoneCall, RefreshCw, ShieldQuestion, MapPin, Sparkles, Copy, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import homiMascot from "@/assets/homi-mascot.png";

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
  "Lead novo",
  "Pediu mais informações",
  "Parou de responder",
  "Disse que vai pensar",
  "Disse que está caro",
  "Quer ver outras opções",
  "Pós visita",
  "Negociação",
];

const OBJETIVOS = [
  "Gerar visita",
  "Retomar conversa",
  "Qualificar cliente",
  "Enviar material",
];

export default function HomiAssistant() {
  const [step, setStep] = useState<"home" | "form" | "result">("home");
  const [acao, setAcao] = useState<Acao | null>(null);
  const [empreendimento, setEmpreendimento] = useState("");
  const [situacao, setSituacao] = useState("");
  const [mensagemCliente, setMensagemCliente] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [resultado, setResultado] = useState("");
  const [generating, setGenerating] = useState(false);

  const selectAcao = (a: Acao) => {
    setAcao(a);
    setStep("form");
  };

  const reset = () => {
    setStep("home");
    setAcao(null);
    setResultado("");
    setEmpreendimento("");
    setSituacao("");
    setMensagemCliente("");
    setObjetivo("");
  };

  const generate = async () => {
    if (!empreendimento || !situacao || !objetivo) {
      toast.error("Preencha empreendimento, situação e objetivo");
      return;
    }
    setGenerating(true);
    setResultado("");
    setStep("result");

    const { data, error } = await supabase.functions.invoke("homi-assistant", {
      body: { acao, empreendimento, situacao, mensagem_cliente: mensagemCliente, objetivo },
    });

    if (error) {
      toast.error("Erro ao gerar resposta");
      console.error(error);
      setStep("form");
    } else {
      setResultado(data?.content || "Sem resposta.");
    }
    setGenerating(false);
  };

  const copySection = (text: string) => {
    // Extract just the content after the heading
    const cleaned = text.replace(/^##\s*[^\n]+\n/, "").trim();
    navigator.clipboard.writeText(cleaned);
    toast.success("Copiado!");
  };

  const copyAll = () => {
    navigator.clipboard.writeText(resultado);
    toast.success("Tudo copiado!");
  };

  // Parse sections from resultado for individual copy
  const sections = resultado.split(/(?=## )/).filter(s => s.trim());

  const acaoInfo = ACOES.find(a => a.id === acao);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <AnimatePresence mode="wait">
        {/* HOME */}
        {step === "home" && (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Header */}
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="inline-block mb-4"
              >
                <img src={homiMascot} alt="HOMI" className="h-20 w-20 mx-auto rounded-2xl shadow-lg" />
              </motion.div>
              <h1 className="font-display text-2xl font-bold text-foreground mb-1">HOMI</h1>
              <p className="text-sm text-muted-foreground">
                Como posso te ajudar com esse lead?
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 gap-3">
              {ACOES.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.3 }}
                >
                  <button
                    onClick={() => selectAcao(a.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md hover:bg-primary/5 transition-all duration-200 group text-left"
                  >
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
          </motion.div>
        )}

        {/* FORM */}
        {step === "form" && (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
          >
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
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
                  <SelectContent>
                    {EMPREENDIMENTOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Situação do lead *</Label>
                <Select value={situacao} onValueChange={setSituacao}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {SITUACOES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Mensagem do cliente <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Textarea
                  placeholder='Ex: "vou pensar", "achei caro", "quero ver mais opções"...'
                  value={mensagemCliente}
                  onChange={e => setMensagemCliente(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Objetivo *</Label>
                <Select value={objetivo} onValueChange={setObjetivo}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {OBJETIVOS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={generate} disabled={generating} className="w-full gap-2 h-11 text-sm font-semibold">
                <Sparkles className="h-4 w-4" />
                Gerar Resposta
              </Button>
            </div>
          </motion.div>
        )}

        {/* RESULT */}
        {step === "result" && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <button
              onClick={() => setStep("form")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao formulário
            </button>

            {generating ? (
              <div className="rounded-xl border border-border bg-card shadow-card p-12 text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="inline-block mb-4"
                >
                  <Sparkles className="h-8 w-8 text-primary" />
                </motion.div>
                <p className="text-sm font-medium text-foreground mb-1">HOMI está pensando...</p>
                <p className="text-xs text-muted-foreground">Gerando a melhor resposta para seu lead</p>
              </div>
            ) : (
              <>
                {/* Toolbar */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-1">
                    <img src={homiMascot} alt="HOMI" className="h-7 w-7 rounded-lg" />
                    <span className="font-display font-bold text-sm text-foreground">Resposta do HOMI</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyAll} className="gap-1.5 text-xs h-8">
                    <Copy className="h-3 w-3" /> Copiar tudo
                  </Button>
                  <Button variant="outline" size="sm" onClick={generate} className="gap-1.5 text-xs h-8">
                    <RefreshCw className="h-3 w-3" /> Nova versão
                  </Button>
                </div>

                {/* Sections */}
                <div className="space-y-3">
                  {sections.map((section, i) => {
                    // Extract title
                    const titleMatch = section.match(/^##\s*(.+)/);
                    const title = titleMatch ? titleMatch[1].trim() : "";
                    const body = section.replace(/^##\s*[^\n]+\n/, "").trim();

                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="rounded-xl border border-border bg-card shadow-card overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
                          <span className="text-xs font-bold text-foreground">{title}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copySection(section)}
                            className="h-7 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" /> Copiar
                          </Button>
                        </div>
                        <div className="p-4 prose prose-sm max-w-none text-foreground prose-p:my-1 prose-headings:font-display">
                          <ReactMarkdown>{body}</ReactMarkdown>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* New query */}
                <div className="mt-6 text-center">
                  <Button variant="outline" onClick={reset} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Nova consulta
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
