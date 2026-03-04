import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Copy, Save, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

const SITUACOES = [
  "Visitou e não retornou",
  "Pediu material",
  "Parou de responder",
  "Disse que iria pensar",
  "Demonstrou interesse mas sumiu",
  "Lead antigo",
  "Pediu valor e não respondeu",
];

const TONS = [
  "Consultivo",
  "Amigável",
  "Reativação",
  "Oferta",
  "Urgência leve",
];

const OBJETIVOS = [
  "Marcar visita",
  "Retomar conversa",
  "Reengajar lead",
  "Enviar novidade",
  "Entender momento do cliente",
];

export default function ScriptFollowUp() {
  const { user } = useAuth();
  const [empreendimento, setEmpreendimento] = useState("");
  const [situacao, setSituacao] = useState("");
  const [tom, setTom] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [resultado, setResultado] = useState("");
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!empreendimento || !situacao || !objetivo) {
      toast.error("Preencha empreendimento, situação e objetivo");
      return;
    }
    setGenerating(true);
    setResultado("");

    const { data, error } = await supabase.functions.invoke("generate-script", {
      body: {
        tipo: "followup",
        empreendimento,
        situacao_lead: situacao,
        tom,
        objetivo,
      },
    });

    if (error) { toast.error("Erro ao gerar follow-up"); console.error(error); }
    else setResultado(data?.content || "Sem resposta.");
    setGenerating(false);
  };

  const copyAll = () => {
    navigator.clipboard.writeText(resultado);
    toast.success("Todas as mensagens copiadas!");
  };

  const saveScript = async () => {
    if (!user || !resultado) return;
    const { error } = await supabase.from("saved_scripts").insert({
      user_id: user.id,
      tipo: "followup",
      empreendimento,
      tipo_abordagem: tom,
      situacao_lead: situacao,
      objetivo,
      conteudo: resultado,
      titulo: `Follow-up ${empreendimento} - ${situacao}`,
    });
    if (error) { toast.error("Erro ao salvar"); console.error(error); }
    else toast.success("Follow-up salvo na biblioteca!");
  };

  // Extract individual messages for copy buttons
  const messages = resultado.split(/##\s*💬\s*Mensagem\s*\d+/i).filter(m => m.trim()).slice(0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
          <h3 className="font-display font-semibold text-sm">Configuração do Follow Up</h3>

          <div className="space-y-2">
            <Label className="text-xs">Empreendimento *</Label>
            <Input placeholder="Ex: Casa Tua, Alto Lindóia..." value={empreendimento} onChange={e => setEmpreendimento(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Situação do lead *</Label>
            <Select value={situacao} onValueChange={setSituacao}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {SITUACOES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Tom da mensagem</Label>
            <Select value={tom} onValueChange={setTom}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {TONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Objetivo *</Label>
            <Select value={objetivo} onValueChange={setObjetivo}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {OBJETIVOS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={generate} disabled={generating} className="w-full gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar Follow Up com IA
          </Button>
        </div>
      </div>

      {/* Result */}
      <div className="space-y-3">
        {generating && (
          <div className="rounded-xl border border-border bg-card shadow-card p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Gerando mensagens de follow-up...</p>
          </div>
        )}

        {resultado && !generating && (
          <div className="rounded-xl border border-border bg-card shadow-card">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <h3 className="font-display font-semibold text-sm flex-1">Follow Ups Gerados</h3>
              <Button variant="outline" size="sm" onClick={copyAll} className="gap-1.5 text-xs h-7">
                <Copy className="h-3 w-3" /> Copiar todas
              </Button>
              <Button variant="outline" size="sm" onClick={saveScript} className="gap-1.5 text-xs h-7">
                <Save className="h-3 w-3" /> Salvar
              </Button>
              <Button variant="outline" size="sm" onClick={generate} className="gap-1.5 text-xs h-7">
                <RefreshCw className="h-3 w-3" /> Nova versão
              </Button>
            </div>
            <div className="p-4 prose prose-sm max-w-none text-foreground prose-headings:font-display prose-headings:text-foreground prose-strong:text-foreground">
              <ReactMarkdown>{resultado}</ReactMarkdown>
            </div>
          </div>
        )}

        {!resultado && !generating && (
          <div className="rounded-xl border border-border bg-card shadow-card p-8 text-center">
            <div className="text-4xl mb-3">💬</div>
            <h3 className="font-display font-semibold text-foreground mb-1">Follow Up WhatsApp</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Preencha os campos ao lado e clique em "Gerar Follow Up" para criar 3 variações de mensagem com IA.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
