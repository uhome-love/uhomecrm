import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Play, MessageCircle, Bell, ClipboardList, ArrowRight, Star, Mail, Phone, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useState } from "react";

interface SequenceTemplate {
  id: string;
  title: string;
  description: string;
  emoji: string;
  recommended: boolean;
  steps: { delay: string; icon: React.ReactNode; text: string }[];
  automationPayload: {
    name: string;
    trigger_type: string;
    trigger_config: any;
    conditions: any[];
    actions: any[];
  };
}

const TEMPLATES: SequenceTemplate[] = [
  {
    id: "boas-vindas",
    title: "Boas-vindas ao novo lead",
    description: "Sequência de 3 passos para engajar leads recém-chegados com WhatsApp, ligação e alerta ao gerente.",
    emoji: "👋",
    recommended: true,
    steps: [
      { delay: "Imediato", icon: <MessageCircle className="h-3 w-3 text-green-600" />, text: 'WhatsApp: "Olá {{nome}}! Vi que você se interessou pelo {{empreendimento}}..."' },
      { delay: "+2h", icon: <ClipboardList className="h-3 w-3 text-primary" />, text: "Criar atividade: Ligar para {{nome}}" },
      { delay: "+24h", icon: <Bell className="h-3 w-3 text-amber-500" />, text: "Notificar gerente: Lead sem contato há 24h" },
    ],
    automationPayload: {
      name: "Boas-vindas ao novo lead",
      trigger_type: "lead_arrived",
      trigger_config: {},
      conditions: [],
      actions: [
        {
          type: "whatsapp",
          message: "Olá {{nome}}! Vi que você se interessou pelo {{empreendimento}}. Sou {{corretor}} da Uhome e adoraria te ajudar. Posso te ligar agora?",
        },
        {
          type: "create_activity",
          activity_title: "Ligar para {{nome}}",
          activity_hours: 2,
        },
        {
          type: "notify_manager",
          notify_text: "Lead {{nome}} sem contato há 24h",
        },
      ],
    },
  },
  {
    id: "reengajamento",
    title: "Reengajamento de lead frio",
    description: "Reativa leads parados há 72h com mensagem personalizada e move para descarte se não responder.",
    emoji: "🧊",
    recommended: true,
    steps: [
      { delay: "72h sem ação", icon: <MessageCircle className="h-3 w-3 text-green-600" />, text: 'WhatsApp: "Oi {{nome}}! Ainda tenho condições especiais para o {{empreendimento}}..."' },
      { delay: "+48h", icon: <ArrowRight className="h-3 w-3 text-destructive" />, text: 'Mover para "Sem Interesse" + notificar corretor' },
    ],
    automationPayload: {
      name: "Reengajamento de lead frio",
      trigger_type: "lead_no_contact",
      trigger_config: { hours: 72 },
      conditions: [],
      actions: [
        {
          type: "whatsapp",
          message: "Oi {{nome}}! Tudo bem? Ainda tenho condições especiais para o {{empreendimento}}. Podemos conversar 5 minutinhos?",
        },
        {
          type: "notify_manager",
          notify_text: "Lead {{nome}} sem resposta após reengajamento — avaliar descarte",
        },
      ],
    },
  },
  {
    id: "pos-visita",
    title: "Pós-visita",
    description: "Follow-up automático após visita realizada com mensagem de agradecimento e alerta de urgência.",
    emoji: "🏠",
    recommended: false,
    steps: [
      { delay: "+1h", icon: <MessageCircle className="h-3 w-3 text-green-600" />, text: 'WhatsApp: "{{nome}}, foi ótimo te receber! O que achou do {{empreendimento}}?"' },
      { delay: "+48h", icon: <ClipboardList className="h-3 w-3 text-destructive" />, text: "Criar atividade: Follow-up pós-visita urgente" },
    ],
    automationPayload: {
      name: "Pós-visita",
      trigger_type: "visit_done",
      trigger_config: {},
      conditions: [],
      actions: [
        {
          type: "whatsapp",
          message: "{{nome}}, foi ótimo te receber! O que achou do {{empreendimento}}? Posso preparar uma proposta personalizada para você?",
        },
        {
          type: "create_activity",
          activity_title: "Follow-up pós-visita urgente — {{nome}}",
          activity_hours: 48,
        },
      ],
    },
  },
  {
    id: "lembrete-proposta",
    title: "Lembrete de proposta enviada",
    description: "Acompanha propostas enviadas com lembrete por WhatsApp e notificação ao gerente se não atualizar.",
    emoji: "📄",
    recommended: false,
    steps: [
      { delay: "+24h", icon: <MessageCircle className="h-3 w-3 text-green-600" />, text: 'WhatsApp: "Oi {{nome}}, conseguiu ver a proposta?"' },
      { delay: "+72h", icon: <Bell className="h-3 w-3 text-amber-500" />, text: "Notificar gerente no PDN" },
    ],
    automationPayload: {
      name: "Lembrete de proposta enviada",
      trigger_type: "lead_moved",
      trigger_config: { stage_name: "Proposta" },
      conditions: [],
      actions: [
        {
          type: "whatsapp",
          message: "Oi {{nome}}, conseguiu ver a proposta que enviei? Qualquer dúvida estou à disposição!",
        },
        {
          type: "notify_manager",
          notify_text: "Proposta de {{nome}} sem atualização há 72h — verificar PDN",
        },
      ],
    },
  },
  // ── Cadências Inteligentes Event-Driven ──
  {
    id: "sem-contato-agressivo",
    title: "Sem Contato — Cadência Event-Driven",
    description: "24h+ parado: WA → Email → WA condicional → Voz IA → Alerta → Email valor → Descarte",
    emoji: "🔥",
    recommended: true,
    steps: [
      { delay: "D0 (24h)", icon: <MessageCircle className="h-3 w-3 text-green-600" />, text: 'WhatsApp: "Separei imóveis para você!" + vitrine' },
      { delay: "D1", icon: <Mail className="h-3 w-3 text-blue-600" />, text: "E-mail: Vitrine personalizada HTML" },
      { delay: "D3", icon: <MessageCircle className="h-3 w-3 text-green-600" />, text: "WhatsApp: Condições especiais (se NÃO leu D0)" },
      { delay: "D5", icon: <Phone className="h-3 w-3 text-purple-600" />, text: "Voz IA: Apresentação + interesse (CEO ativa)" },
      { delay: "D7", icon: <Bell className="h-3 w-3 text-amber-500" />, text: "Alerta gerente: 7 dias sem contato" },
      { delay: "D10", icon: <Mail className="h-3 w-3 text-blue-600" />, text: 'E-mail: "Novidades no mercado" — conteúdo valor' },
      { delay: "D14", icon: <ArrowRight className="h-3 w-3 text-destructive" />, text: "Sugerir descarte ou redistribuição" },
    ],
    automationPayload: {
      name: "Sem Contato — Cadência Event-Driven",
      trigger_type: "nurturing_stage",
      trigger_config: { stage_tipo: "sem_contato", stalled_hours: 24 },
      conditions: [],
      actions: [
        { type: "whatsapp", delay_days: 0, template_name: "reativacao_vitrine", canal: "whatsapp" },
        { type: "email", delay_days: 1, template_key: "reativacao-vitrine", canal: "email" },
        { type: "whatsapp", delay_days: 3, template_name: "condicoes_especiais", canal: "whatsapp" },
        { type: "voz", delay_days: 5, canal: "voz" },
        { type: "notify_manager", delay_days: 7, notify_text: "Lead {{nome}} — 7 dias sem contato" },
        { type: "email", delay_days: 10, template_key: "novidades-mercado", canal: "email" },
        { type: "notify_manager", delay_days: 14, notify_text: "Lead {{nome}} — sugerir descarte ou redistribuição" },
      ],
    },
  },
  {
    id: "qualificacao-parado",
    title: "Qualificação Parada — Adaptativa",
    description: "72h+ parado: WA vitrine → Email site novo → WA adaptativo por score → Voz → Alerta → Email case",
    emoji: "📊",
    recommended: true,
    steps: [
      { delay: "D0 (72h)", icon: <MessageCircle className="h-3 w-3 text-green-600" />, text: "WhatsApp: Vitrine automática (Motor 1)" },
      { delay: "D2", icon: <Mail className="h-3 w-3 text-blue-600" />, text: 'E-mail: "Conheça nossos empreendimentos" + vitrine' },
      { delay: "D4", icon: <MessageCircle className="h-3 w-3 text-green-600" />, text: "WhatsApp: Novo match (ou conteúdo valor se score > 10)" },
      { delay: "D7", icon: <Phone className="h-3 w-3 text-purple-600" />, text: "Voz IA: Confirmação de interesse (CEO ativa)" },
      { delay: "D10", icon: <Bell className="h-3 w-3 text-amber-500" />, text: "Alerta gerente: lead travado" },
      { delay: "D14", icon: <Mail className="h-3 w-3 text-blue-600" />, text: "E-mail: Case de sucesso / depoimento" },
    ],
    automationPayload: {
      name: "Qualificação Parada — Adaptativa",
      trigger_type: "nurturing_stage",
      trigger_config: { stage_tipo: "qualificacao", stalled_hours: 72 },
      conditions: [],
      actions: [
        { type: "whatsapp", delay_days: 0, template_name: "reativacao_vitrine", canal: "whatsapp" },
        { type: "email", delay_days: 2, template_key: "novidades-mercado", canal: "email" },
        { type: "whatsapp", delay_days: 4, template_name: "reativacao_vitrine", canal: "whatsapp" },
        { type: "voz", delay_days: 7, canal: "voz" },
        { type: "notify_manager", delay_days: 10, notify_text: "Lead {{nome}} em qualificação sem resposta" },
        { type: "email", delay_days: 14, template_key: "ultimo-lembrete", canal: "email" },
      ],
    },
  },
  {
    id: "reativacao-base-fria",
    title: "Reativação da Base Fria — Multicanal",
    description: "Descartados: Email → WA condicional → Voz IA → Email educativo → Avaliação score",
    emoji: "♻️",
    recommended: true,
    steps: [
      { delay: "D0", icon: <Mail className="h-3 w-3 text-blue-600" />, text: 'E-mail: "Novidades no mercado" + vitrine' },
      { delay: "D3", icon: <MessageCircle className="h-3 w-3 text-green-600" />, text: "WhatsApp: Novos imóveis (SÓ se abriu email)" },
      { delay: "D7", icon: <Phone className="h-3 w-3 text-purple-600" />, text: "Voz IA: Campanha reativação em lote (CEO)" },
      { delay: "D10", icon: <Mail className="h-3 w-3 text-blue-600" />, text: 'E-mail: "5 dicas para comprar em 2026" (se interagiu)' },
      { delay: "D14", icon: <ArrowRight className="h-3 w-3 text-emerald-500" />, text: "Score 15+ → roleta quente. Score < 5 → próx. ciclo 30d" },
    ],
    automationPayload: {
      name: "Reativação da Base Fria — Multicanal",
      trigger_type: "nurturing_stage",
      trigger_config: { stage_tipo: "reativacao", stalled_hours: 0 },
      conditions: [],
      actions: [
        { type: "email", delay_days: 0, template_key: "novidades-mercado", canal: "email" },
        { type: "whatsapp", delay_days: 3, template_name: "reativacao_vitrine", canal: "whatsapp" },
        { type: "voz", delay_days: 7, canal: "voz" },
        { type: "email", delay_days: 10, template_key: "ultimo-lembrete", canal: "email" },
        { type: "notify_manager", delay_days: 14, notify_text: "Lead {{nome}} — avaliar score para redistribuição" },
      ],
    },
  },
];

interface Props {
  onCreated: () => void;
}

export default function SequenceTemplates({ onCreated }: Props) {
  const { user } = useAuth();
  const [activating, setActivating] = useState<string | null>(null);

  const handleUseTemplate = async (template: SequenceTemplate) => {
    if (!user) return;
    setActivating(template.id);

    const { error } = await supabase.from("automations").insert({
      ...template.automationPayload,
      created_by: user.id,
      is_active: true,
    } as any);

    setActivating(null);
    if (error) {
      console.error(error);
      toast.error("Erro ao criar automação");
      return;
    }
    toast.success(`Sequência "${template.title}" ativada!`);
    onCreated();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold">Templates Prontos</h2>
        <span className="text-[10px] text-muted-foreground">Ative com um clique</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <Card key={t.id} className="p-4 space-y-3 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{t.emoji}</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-semibold">{t.title}</h3>
                    {t.recommended && (
                      <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4 gap-0.5 bg-amber-500 hover:bg-amber-600">
                        <Star className="h-2.5 w-2.5" /> Recomendado
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{t.description}</p>
                </div>
              </div>
            </div>

            {/* Steps preview */}
            <div className="space-y-1.5 pl-1">
              {t.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex flex-col items-center">
                    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {step.icon}
                    </div>
                    {i < t.steps.length - 1 && <div className="w-px h-3 bg-border" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground">{step.delay}</span>
                    <p className="text-[11px] text-foreground leading-tight">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              size="sm"
              className="w-full h-8 text-xs gap-1.5"
              variant="outline"
              disabled={activating === t.id}
              onClick={() => handleUseTemplate(t)}
            >
              {activating === t.id ? (
                <span className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              Usar este template
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
