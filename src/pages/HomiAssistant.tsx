import { useState } from "react";
import { MessageSquare, PhoneCall, RefreshCw, ShieldQuestion, MapPin, Sparkles, Copy, ArrowLeft, MessageCircle, Clock, ArrowRight } from "lucide-react";
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
const homiMascot = "/images/homi-mascot-official.png";

type Acao = "responder_whatsapp" | "criar_followup" | "script_ligacao" | "quebrar_objecao" | "preparar_visita";

const ACOES: { id: Acao; label: string; icon: typeof MessageSquare; description: string; iconBg: string; iconColor: string }[] = [
  { id: "responder_whatsapp", label: "Responder WhatsApp", icon: MessageSquare, description: "Crie a resposta perfeita", iconBg: "bg-green-50", iconColor: "text-green-500" },
  { id: "criar_followup", label: "Criar Follow Up", icon: RefreshCw, description: "Retome a conversa", iconBg: "bg-blue-50", iconColor: "text-blue-500" },
  { id: "script_ligacao", label: "Script de Ligação", icon: PhoneCall, description: "Roteiro para ligar", iconBg: "bg-orange-50", iconColor: "text-orange-500" },
  { id: "quebrar_objecao", label: "Quebrar Objeção", icon: ShieldQuestion, description: "Contorne resistências", iconBg: "bg-purple-50", iconColor: "text-purple-500" },
  { id: "preparar_visita", label: "Preparar Visita", icon: MapPin, description: "Conduza para a visita", iconBg: "bg-amber-50", iconColor: "text-amber-500" },
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

const BADGES = [
  { emoji: "🧠", label: "RAG Ativo" },
  { emoji: "⚡", label: "Gemini AI" },
  { emoji: "📚", label: "Base Uhome" },
];

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
            {/* Avatar Section */}
            <div className="text-center mb-8 pt-4">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="inline-block mb-5"
              >
                <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
                  {/* Rotating energy ring */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full"
                    style={{
                      border: "2px solid rgba(59,130,246,0.2)",
                      background: "conic-gradient(transparent 0deg, rgba(59,130,246,0.4) 90deg, transparent 180deg, rgba(34,197,94,0.4) 270deg, transparent 360deg)",
                    }}
                  />
                  {/* Inner white circle with avatar */}
                  <motion.div
                    animate={{ y: [-6, 0, -6] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="relative rounded-full bg-white flex items-center justify-center z-10"
                    style={{
                      width: 100,
                      height: 100,
                      boxShadow: "0 0 40px rgba(59,130,246,0.2), 0 0 80px rgba(59,130,246,0.1)",
                    }}
                  >
                    <img src={homiMascot} alt="HOMI" className="h-16 w-16 rounded-full object-cover" />
                  </motion.div>
                </div>
              </motion.div>

              {/* Title */}
              <h1
                className="font-black tracking-[0.05em]"
                style={{
                  fontSize: 48,
                  background: "linear-gradient(135deg, #2563EB, #3B82F6, #06B6D4)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                HOMI
              </h1>
              <p className="text-gray-400 font-medium mt-1" style={{ fontSize: 16, letterSpacing: "0.1em" }}>
                Superinteligência Imobiliária
              </p>

              {/* Capability badges */}
              <div className="flex items-center justify-center gap-2 mt-4">
                {BADGES.map((b) => (
                  <span
                    key={b.label}
                    className="text-blue-500 font-medium"
                    style={{
                      fontSize: 12,
                      background: "rgba(59,130,246,0.06)",
                      border: "1px solid rgba(59,130,246,0.15)",
                      borderRadius: 999,
                      padding: "4px 12px",
                    }}
                  >
                    {b.emoji} {b.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Module Cards — 2 columns */}
            <div className="grid grid-cols-2 gap-3">
              {ACOES.map((a, i) => (
                <motion.div key={a.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.3 }}>
                  <button
                    onClick={() => selectAcao(a.id)}
                    className="w-full text-left p-5 group"
                    style={{
                      borderRadius: 16,
                      border: "1px solid rgba(0,0,0,0.06)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      transition: "all 0.25s ease",
                      background: "#fff",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 8px 24px rgba(59,130,246,0.12)";
                      e.currentTarget.style.borderColor = "rgba(59,130,246,0.2)";
                      e.currentTarget.style.transform = "translateY(-3px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
                      e.currentTarget.style.borderColor = "rgba(0,0,0,0.06)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div
                      className={`flex items-center justify-center rounded-full mb-3 ${a.iconBg} ${a.iconColor}`}
                      style={{ width: 44, height: 44 }}
                    >
                      <a.icon className="h-5 w-5" />
                    </div>
                    <p className="font-semibold text-gray-800" style={{ fontSize: 15 }}>{a.label}</p>
                    <p className="text-gray-400" style={{ fontSize: 13 }}>{a.description}</p>
                  </button>
                </motion.div>
              ))}

              {/* Histórico card */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ACOES.length * 0.06, duration: 0.3 }}>
                <button
                  onClick={() => setStep("history")}
                  className="w-full text-left p-5 group"
                  style={{
                    borderRadius: 16,
                    border: "1px solid rgba(0,0,0,0.06)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    transition: "all 0.25s ease",
                    background: "#fff",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(59,130,246,0.12)";
                    e.currentTarget.style.borderColor = "rgba(59,130,246,0.2)";
                    e.currentTarget.style.transform = "translateY(-3px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
                    e.currentTarget.style.borderColor = "rgba(0,0,0,0.06)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-full mb-3 bg-gray-50 text-gray-500"
                    style={{ width: 44, height: 44 }}
                  >
                    <Clock className="h-5 w-5" />
                  </div>
                  <p className="font-semibold text-gray-800" style={{ fontSize: 15 }}>Histórico</p>
                  <p className="text-gray-400" style={{ fontSize: 13 }}>Consultas anteriores</p>
                </button>
              </motion.div>
            </div>

            {/* Separator */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px" style={{ background: "rgba(0,0,0,0.05)" }} />
              <span className="text-gray-300" style={{ fontSize: 12 }}>ou converse livremente</span>
              <div className="flex-1 h-px" style={{ background: "rgba(0,0,0,0.05)" }} />
            </div>

            {/* Chat Livre — full width special card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (ACOES.length + 1) * 0.06, duration: 0.3 }}>
              <button
                onClick={() => setStep("chat")}
                className="w-full flex items-center gap-4 p-5 text-left"
                style={{
                  borderRadius: 16,
                  background: "linear-gradient(135deg, #EFF6FF, #F0F9FF)",
                  border: "1px solid rgba(59,130,246,0.2)",
                  transition: "all 0.25s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(59,130,246,0.15)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div
                  className="flex items-center justify-center rounded-full bg-blue-500 text-white shrink-0"
                  style={{ width: 44, height: 44 }}
                >
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-blue-700" style={{ fontSize: 16 }}>💬 Chat Livre com o HOMI</p>
                  <p className="text-blue-400" style={{ fontSize: 14 }}>Converse sobre qualquer lead ou situação</p>
                </div>
                <ArrowRight className="h-5 w-5 text-blue-400 shrink-0" />
              </button>
            </motion.div>
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
                <div className={`flex items-center justify-center rounded-full ${acaoInfo.iconBg} ${acaoInfo.iconColor}`} style={{ width: 44, height: 44 }}>
                  <acaoInfo.icon className="h-5 w-5" />
                </div>
              )}
              <div>
                <h2 className="font-display font-bold text-lg text-foreground">{acaoInfo?.label}</h2>
                <p className="text-xs text-muted-foreground">{acaoInfo?.description}</p>
              </div>
            </div>
            <div className="space-y-4" style={{ borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: 20, background: "#fff" }}>
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
              <div className="p-12 text-center" style={{ borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", background: "#fff" }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="inline-block mb-4">
                  <Sparkles className="h-8 w-8 text-blue-500" />
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
                        className={`overflow-hidden`}
                        style={{ borderRadius: 16, border: `1px solid`, borderColor: isWhatsApp ? "rgba(16,185,129,0.2)" : isAlternative ? "rgba(59,130,246,0.2)" : isScript ? "rgba(245,158,11,0.2)" : isAction ? "rgba(59,130,246,0.2)" : isAnalysis ? "rgba(139,92,246,0.2)" : "rgba(0,0,0,0.06)", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                      >
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
