import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Rocket, Home, CalendarCheck, DollarSign, RefreshCw, Ghost, Sparkles, ArrowDown, MessageSquare, FileText, Clock, Bot, Phone, Plus, Trash2, Zap, Users, Search } from "lucide-react";

interface SequenceStep {
  dias_apos_inicio: number;
  tipo: string;
  titulo: string;
  conteudo: string;
  canal: string;
}

interface SequenceTemplate {
  id: string;
  icon: any;
  nome: string;
  descricao: string;
  stage_gatilho: string;
  passos: SequenceStep[];
}

interface PipelineLead {
  id: string;
  nome: string;
  empreendimento: string | null;
  telefone: string | null;
  stage_id: string;
}

const TEMPLATES: SequenceTemplate[] = [
  {
    id: "novo_lead",
    icon: Rocket,
    nome: "🚀 Novo Lead — Primeira abordagem",
    descricao: "Sequência de 4 passos para primeiro contato com lead novo",
    stage_gatilho: "novo_lead",
    passos: [
      { dias_apos_inicio: 0, tipo: "ligacao", titulo: "Ligar — contato inicial", conteudo: "Ligar para {{nome}} e apresentar o {{empreendimento}}. Objetivo: qualificar interesse e entender necessidade.", canal: "ligacao" },
      { dias_apos_inicio: 0, tipo: "mensagem", titulo: "WhatsApp se não atendeu", conteudo: "Olá {{nome}}! Tentei te ligar agora. Sou corretor da UHome e vi seu interesse no {{empreendimento}}. Posso te ajudar?", canal: "whatsapp" },
      { dias_apos_inicio: 1, tipo: "ligacao", titulo: "Segunda ligação", conteudo: "Segunda tentativa de contato com {{nome}}. Reforçar diferenciais do {{empreendimento}} e tentar agendar visita.", canal: "ligacao" },
      { dias_apos_inicio: 3, tipo: "mensagem", titulo: "WhatsApp de follow-up final", conteudo: "{{nome}}, tentei te ligar nos últimos dias sobre o {{empreendimento}}. Posso te enviar um vídeo do projeto para você conhecer melhor? 😊", canal: "whatsapp" },
    ],
  },
  {
    id: "aquecer_visita",
    icon: Home,
    nome: "🏠 Aquecer lead para visita",
    descricao: "Nutrição focada em gerar interesse para visita presencial",
    stage_gatilho: "possibilidade_visita",
    passos: [
      { dias_apos_inicio: 0, tipo: "mensagem", titulo: "WhatsApp com material do empreendimento", conteudo: "{{nome}}, separei um material especial do {{empreendimento}} para você conhecer melhor o projeto. Dá uma olhada! 📸", canal: "whatsapp" },
      { dias_apos_inicio: 2, tipo: "ligacao", titulo: "Ligar para qualificar interesse", conteudo: "Ligar para {{nome}} e perguntar o que achou do material. Qualificar: objetivo (morar/investir), prazo, orçamento.", canal: "ligacao" },
      { dias_apos_inicio: 4, tipo: "mensagem", titulo: "WhatsApp convidando para visita", conteudo: "{{nome}}, que tal conhecer o {{empreendimento}} pessoalmente? A experiência presencial faz toda a diferença! Posso agendar para esta semana?", canal: "whatsapp" },
      { dias_apos_inicio: 7, tipo: "mensagem", titulo: "Última tentativa — propor data específica", conteudo: "{{nome}}, tenho disponibilidade quinta ou sexta para te levar conhecer o {{empreendimento}}. Qual dia funciona melhor para você?", canal: "whatsapp" },
    ],
  },
  {
    id: "confirmar_visita",
    icon: CalendarCheck,
    nome: "📅 Confirmar visita",
    descricao: "Garantir que o cliente compareça à visita agendada",
    stage_gatilho: "visita_marcada",
    passos: [
      { dias_apos_inicio: -1, tipo: "mensagem", titulo: "WhatsApp confirmando presença", conteudo: "{{nome}}, tudo certo para amanhã? Sua visita ao {{empreendimento}} está confirmada! Me avise qualquer imprevisto 😊", canal: "whatsapp" },
      { dias_apos_inicio: 0, tipo: "mensagem", titulo: "WhatsApp 2h antes com endereço/link", conteudo: "{{nome}}, daqui a pouco nos vemos! 📍 Segue a localização do {{empreendimento}}. Estou te esperando!", canal: "whatsapp" },
    ],
  },
  {
    id: "pos_visita",
    icon: DollarSign,
    nome: "💰 Negociação e fechamento",
    descricao: "Follow-up pós visita focado em fechar negócio",
    stage_gatilho: "visita_realizada",
    passos: [
      { dias_apos_inicio: 0, tipo: "ligacao", titulo: "Ligar pós-visita", conteudo: "Ligar para {{nome}} e perguntar impressões da visita. Qual unidade gostou mais? Identificar objeções.", canal: "ligacao" },
      { dias_apos_inicio: 1, tipo: "mensagem", titulo: "Enviar proposta por WhatsApp", conteudo: "{{nome}}, preparei uma proposta personalizada para o {{empreendimento}} com base no que conversamos. Segue os detalhes! 💰", canal: "whatsapp" },
      { dias_apos_inicio: 3, tipo: "mensagem", titulo: "Follow-up da proposta", conteudo: "{{nome}}, conseguiu analisar a proposta do {{empreendimento}}? Posso esclarecer alguma dúvida ou ajustar algum ponto?", canal: "whatsapp" },
    ],
  },
  {
    id: "reativacao",
    icon: RefreshCw,
    nome: "♻️ Reativar lead antigo",
    descricao: "Retomar contato com leads inativos há mais de 30 dias",
    stage_gatilho: "sem_contato",
    passos: [
      { dias_apos_inicio: 0, tipo: "mensagem", titulo: "WhatsApp de reengajamento", conteudo: "{{nome}}, tudo bem? Faz um tempo que conversamos. Temos novidades no {{empreendimento}} que podem te interessar! Quer saber mais?", canal: "whatsapp" },
      { dias_apos_inicio: 3, tipo: "ligacao", titulo: "Ligar se não respondeu", conteudo: "Ligar para {{nome}} — retomar conversa com novidades do {{empreendimento}}. Tentar requalificar interesse.", canal: "ligacao" },
      { dias_apos_inicio: 7, tipo: "mensagem", titulo: "Mensagem final com novidade", conteudo: "{{nome}}, última novidade: condições especiais de entrada no {{empreendimento}} por tempo limitado! Se tiver interesse, estou aqui 😊", canal: "whatsapp" },
    ],
  },
  {
    id: "lead_sumiu",
    icon: Ghost,
    nome: "👻 Lead que sumiu",
    descricao: "Última tentativa de contato com lead que parou de responder",
    stage_gatilho: "contato_inicial",
    passos: [
      { dias_apos_inicio: 0, tipo: "mensagem", titulo: 'WhatsApp "última tentativa"', conteudo: "{{nome}}, percebi que não conseguimos mais conversar. Está tudo bem? Se ainda tiver interesse em imóveis, estou aqui! Caso não, sem problemas 😊", canal: "whatsapp" },
      { dias_apos_inicio: 7, tipo: "lembrete", titulo: "Mover para Descarte se sem resposta", conteudo: "Verificar se {{nome}} respondeu. Se não, mover lead para Descarte. Caso tenha respondido, retomar atendimento.", canal: "whatsapp" },
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

const CANAL_ICONS: Record<string, { icon: typeof MessageSquare; label: string; color: string }> = {
  whatsapp: { icon: MessageSquare, label: "WhatsApp", color: "#22C55E" },
  ligacao: { icon: Phone, label: "Ligação", color: "#F59E0B" },
  email: { icon: MessageSquare, label: "E-mail", color: "#3B82F6" },
};

const TIPO_ICONS: Record<string, any> = {
  mensagem: MessageSquare,
  ligacao: Phone,
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

  // Lead selector
  const [selectLeadsOpen, setSelectLeadsOpen] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState<SequenceTemplate | null>(null);
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [leadSearch, setLeadSearch] = useState("");
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [applyingToLeads, setApplyingToLeads] = useState(false);

  // AI generation
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiForm, setAiForm] = useState({ produto: "", etapa: "novo_lead", objetivo: "" });
  const [aiPreview, setAiPreview] = useState<SequenceTemplate | null>(null);

  // Custom sequence creation
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ nome: "", stage_gatilho: "novo_lead", passos: [] as SequenceStep[] });
  const [newStep, setNewStep] = useState<SequenceStep>({ dias_apos_inicio: 0, tipo: "mensagem", titulo: "", conteudo: "", canal: "whatsapp" });

  const loadLeads = useCallback(async () => {
    setLoadingLeads(true);
    const { data } = await supabase
      .from("pipeline_leads")
      .select("id, nome, empreendimento, telefone, stage_id")
      .not("stage_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);
    setLeads((data || []) as PipelineLead[]);
    setLoadingLeads(false);
  }, []);

  const handleOpenLeadSelector = (template: SequenceTemplate) => {
    setApplyingTemplate(template);
    setSelectedLeadIds(new Set());
    setLeadSearch("");
    setSelectLeadsOpen(true);
    loadLeads();
  };

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

      // Open lead selector
      handleOpenLeadSelector(template);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aplicar sequência");
    } finally {
      setApplying(false);
    }
  }, [user, customName, customEmpreendimento, onSequenceCreated]);

  const handleApplyToLeads = useCallback(async () => {
    if (!user || !applyingTemplate || selectedLeadIds.size === 0) return;
    setApplyingToLeads(true);
    try {
      const today = new Date();
      const tasksToInsert: any[] = [];

      for (const leadId of selectedLeadIds) {
        const lead = leads.find(l => l.id === leadId);
        for (const passo of applyingTemplate.passos) {
          const dueDate = new Date(today);
          dueDate.setDate(dueDate.getDate() + passo.dias_apos_inicio);

          const conteudo = passo.conteudo
            .replace(/\{\{nome\}\}/g, lead?.nome || "Cliente")
            .replace(/\{\{empreendimento\}\}/g, customEmpreendimento || lead?.empreendimento || "Empreendimento");

          tasksToInsert.push({
            pipeline_lead_id: leadId,
            titulo: `📋 ${passo.titulo}`,
            descricao: conteudo,
            prioridade: passo.dias_apos_inicio === 0 ? "alta" : "media",
            vence_em: dueDate.toISOString().split("T")[0],
            status: "pendente",
            created_by: user.id,
          });
        }
      }

      if (tasksToInsert.length > 0) {
        const { error } = await supabase.from("pipeline_tarefas").insert(tasksToInsert);
        if (error) throw error;
      }

      toast.success(`✅ Sequência aplicada a ${selectedLeadIds.size} lead(s) — ${tasksToInsert.length} tarefas criadas!`);
      setSelectLeadsOpen(false);
      setApplyingTemplate(null);
      setSelectedLeadIds(new Set());
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aplicar sequência nos leads");
    } finally {
      setApplyingToLeads(false);
    }
  }, [user, applyingTemplate, selectedLeadIds, leads, customEmpreendimento]);

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
        if (resp.status === 429) { toast.error("Limite de requisições excedido."); return; }
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

  const handleCreateCustom = useCallback(async () => {
    if (!user || !createForm.nome || createForm.passos.length === 0) return;
    setApplying(true);
    try {
      const { data: seq, error: seqErr } = await supabase
        .from("pipeline_sequencias")
        .insert({
          nome: createForm.nome,
          descricao: `Sequência personalizada com ${createForm.passos.length} passos`,
          stage_gatilho: createForm.stage_gatilho,
          criado_por: user.id,
          ativa: true,
        })
        .select("id")
        .single();

      if (seqErr || !seq) throw seqErr;

      const passosToInsert = createForm.passos.map((p, idx) => ({
        sequencia_id: seq.id,
        ordem: idx,
        dias_apos_inicio: p.dias_apos_inicio,
        tipo: p.tipo,
        titulo: p.titulo,
        conteudo: p.conteudo,
        canal: p.canal,
      }));

      await supabase.from("pipeline_sequencia_passos").insert(passosToInsert);

      toast.success(`Sequência "${createForm.nome}" criada!`);
      setCreateOpen(false);
      setCreateForm({ nome: "", stage_gatilho: "novo_lead", passos: [] });
      onSequenceCreated?.();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar sequência");
    } finally {
      setApplying(false);
    }
  }, [user, createForm, onSequenceCreated]);

  const addStepToCustom = () => {
    if (!newStep.titulo) return;
    setCreateForm(prev => ({
      ...prev,
      passos: [...prev.passos, { ...newStep }],
    }));
    setNewStep({ dias_apos_inicio: 0, tipo: "mensagem", titulo: "", conteudo: "", canal: "whatsapp" });
  };

  const removeStepFromCustom = (idx: number) => {
    setCreateForm(prev => ({
      ...prev,
      passos: prev.passos.filter((_, i) => i !== idx),
    }));
  };

  const filteredLeads = leads.filter(l => {
    if (!leadSearch) return true;
    const q = leadSearch.toLowerCase();
    return l.nome.toLowerCase().includes(q) || l.empreendimento?.toLowerCase().includes(q);
  });

  const toggleLead = (id: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            📦 Biblioteca de Sequências
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aplique sequências prontas, gere com IA ou crie a sua
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" /> Nova
          </Button>
          <Button size="sm" onClick={() => setAiDialogOpen(true)} className="gap-1.5 text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white">
            <Sparkles className="h-3.5 w-3.5" /> Criar com IA
          </Button>
        </div>
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
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant="secondary" className="text-[9px]">
                      {t.passos.length} passos
                    </Badge>
                    <Badge variant="outline" className="text-[9px]">
                      {STAGE_LABELS[t.stage_gatilho] || t.stage_gatilho}
                    </Badge>
                    <div className="flex items-center gap-0.5">
                      {[...new Set(t.passos.map(p => p.canal))].map(canal => {
                        const info = CANAL_ICONS[canal];
                        if (!info) return null;
                        const CIcon = info.icon;
                        return (
                          <span key={canal} className="text-[9px] flex items-center gap-0.5 text-muted-foreground">
                            <CIcon className="h-2.5 w-2.5" style={{ color: info.color }} />
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ═══ Preview & Apply Dialog ═══ */}
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

              {/* Steps list */}
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1">
                  {previewTemplate.passos.map((p, idx) => {
                    const TIcon = TIPO_ICONS[p.tipo] || TIPO_ICONS[p.canal] || MessageSquare;
                    const canalInfo = CANAL_ICONS[p.canal] || CANAL_ICONS.whatsapp;
                    return (
                      <div key={idx}>
                        <div className="flex items-start gap-3 p-2.5 rounded-lg border border-border bg-card">
                          <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${canalInfo.color}15` }}>
                            <TIcon className="h-3.5 w-3.5" style={{ color: canalInfo.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-foreground">Passo {idx + 1}:</span>
                              <Badge variant="secondary" className="text-[9px]">Dia {p.dias_apos_inicio}</Badge>
                              <Badge variant="outline" className="text-[9px] gap-0.5" style={{ borderColor: `${canalInfo.color}44`, color: canalInfo.color }}>
                                {canalInfo.label}
                              </Badge>
                            </div>
                            <p className="text-[11px] font-medium text-foreground mt-0.5">{p.titulo}</p>
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
            <Button size="sm" onClick={() => previewTemplate && handleApplyTemplate(previewTemplate)} disabled={applying} className="gap-1.5">
              {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              ⚡ Aplicar esta sequência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Lead Selector Dialog ═══ */}
      <Dialog open={selectLeadsOpen} onOpenChange={setSelectLeadsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Selecionar leads para aplicar
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Sequência: <span className="font-semibold text-foreground">{applyingTemplate?.nome}</span> — {applyingTemplate?.passos.length} passos
            </p>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar lead..." value={leadSearch} onChange={e => setLeadSearch(e.target.value)} className="pl-9 h-8 text-xs" />
            </div>

            {selectedLeadIds.size > 0 && (
              <Badge className="text-[10px]">{selectedLeadIds.size} lead(s) selecionado(s)</Badge>
            )}

            <ScrollArea className="max-h-[300px]">
              {loadingLeads ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : (
                <div className="space-y-1">
                  {filteredLeads.map(lead => (
                    <div
                      key={lead.id}
                      className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                        selectedLeadIds.has(lead.id) ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40"
                      }`}
                      onClick={() => toggleLead(lead.id)}
                    >
                      <Checkbox checked={selectedLeadIds.has(lead.id)} className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-foreground truncate block">{lead.nome}</span>
                        {lead.empreendimento && (
                          <span className="text-[10px] text-muted-foreground">{lead.empreendimento}</span>
                        )}
                      </div>
                      {lead.telefone && <span className="text-[10px] text-muted-foreground shrink-0">📞</span>}
                    </div>
                  ))}
                  {filteredLeads.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum lead encontrado</p>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectLeadsOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleApplyToLeads} disabled={applyingToLeads || selectedLeadIds.size === 0} className="gap-1.5">
              {applyingToLeads ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
              Aplicar a {selectedLeadIds.size} lead(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Create Custom Sequence Dialog ═══ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4 text-primary" /> Nova Sequência Personalizada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Nome da sequência</Label>
                <Input className="mt-1 text-xs" value={createForm.nome} onChange={e => setCreateForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Nutrição Casa Tua" />
              </div>
              <div>
                <Label className="text-[10px]">Etapa do pipeline</Label>
                <Select value={createForm.stage_gatilho} onValueChange={v => setCreateForm(p => ({ ...p, stage_gatilho: v }))}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STAGE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Existing steps */}
            {createForm.passos.length > 0 && (
              <div className="space-y-1">
                <Label className="text-[10px]">Passos ({createForm.passos.length})</Label>
                {createForm.passos.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded border border-border bg-card text-xs">
                    <Badge variant="secondary" className="text-[9px] shrink-0">Dia {p.dias_apos_inicio}</Badge>
                    <Badge variant="outline" className="text-[9px] shrink-0">{CANAL_ICONS[p.canal]?.label || p.canal}</Badge>
                    <span className="truncate flex-1 font-medium">{p.titulo}</span>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive shrink-0" onClick={() => removeStepFromCustom(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add step form */}
            <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
              <Label className="text-[10px] font-semibold">Adicionar passo</Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[9px]">Dia</Label>
                  <Input type="number" min={-1} value={newStep.dias_apos_inicio} onChange={e => setNewStep(p => ({ ...p, dias_apos_inicio: parseInt(e.target.value) || 0 }))} className="mt-0.5 h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-[9px]">Tipo</Label>
                  <Select value={newStep.canal} onValueChange={v => setNewStep(p => ({ ...p, canal: v, tipo: v === "ligacao" ? "ligacao" : "mensagem" }))}>
                    <SelectTrigger className="mt-0.5 h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="ligacao">Ligação</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[9px]">&nbsp;</Label>
                  <Button variant="outline" size="sm" className="mt-0.5 w-full h-7 text-xs gap-1" onClick={addStepToCustom} disabled={!newStep.titulo}>
                    <Plus className="h-3 w-3" /> Adicionar
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-[9px]">Título / Ação</Label>
                <Input className="mt-0.5 h-7 text-xs" value={newStep.titulo} onChange={e => setNewStep(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Ligar para apresentação" />
              </div>
              <div>
                <Label className="text-[9px]">Mensagem / Script (opcional)</Label>
                <Textarea className="mt-0.5 text-xs min-h-[60px]" value={newStep.conteudo} onChange={e => setNewStep(p => ({ ...p, conteudo: e.target.value }))} placeholder="Use {{nome}} e {{empreendimento}} como variáveis" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreateCustom} disabled={applying || !createForm.nome || createForm.passos.length === 0} className="gap-1.5">
              {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Criar Sequência ({createForm.passos.length} passos)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ AI Generation Dialog ═══ */}
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
              <Select value={aiForm.etapa} onValueChange={v => setAiForm(p => ({ ...p, etapa: v }))}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STAGE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Objetivo</Label>
              <Input className="mt-1 text-xs" value={aiForm.objetivo} onChange={e => setAiForm(p => ({ ...p, objetivo: e.target.value }))} placeholder="Ex: gerar visita, fechar venda" />
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
