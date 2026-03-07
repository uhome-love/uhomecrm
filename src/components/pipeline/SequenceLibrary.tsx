import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Rocket, Home, CalendarCheck, DollarSign, RefreshCw, Ghost, Sparkles, ArrowDown, MessageSquare, FileText, Clock, Bot } from "lucide-react";

interface SequenceTemplate {
  id: string;
  icon: any;
  nome: string;
  descricao: string;
  stage_gatilho: string;
  passos: { dias_apos_inicio: number; tipo: string; titulo: string; conteudo: string; canal: string }[];
}

const TEMPLATES: SequenceTemplate[] = [
  {
    id: "novo_lead",
    icon: Rocket,
    nome: "🚀 Novo Lead — Primeira abordagem",
    descricao: "Sequência de 4 dias para primeiro contato com lead novo",
    stage_gatilho: "novo_lead",
    passos: [
      { dias_apos_inicio: 0, tipo: "mensagem", titulo: "Mensagem inicial de apresentação", conteudo: "Olá {{nome}}! Sou corretor da UHome e vi que você demonstrou interesse em {{empreendimento}}. Posso te ajudar com mais informações?", canal: "whatsapp" },
      { dias_apos_inicio: 1, tipo: "lembrete", titulo: "Follow-up de contato", conteudo: "{{nome}}, vi que ainda não conseguimos conversar. Posso te enviar um vídeo do {{empreendimento}} para você conhecer melhor?", canal: "whatsapp" },
      { dias_apos_inicio: 2, tipo: "material", titulo: "Envio de vídeo do empreendimento", conteudo: "Segue o vídeo institucional do {{empreendimento}} para você conhecer o projeto. Qualquer dúvida, estou à disposição!", canal: "whatsapp" },
      { dias_apos_inicio: 3, tipo: "mensagem", titulo: "Convite para visita", conteudo: "{{nome}}, que tal conhecer o {{empreendimento}} pessoalmente? Posso agendar uma visita no melhor horário para você!", canal: "whatsapp" },
    ],
  },
  {
    id: "aquecer_visita",
    icon: Home,
    nome: "🏠 Aquecer lead para visita",
    descricao: "Nutrição focada em gerar interesse para visita presencial",
    stage_gatilho: "possibilidade_visita",
    passos: [
      { dias_apos_inicio: 0, tipo: "mensagem", titulo: "Mensagem de interesse", conteudo: "{{nome}}, percebi que você está considerando o {{empreendimento}}. O que mais te chamou atenção no projeto?", canal: "whatsapp" },
      { dias_apos_inicio: 1, tipo: "material", titulo: "Vídeo do empreendimento", conteudo: "Preparei um material especial do {{empreendimento}} para você. Dá uma olhada e me conta o que achou!", canal: "whatsapp" },
      { dias_apos_inicio: 2, tipo: "mensagem", titulo: "Depoimento de cliente", conteudo: "{{nome}}, vou compartilhar o depoimento de um cliente que visitou o {{empreendimento}} recentemente. Vale a pena conferir!", canal: "whatsapp" },
      { dias_apos_inicio: 4, tipo: "mensagem", titulo: "Convite direto para visita", conteudo: "{{nome}}, tenho disponibilidade esta semana para te levar conhecer o {{empreendimento}}. Qual o melhor dia para você?", canal: "whatsapp" },
    ],
  },
  {
    id: "confirmar_visita",
    icon: CalendarCheck,
    nome: "📅 Confirmar visita",
    descricao: "Garantir que o cliente compareça à visita agendada",
    stage_gatilho: "visita_marcada",
    passos: [
      { dias_apos_inicio: 0, tipo: "mensagem", titulo: "Confirmação da visita", conteudo: "{{nome}}, sua visita ao {{empreendimento}} está confirmada! Estou te esperando. Qualquer imprevisto, me avise!", canal: "whatsapp" },
      { dias_apos_inicio: 0, tipo: "material", titulo: "Localização e detalhes", conteudo: "Segue a localização exata e os detalhes do que vamos ver na visita. Vai ser uma ótima experiência!", canal: "whatsapp" },
    ],
  },
  {
    id: "pos_visita",
    icon: DollarSign,
    nome: "💰 Negociação e fechamento",
    descricao: "Follow-up pós visita focado em fechar negócio",
    stage_gatilho: "visita_realizada",
    passos: [
      { dias_apos_inicio: 0, tipo: "mensagem", titulo: "Agradecimento pela visita", conteudo: "{{nome}}, obrigado pela visita ao {{empreendimento}}! O que achou do projeto? Alguma unidade te interessou mais?", canal: "whatsapp" },
      { dias_apos_inicio: 1, tipo: "material", titulo: "Condição especial", conteudo: "{{nome}}, temos uma condição especial de pagamento para o {{empreendimento}} que pode te interessar. Posso te detalhar?", canal: "whatsapp" },
      { dias_apos_inicio: 3, tipo: "mensagem", titulo: "Pergunta de decisão", conteudo: "{{nome}}, gostaria de saber como está sua decisão sobre o {{empreendimento}}. Posso ajudar em algo mais?", canal: "whatsapp" },
    ],
  },
  {
    id: "reativacao",
    icon: RefreshCw,
    nome: "♻ Reativar lead antigo",
    descricao: "Retomar contato com leads inativos há mais de 30 dias",
    stage_gatilho: "sem_contato",
    passos: [
      { dias_apos_inicio: 0, tipo: "mensagem", titulo: "Mensagem de retomada", conteudo: "{{nome}}, tudo bem? Faz um tempo que conversamos sobre imóveis. Surgiu algo novo que pode te interessar!", canal: "whatsapp" },
      { dias_apos_inicio: 3, tipo: "material", titulo: "Novidade do empreendimento", conteudo: "{{nome}}, temos novidades no {{empreendimento}}! Novas condições e unidades disponíveis. Quer saber mais?", canal: "whatsapp" },
      { dias_apos_inicio: 7, tipo: "mensagem", titulo: "Condições especiais", conteudo: "{{nome}}, condições especiais de entrada para o {{empreendimento}} por tempo limitado. Posso te passar os detalhes?", canal: "whatsapp" },
    ],
  },
  {
    id: "lead_sumiu",
    icon: Ghost,
    nome: "📉 Lead que sumiu",
    descricao: "Última tentativa de contato com lead que parou de responder",
    stage_gatilho: "contato_inicial",
    passos: [
      { dias_apos_inicio: 0, tipo: "mensagem", titulo: "Mensagem leve", conteudo: "{{nome}}, percebi que não conseguimos mais conversar. Está tudo bem? Se ainda tiver interesse, estou aqui!", canal: "whatsapp" },
      { dias_apos_inicio: 3, tipo: "mensagem", titulo: "Última tentativa", conteudo: "{{nome}}, essa é minha última mensagem para não te incomodar. Se um dia quiser retomar a conversa sobre imóveis, é só me chamar! 😊", canal: "whatsapp" },
    ],
  },
];

const STAGE_LABELS: Record<string, string> = {
  novo_lead: "Novo Lead",
  sem_contato: "Sem Contato",
  contato_inicial: "Contato Inicial",
  atendimento: "Atendimento",
  qualificacao: "Qualificação",
  possibilidade_visita: "Possibilidade de Visita",
  visita_marcada: "Visita Marcada",
  visita_realizada: "Visita Realizada",
  negociacao: "Negociação",
  proposta: "Proposta",
};

const TIPO_ICONS: Record<string, any> = {
  mensagem: MessageSquare,
  material: FileText,
  lembrete: Clock,
};

interface Props {
  onSequenceCreated?: () => void;
}

export default function SequenceLibrary({ onSequenceCreated }: Props) {
  const { user } = useAuth();
  const [previewTemplate, setPreviewTemplate] = useState<SequenceTemplate | null>(null);
  const [applying, setApplying] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customEmpreendimento, setCustomEmpreendimento] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiForm, setAiForm] = useState({ produto: "", etapa: "novo_lead", objetivo: "" });
  const [aiPreview, setAiPreview] = useState<SequenceTemplate | null>(null);

  const handleApplyTemplate = useCallback(async (template: SequenceTemplate) => {
    if (!user) return;
    setApplying(true);
    try {
      const nome = customName || template.nome.replace(/^[^\w]+ /, "");
      const { data: seq, error: seqErr } = await supabase
        .from("pipeline_sequencias")
        .insert({
          nome,
          descricao: template.descricao,
          empreendimento: customEmpreendimento || null,
          stage_gatilho: template.stage_gatilho,
          criado_por: user.id,
          ativa: true,
        })
        .select("id")
        .single();

      if (seqErr || !seq) throw seqErr;

      const passosToInsert = template.passos.map((p, idx) => ({
        sequencia_id: seq.id,
        ordem: idx,
        dias_apos_inicio: p.dias_apos_inicio,
        tipo: p.tipo,
        titulo: p.titulo,
        conteudo: customEmpreendimento
          ? p.conteudo.replace(/\{\{empreendimento\}\}/g, customEmpreendimento)
          : p.conteudo,
        canal: p.canal,
      }));

      const { error: passosErr } = await supabase
        .from("pipeline_sequencia_passos")
        .insert(passosToInsert);

      if (passosErr) throw passosErr;

      toast.success(`Sequência "${nome}" criada com ${template.passos.length} passos!`);
      setPreviewTemplate(null);
      setCustomName("");
      setCustomEmpreendimento("");
      onSequenceCreated?.();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aplicar sequência");
    } finally {
      setApplying(false);
    }
  }, [user, customName, customEmpreendimento, onSequenceCreated]);

  const handleAiGenerate = useCallback(async () => {
    if (!aiForm.produto || !aiForm.objetivo) {
      toast.error("Preencha produto e objetivo");
      return;
    }
    setAiGenerating(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-sequence`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(aiForm),
      });

      if (!resp.ok) {
        if (resp.status === 429) { toast.error("Limite de requisições excedido. Tente novamente em breve."); return; }
        if (resp.status === 402) { toast.error("Créditos insuficientes."); return; }
        throw new Error("Erro na geração");
      }

      const data = await resp.json();
      setAiPreview({
        id: "ai_generated",
        icon: Bot,
        nome: data.nome || `Sequência IA — ${aiForm.produto}`,
        descricao: data.descricao || `Gerada por IA para ${aiForm.objetivo}`,
        stage_gatilho: aiForm.etapa,
        passos: data.passos || [],
      });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar sequência com IA");
    } finally {
      setAiGenerating(false);
    }
  }, [aiForm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            📦 Biblioteca de Sequências
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aplique sequências prontas com um clique ou gere com IA
          </p>
        </div>
        <Button size="sm" onClick={() => setAiDialogOpen(true)} className="gap-1.5 text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          Criar com IA
        </Button>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TEMPLATES.map((t) => {
          const Icon = t.icon;
          return (
            <Card
              key={t.id}
              className="p-4 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group"
              onClick={() => { setPreviewTemplate(t); setCustomName(""); setCustomEmpreendimento(""); }}
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-foreground leading-tight">{t.nome}</h4>
                  <p className="text-[11px] text-muted-foreground mt-1">{t.descricao}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-[9px]">
                      {t.passos.length} passos
                    </Badge>
                    <Badge variant="outline" className="text-[9px]">
                      {STAGE_LABELS[t.stage_gatilho] || t.stage_gatilho}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Preview & Apply Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(o) => !o && setPreviewTemplate(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {previewTemplate?.nome}
            </DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">{previewTemplate.descricao}</p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Nome personalizado</Label>
                  <Input className="mt-1 text-xs" value={customName} onChange={e => setCustomName(e.target.value)} placeholder={previewTemplate.nome.replace(/^[^\w]+ /, "")} />
                </div>
                <div>
                  <Label className="text-[10px]">Empreendimento</Label>
                  <Input className="mt-1 text-xs" value={customEmpreendimento} onChange={e => setCustomEmpreendimento(e.target.value)} placeholder="Ex: Casa Tua" />
                </div>
              </div>

              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1">
                  {previewTemplate.passos.map((p, idx) => {
                    const TIcon = TIPO_ICONS[p.tipo] || MessageSquare;
                    return (
                      <div key={idx}>
                        <div className="flex items-start gap-3 p-2.5 rounded-lg border border-border bg-card">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <TIcon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground">{p.titulo}</span>
                              <Badge variant="secondary" className="text-[9px]">Dia {p.dias_apos_inicio}</Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{p.conteudo}</p>
                          </div>
                        </div>
                        {idx < previewTemplate.passos.length - 1 && (
                          <div className="flex justify-center py-0.5">
                            <ArrowDown className="h-3 w-3 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPreviewTemplate(null)}>Cancelar</Button>
            <Button size="sm" onClick={() => previewTemplate && handleApplyTemplate(previewTemplate)} disabled={applying}>
              {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Rocket className="h-3.5 w-3.5 mr-1.5" />}
              Aplicar Sequência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generation Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" /> Criar Sequência com IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[10px]">Produto / Empreendimento</Label>
              <Input className="mt-1 text-xs" value={aiForm.produto} onChange={e => setAiForm(p => ({ ...p, produto: e.target.value }))} placeholder="Ex: Casa Tua" />
            </div>
            <div>
              <Label className="text-[10px]">Etapa do Funil</Label>
              <select className="w-full mt-1 text-xs border rounded-md p-2 bg-background text-foreground" value={aiForm.etapa} onChange={e => setAiForm(p => ({ ...p, etapa: e.target.value }))}>
                {Object.entries(STAGE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Objetivo</Label>
              <Input className="mt-1 text-xs" value={aiForm.objetivo} onChange={e => setAiForm(p => ({ ...p, objetivo: e.target.value }))} placeholder="Ex: gerar visita, fechar venda, reativar lead" />
            </div>

            {!aiPreview && (
              <Button className="w-full gap-1.5 text-xs" onClick={handleAiGenerate} disabled={aiGenerating}>
                {aiGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {aiGenerating ? "Gerando sequência..." : "Gerar Sequência"}
              </Button>
            )}

            {aiPreview && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-foreground">{aiPreview.nome}</h4>
                  <Badge variant="secondary" className="text-[9px]">{aiPreview.passos.length} passos</Badge>
                </div>
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-1">
                    {aiPreview.passos.map((p, idx) => {
                      const TIcon = TIPO_ICONS[p.tipo] || MessageSquare;
                      return (
                        <div key={idx} className="flex items-start gap-2 p-2 rounded border border-border bg-card">
                          <TIcon className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold">{p.titulo}</span>
                              <Badge variant="secondary" className="text-[8px]">Dia {p.dias_apos_inicio}</Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground line-clamp-1">{p.conteudo}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setAiPreview(null)}>
                    Gerar outra
                  </Button>
                  <Button size="sm" className="flex-1 text-xs gap-1" onClick={() => {
                    setCustomEmpreendimento(aiForm.produto);
                    handleApplyTemplate(aiPreview);
                    setAiDialogOpen(false);
                    setAiPreview(null);
                  }} disabled={applying}>
                    {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
                    Aplicar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
