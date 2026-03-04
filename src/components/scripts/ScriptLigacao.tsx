import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Copy, Save, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

const SITUACOES = [
  "Lead pediu informações",
  "Lead respondeu anúncio",
  "Lead antigo que não respondeu",
  "Lead que demonstrou interesse mas sumiu",
  "Lead que pediu valor",
  "Lead que pediu material",
  "Lead que parou de responder",
];

const OBJETIVOS = [
  "Marcar visita",
  "Retomar conversa",
  "Qualificar cliente",
  "Entender interesse",
  "Converter para visita",
];

export default function ScriptLigacao() {
  const { user } = useAuth();
  const [empreendimento, setEmpreendimento] = useState("");
  const [tipoEmpreendimento, setTipoEmpreendimento] = useState("");
  const [diferenciais, setDiferenciais] = useState("");
  const [situacao, setSituacao] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [promptPersonalizado, setPromptPersonalizado] = useState("");
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
        tipo: "ligacao",
        empreendimento,
        tipo_empreendimento: tipoEmpreendimento,
        diferenciais,
        situacao_lead: situacao,
        objetivo,
        prompt_personalizado: promptPersonalizado,
      },
    });

    if (error) { toast.error("Erro ao gerar script"); console.error(error); }
    else setResultado(data?.content || "Sem resposta.");
    setGenerating(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(resultado);
    toast.success("Script copiado!");
  };

  const saveScript = async () => {
    if (!user || !resultado) return;
    const { error } = await supabase.from("saved_scripts").insert({
      user_id: user.id,
      tipo: "ligacao",
      empreendimento,
      tipo_abordagem: tipoEmpreendimento,
      situacao_lead: situacao,
      objetivo,
      conteudo: resultado,
      titulo: `Script ${empreendimento} - ${situacao}`,
    });
    if (error) { toast.error("Erro ao salvar"); console.error(error); }
    else toast.success("Script salvo na biblioteca!");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
          <h3 className="font-display font-semibold text-sm">Configuração do Script</h3>

          <div className="space-y-2">
            <Label className="text-xs">Empreendimento *</Label>
            <Input placeholder="Ex: Casa Tua, Alto Lindóia, Open Bosque..." value={empreendimento} onChange={e => setEmpreendimento(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Tipo do empreendimento</Label>
            <Select value={tipoEmpreendimento} onValueChange={setTipoEmpreendimento}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="casas em condomínio">Casas em condomínio</SelectItem>
                <SelectItem value="apartamentos">Apartamentos</SelectItem>
                <SelectItem value="alto padrão">Alto padrão</SelectItem>
                <SelectItem value="investimento">Investimento</SelectItem>
                <SelectItem value="compactos">Compactos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Diferenciais principais</Label>
            <Textarea placeholder="Ex: infraestrutura de clube, localização estratégica, parcelamento direto..." value={diferenciais} onChange={e => setDiferenciais(e.target.value)} rows={3} />
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
            <Label className="text-xs">Objetivo da ligação *</Label>
            <Select value={objetivo} onValueChange={setObjetivo}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {OBJETIVOS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Instruções personalizadas para a IA</Label>
            <Textarea
              placeholder="Ex: quero um script mais objetivo e direto, sem enrolação. Foque em gerar urgência. Use linguagem jovem..."
              value={promptPersonalizado}
              onChange={e => setPromptPersonalizado(e.target.value)}
              rows={3}
              className="text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Opcional — descreva como quer o resultado: mais curto, mais dinâmico, com urgência, etc.</p>
          </div>

          <Button onClick={generate} disabled={generating} className="w-full gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar Script com IA
          </Button>
        </div>
      </div>

      {/* Result */}
      <div className="space-y-3">
        {generating && (
          <div className="rounded-xl border border-border bg-card shadow-card p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Gerando script de alta conversão...</p>
          </div>
        )}

        {resultado && !generating && (
          <div className="rounded-xl border border-border bg-card shadow-card">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <h3 className="font-display font-semibold text-sm flex-1">Script Gerado</h3>
              <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-1.5 text-xs h-7">
                <Copy className="h-3 w-3" /> Copiar
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
            <div className="text-4xl mb-3">📞</div>
            <h3 className="font-display font-semibold text-foreground mb-1">Script de Ligação</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Preencha os campos ao lado e clique em "Gerar Script" para criar um roteiro de ligação personalizado com IA.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
