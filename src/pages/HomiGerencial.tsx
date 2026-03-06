import { useState } from "react";
import {
  MessageSquare, PhoneCall, RefreshCw, ShieldQuestion, Megaphone,
  Sparkles, Copy, ArrowLeft, MessageCircle, Clock, Users, FileEdit,
  Send, Zap, CalendarDays, Target,
} from "lucide-react";
import HomiChat from "@/components/homi/HomiChat";
import HomiHistory from "@/components/homi/HomiHistory";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
const homiMascot = "/images/homi-mascot-opt.png";

type AcaoGerente =
  | "gerar_script_time"
  | "gerar_whatsapp"
  | "quebrar_objecao"
  | "comunicacao_time"
  | "preparar_campanha";

const ACOES: { id: AcaoGerente; label: string; icon: typeof MessageSquare; description: string }[] = [
  { id: "gerar_script_time", label: "Gerar Script p/ Time", icon: FileEdit, description: "Crie roteiros de ligação, WhatsApp ou follow-up" },
  { id: "gerar_whatsapp", label: "Mensagem WhatsApp", icon: MessageSquare, description: "Curta, reativação, pós-visita, evento" },
  { id: "quebrar_objecao", label: "Quebrar Objeção", icon: ShieldQuestion, description: "Preço, prazo, localização, concorrência" },
  { id: "comunicacao_time", label: "Comunicação p/ Time", icon: Megaphone, description: "Script do dia, abordagem de campanha" },
  { id: "preparar_campanha", label: "Preparar Campanha", icon: Target, description: "Sequência de ligação e materiais" },
];

const EMPREENDIMENTOS = [
  "Casa Tua", "Open Bosque", "Melnick Day", "Alto Lindóia",
  "Orygem", "Casa Bastian", "Shift", "Lake Eyre", "Las Casas",
  "Lév", "Supreme Altos CP", "Terrace", "Grand Park Lindóia",
  "High Garden Rio Branco", "Go Rio Branco", "Botanique",
  "Skyline Menino Deus", "Square Garden", "Duetto - Morana",
  "Demétrio ABF", "Ora Studios do Cais",
];

const TIPO_SCRIPT = [
  "Ligação", "WhatsApp", "Follow-up", "Reativação", "Pós-visita",
  "Convite evento", "Objeção", "E-mail",
];

const OBJETIVOS_GERENTE = [
  "Gerar visitas", "Retomar conversa", "Qualificar cliente",
  "Reativar lead frio", "Preparar para evento", "Aquecer lead",
  "Converter em proposta",
];

const TIPOS_OBJECAO = [
  "Preço / Valor alto", "Localização", "Prazo de obra",
  "Comparação com concorrência", "Entrada / Parcelas",
  "Financiamento", "Investidor vs Moradia", "Já comprou outro",
];

const TIPOS_WHATSAPP = [
  "Mensagem curta", "Reativação", "Follow-up", "Pós-visita",
  "Convite para evento", "Apresentação de produto",
];

type Step = "home" | "form" | "result" | "chat" | "history";

export default function HomiGerencial() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("home");
  const [acao, setAcao] = useState<AcaoGerente | null>(null);
  const [empreendimento, setEmpreendimento] = useState("");
  const [tipoScript, setTipoScript] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [contexto, setContexto] = useState("");
  const [tipoObjecao, setTipoObjecao] = useState("");
  const [tipoWhatsapp, setTipoWhatsapp] = useState("");
  const [campanha, setCampanha] = useState("");
  const [resultado, setResultado] = useState("");
  const [generating, setGenerating] = useState(false);

  const selectAcao = (a: AcaoGerente) => { setAcao(a); setStep("form"); };

  const reset = () => {
    setStep("home"); setAcao(null); setResultado("");
    setEmpreendimento(""); setTipoScript(""); setObjetivo("");
    setContexto(""); setTipoObjecao(""); setTipoWhatsapp("");
    setCampanha("");
  };

  const buildPrompt = (): string => {
    const base = `Você é o HOMI, assistente de gestão comercial da Uhome Sales.
Você está ajudando um GERENTE DE EQUIPE a criar materiais para seu time de corretores.
Responda de forma prática, operacional e direta. Use formatação markdown com seções claras.
Empreendimento: ${empreendimento || "Geral"}
${campanha ? `Campanha: ${campanha}` : ""}
${contexto ? `Contexto adicional: ${contexto}` : ""}`;

    switch (acao) {
      case "gerar_script_time":
        return `${base}
Tipo de script: ${tipoScript}
Objetivo: ${objetivo}

Gere um script profissional para o time de corretores. Inclua:
## 📞 Script Completo
O script com abertura, desenvolvimento e fechamento.
Use {nome} e {empreendimento} como variáveis.

## 💬 Versão WhatsApp
Versão curta para WhatsApp (max 4 linhas, natural, terminando com pergunta).

## 🎯 Dica para o Gerente
Uma orientação sobre como treinar o time a usar esse script.`;

      case "gerar_whatsapp":
        return `${base}
Tipo de mensagem: ${tipoWhatsapp}
Objetivo: ${objetivo}

Gere mensagens de WhatsApp para o time usar. Inclua:
## 💬 Mensagem Principal
Versão natural, max 3-4 linhas, terminando com pergunta estratégica.

## 🔄 Variação 1
Outra versão com abordagem diferente.

## 🔄 Variação 2
Terceira versão mais direta.

## 📋 Orientação para o Time
Como e quando usar cada versão.`;

      case "quebrar_objecao":
        return `${base}
Objeção: ${tipoObjecao}

Gere material de quebra de objeção para o time. Inclua:
## 🧠 Análise da Objeção
Por que o cliente diz isso e o que significa.

## ✅ Resposta Principal
A melhor forma de contornar.

## 💬 Versão WhatsApp
Resposta natural para WhatsApp.

## 📞 Versão Ligação
Roteiro para usar na ligação.

## 🔄 Respostas Alternativas
2-3 variações de resposta.

## 🎯 Dica para o Gerente
Como treinar o time nessa objeção.`;

      case "comunicacao_time":
        return `${base}
Objetivo: ${objetivo}
${tipoScript ? `Tipo: ${tipoScript}` : ""}

Gere uma comunicação para o gerente enviar ao time. Inclua:
## 📢 Mensagem para o Time
Texto motivacional e operacional.

## 📋 Script do Dia
O roteiro de abordagem principal.

## 🎯 Foco do Dia
O que priorizar nas ligações/contatos.

## 💡 Dica Rápida
Uma técnica ou insight para melhorar conversão.`;

      case "preparar_campanha":
        return `${base}
Campanha: ${campanha || "Campanha geral"}
Objetivo: ${objetivo}

Prepare material completo de campanha. Inclua:
## 📋 Script de Ligação
Roteiro completo para campanha.

## 💬 Sequência de WhatsApp
3 mensagens em sequência (dia 1, dia 3, dia 7).

## 🎯 Argumentos-Chave
Top 5 argumentos de venda para essa campanha.

## ⚡ Gatilhos de Urgência
Frases e técnicas de urgência.

## 📊 Dica de Gestão
Como o gerente deve orientar o time.`;

      default:
        return base;
    }
  };

  const generate = async () => {
    if (!empreendimento && acao !== "comunicacao_time") {
      toast.error("Selecione o empreendimento");
      return;
    }
    setGenerating(true); setResultado(""); setStep("result");

    const { data, error } = await supabase.functions.invoke("homi-assistant", {
      body: {
        acao: acao,
        empreendimento: empreendimento || "Geral",
        situacao: tipoScript || tipoObjecao || tipoWhatsapp || "Gestão",
        mensagem_cliente: contexto,
        objetivo: objetivo || "Apoiar o time",
        role: "gerente",
      },
    });

    if (error) {
      toast.error("Erro ao gerar resposta");
      console.error(error);
      setStep("form");
    } else {
      const content = data?.content || "Sem resposta.";
      setResultado(content);

      if (user) {
        const titulo = `[Gerente] ${ACOES.find(a => a.id === acao)?.label} · ${empreendimento || "Geral"}`;
        supabase.from("homi_conversations").insert({
          user_id: user.id,
          tipo: "acao",
          acao: acao,
          empreendimento: empreendimento || null,
          situacao: tipoScript || tipoObjecao || tipoWhatsapp || null,
          objetivo,
          titulo,
          resultado: content,
        } as any).then(({ error: e }) => { if (e) console.error(e); });
      }
    }
    setGenerating(false);
  };

  const saveAsTeamScript = async () => {
    if (!user || !resultado) return;
    // Extract main script text from the result
    const scriptText = resultado;
    const titulo = `${ACOES.find(a => a.id === acao)?.label} - ${empreendimento || "Geral"}`;

    const { error } = await supabase.from("team_scripts").insert({
      gerente_id: user.id,
      titulo,
      empreendimento: empreendimento || "Geral",
      campanha: campanha || null,
      script_ligacao: scriptText,
      script_whatsapp: null,
      script_email: null,
      ativo: true,
    } as any);

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("✅ Script publicado para o time!");
      queryClient.invalidateQueries({ queryKey: ["team-scripts"] });
    }
  };

  const copyAll = () => { navigator.clipboard.writeText(resultado); toast.success("Tudo copiado!"); };

  const copySection = (text: string) => {
    const cleaned = text.replace(/^##\s*[^\n]+\n/, "").trim();
    navigator.clipboard.writeText(cleaned);
    toast.success("Copiado!");
  };

  const rawSections = resultado.split(/(?=## )/).filter(s => s.trim());
  const sections = rawSections.map((s, i) => {
    if (i === 0 && !s.startsWith("## ")) return `## 🧠 Análise\n${s}`;
    return s;
  });

  const acaoInfo = ACOES.find(a => a.id === acao);

  const renderForm = () => {
    switch (acao) {
      case "gerar_script_time":
        return (
          <>
            <FormField label="Empreendimento *">
              <SelectField value={empreendimento} onChange={setEmpreendimento} items={EMPREENDIMENTOS} placeholder="Selecione..." />
            </FormField>
            <FormField label="Tipo de script *">
              <SelectField value={tipoScript} onChange={setTipoScript} items={TIPO_SCRIPT} placeholder="Selecione..." />
            </FormField>
            <FormField label="Objetivo *">
              <SelectField value={objetivo} onChange={setObjetivo} items={OBJETIVOS_GERENTE} placeholder="Selecione..." />
            </FormField>
            <FormField label="Campanha (opcional)">
              <Input value={campanha} onChange={e => setCampanha(e.target.value)} placeholder="Ex: Melnick Day, Meta Ads Março" className="text-sm" />
            </FormField>
            <FormField label="Contexto adicional (opcional)">
              <Textarea value={contexto} onChange={e => setContexto(e.target.value)} rows={2} placeholder="Detalhes extras..." className="text-sm" />
            </FormField>
          </>
        );

      case "gerar_whatsapp":
        return (
          <>
            <FormField label="Empreendimento *">
              <SelectField value={empreendimento} onChange={setEmpreendimento} items={EMPREENDIMENTOS} placeholder="Selecione..." />
            </FormField>
            <FormField label="Tipo de mensagem *">
              <SelectField value={tipoWhatsapp} onChange={setTipoWhatsapp} items={TIPOS_WHATSAPP} placeholder="Selecione..." />
            </FormField>
            <FormField label="Objetivo *">
              <SelectField value={objetivo} onChange={setObjetivo} items={OBJETIVOS_GERENTE} placeholder="Selecione..." />
            </FormField>
            <FormField label="Contexto (opcional)">
              <Textarea value={contexto} onChange={e => setContexto(e.target.value)} rows={2} placeholder="Detalhes extras..." className="text-sm" />
            </FormField>
          </>
        );

      case "quebrar_objecao":
        return (
          <>
            <FormField label="Empreendimento *">
              <SelectField value={empreendimento} onChange={setEmpreendimento} items={EMPREENDIMENTOS} placeholder="Selecione..." />
            </FormField>
            <FormField label="Tipo de objeção *">
              <SelectField value={tipoObjecao} onChange={setTipoObjecao} items={TIPOS_OBJECAO} placeholder="Selecione..." />
            </FormField>
            <FormField label="Contexto (opcional)">
              <Textarea value={contexto} onChange={e => setContexto(e.target.value)} rows={2} placeholder='Ex: "Cliente comparou com o empreendimento X"' className="text-sm" />
            </FormField>
          </>
        );

      case "comunicacao_time":
        return (
          <>
            <FormField label="Empreendimento (opcional)">
              <SelectField value={empreendimento} onChange={setEmpreendimento} items={EMPREENDIMENTOS} placeholder="Geral" />
            </FormField>
            <FormField label="Tipo">
              <SelectField value={tipoScript} onChange={setTipoScript} items={["Script do dia", "Texto de evento", "Abordagem de campanha", "Motivacional"]} placeholder="Selecione..." />
            </FormField>
            <FormField label="Objetivo *">
              <SelectField value={objetivo} onChange={setObjetivo} items={OBJETIVOS_GERENTE} placeholder="Selecione..." />
            </FormField>
            <FormField label="Contexto (opcional)">
              <Textarea value={contexto} onChange={e => setContexto(e.target.value)} rows={2} placeholder="Detalhes..." className="text-sm" />
            </FormField>
          </>
        );

      case "preparar_campanha":
        return (
          <>
            <FormField label="Empreendimento *">
              <SelectField value={empreendimento} onChange={setEmpreendimento} items={EMPREENDIMENTOS} placeholder="Selecione..." />
            </FormField>
            <FormField label="Nome da campanha *">
              <Input value={campanha} onChange={e => setCampanha(e.target.value)} placeholder="Ex: Melnick Day 2026" className="text-sm" />
            </FormField>
            <FormField label="Objetivo *">
              <SelectField value={objetivo} onChange={setObjetivo} items={OBJETIVOS_GERENTE} placeholder="Selecione..." />
            </FormField>
            <FormField label="Contexto (opcional)">
              <Textarea value={contexto} onChange={e => setContexto(e.target.value)} rows={2} placeholder="Detalhes da campanha..." className="text-sm" />
            </FormField>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`max-w-2xl mx-auto ${step === "chat" ? "" : "px-4 py-6"}`}>
      <AnimatePresence mode="wait">
        {step === "home" && (
          <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            <div className="text-center mb-8">
              <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }} className="inline-block mb-4">
                <img src={homiMascot} alt="HOMI" className="h-20 w-20 mx-auto rounded-2xl shadow-lg" />
              </motion.div>
              <h1 className="font-display text-2xl font-bold text-foreground mb-1">HOMI Gerencial</h1>
              <p className="text-sm text-muted-foreground">Crie materiais e scripts para apoiar seu time</p>
              <Badge variant="secondary" className="mt-2 gap-1 text-xs">
                <Users className="h-3 w-3" /> Visão do Gerente
              </Badge>
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

            <div className="mt-4 grid grid-cols-2 gap-3">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: ACOES.length * 0.07, duration: 0.3 }}>
                <button onClick={() => setStep("chat")}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:border-primary/60 hover:shadow-md hover:bg-primary/10 transition-all duration-200 group text-left">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
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

        {step === "chat" && (
          <motion.div key="chat" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }} className="h-full">
            <HomiChat onBack={reset} />
          </motion.div>
        )}

        {step === "history" && (
          <motion.div key="history" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}>
            <HomiHistory onBack={reset} />
          </motion.div>
        )}

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
              {renderForm()}
              <Button onClick={generate} disabled={generating} className="w-full gap-2 h-11 text-sm font-semibold">
                <Sparkles className="h-4 w-4" /> Gerar Material
              </Button>
            </div>
          </motion.div>
        )}

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
                <p className="text-sm font-medium text-foreground mb-1">HOMI está preparando...</p>
                <p className="text-xs text-muted-foreground">Gerando material para seu time</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-1">
                    <img src={homiMascot} alt="HOMI" className="h-7 w-7 rounded-lg" />
                    <span className="font-display font-bold text-sm text-foreground">Material do HOMI</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyAll} className="gap-1.5 text-xs h-8"><Copy className="h-3 w-3" /> Copiar tudo</Button>
                  <Button variant="outline" size="sm" onClick={generate} className="gap-1.5 text-xs h-8"><RefreshCw className="h-3 w-3" /> Nova versão</Button>
                  <Button size="sm" onClick={saveAsTeamScript} className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700">
                    <Send className="h-3 w-3" /> Publicar p/ Time
                  </Button>
                </div>
                <div className="space-y-3">
                  {sections.map((section, i) => {
                    const titleMatch = section.match(/^##\s*(.+)/);
                    const title = titleMatch ? titleMatch[1].trim() : "";
                    const body = section.replace(/^##\s*[^\n]+\n/, "").trim();
                    if (!body) return null;
                    const isWhatsApp = title.includes("💬") || title.toLowerCase().includes("whatsapp");
                    const isScript = title.includes("📞") || title.includes("📋") || title.toLowerCase().includes("script");
                    const isAction = title.includes("🎯") || title.toLowerCase().includes("dica");
                    const isAnalysis = title.includes("🧠") || title.toLowerCase().includes("anális");
                    const borderColor = isWhatsApp ? "border-emerald-500/20" : isScript ? "border-amber-500/20" : isAction ? "border-primary/20" : isAnalysis ? "border-violet-500/20" : "border-border";
                    const headerColor = isWhatsApp ? "bg-emerald-500/10 border-emerald-500/20" : isScript ? "bg-amber-500/10 border-amber-500/20" : isAction ? "bg-primary/10 border-primary/20" : isAnalysis ? "bg-violet-500/10 border-violet-500/20" : "bg-muted/30 border-border";
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

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      {children}
    </div>
  );
}

function SelectField({ value, onChange, items, placeholder }: {
  value: string; onChange: (v: string) => void; items: string[]; placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{items.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
    </Select>
  );
}
