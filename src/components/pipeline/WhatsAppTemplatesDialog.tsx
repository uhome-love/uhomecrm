import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, Copy, ExternalLink, Sparkles, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadNome: string;
  leadTelefone: string | null;
  leadEmpreendimento: string | null;
  leadId: string;
  corretorNome?: string;
  stageTipo?: string;
}

function getWhatsAppUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55"))
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return phone;
}

const TEMPLATES = [
  {
    id: "primeiro_contato",
    emoji: "👋",
    label: "Primeiro contato",
    template: `Olá {{nome}}! Sou {{corretor}} da UHome. Vi que você demonstrou interesse no {{empreendimento}}. Posso te ajudar com mais informações? 😊`,
  },
  {
    id: "nao_atendeu",
    emoji: "📞",
    label: "Não atendeu",
    template: `Oi {{nome}}, tentei te ligar agora mas não consegui falar contigo. Sou {{corretor}} da UHome, sobre o {{empreendimento}}. Posso te retornar em outro horário? 📞`,
  },
  {
    id: "convite_visita",
    emoji: "🏠",
    label: "Convite para visita",
    template: `Oi {{nome}}! Que tal conhecer pessoalmente o {{empreendimento}}? Posso agendar uma visita num horário que fique bom pra você. Quando seria melhor? 🏠`,
  },
  {
    id: "envio_proposta",
    emoji: "📄",
    label: "Envio de proposta",
    template: `{{nome}}, preparei uma condição especial do {{empreendimento}} pra você! Vou te enviar os detalhes agora. Qualquer dúvida, estou à disposição! 📋`,
  },
  {
    id: "follow_up",
    emoji: "🔄",
    label: "Follow-up",
    template: `Oi {{nome}}, tudo bem? Estou passando pra saber se conseguiu analisar as informações do {{empreendimento}}. Posso te ajudar com algo mais? 😊`,
  },
  {
    id: "pos_venda",
    emoji: "🎉",
    label: "Pós-venda",
    template: `{{nome}}, parabéns pela escolha do {{empreendimento}}! 🎉 Estou à disposição pra qualquer dúvida durante todo o processo. Bem-vindo(a) à família UHome! 🏡`,
  },
];

export default function WhatsAppTemplatesDialog({ open, onOpenChange, leadNome, leadTelefone, leadEmpreendimento, leadId, corretorNome, stageTipo }: Props) {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [showOthers, setShowOthers] = useState(false);

  const templatesPorEtapa: Record<string, string[]> = {
    sem_contato: ['primeiro_contato', 'nao_atendeu'],
    contato_iniciado: ['follow_up', 'nao_atendeu'],
    contato_inicial: ['follow_up', 'nao_atendeu'],
    busca: ['follow_up', 'convite_visita'],
    aquecimento: ['convite_visita', 'follow_up'],
    visita: ['convite_visita', 'follow_up'],
    pos_visita: ['envio_proposta', 'follow_up'],
    negociacao: ['envio_proposta', 'follow_up'],
    // Legacy fallbacks
    qualificacao: ['follow_up', 'convite_visita'],
    possivel_visita: ['convite_visita', 'follow_up'],
    visita_marcada: ['convite_visita', 'follow_up'],
    visita_realizada: ['envio_proposta', 'follow_up'],
  };

  const filteredIds = stageTipo ? templatesPorEtapa[stageTipo] || null : null;
  const primaryTemplates = filteredIds ? TEMPLATES.filter(t => filteredIds.includes(t.id)) : TEMPLATES;
  const secondaryTemplates = filteredIds ? TEMPLATES.filter(t => !filteredIds.includes(t.id)) : [];

  const replaceVars = (template: string) => {
    return template
      .replace(/\{\{nome\}\}/g, leadNome?.split(" ")[0] || "")
      .replace(/\{\{empreendimento\}\}/g, leadEmpreendimento || "nosso empreendimento")
      .replace(/\{\{corretor\}\}/g, corretorNome || "seu corretor");
  };

  const handleSelectTemplate = (template: string) => {
    const msg = replaceVars(template);
    
    navigator.clipboard.writeText(msg).then(() => {
      toast.success("Mensagem copiada! Cole no WhatsApp 📋");
    }).catch(() => {
      toast.info("Não foi possível copiar automaticamente");
    });

    if (user) {
      supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: leadId,
        tipo: "whatsapp",
        titulo: "WhatsApp enviado (template)",
        descricao: msg.substring(0, 200),
        created_by: user.id,
      }).then(() => {});
      supabase.from("pipeline_leads").update({
        ultima_acao_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any).eq("id", leadId).then(() => {});
    }

    onOpenChange(false);
  };

  const handleFreeMessage = () => {
    // Open WhatsApp FIRST (synchronous) to avoid popup blockers
    if (leadTelefone) {
      window.open(getWhatsAppUrl(leadTelefone), "_blank");
    }
    if (user) {
      supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: leadId,
        tipo: "whatsapp",
        titulo: "WhatsApp enviado",
        created_by: user.id,
      }).then(() => {});
      supabase.from("pipeline_leads").update({
        ultima_acao_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any).eq("id", leadId).then(() => {});
    }
    toast.success("💬 WhatsApp aberto");
    onOpenChange(false);
  };

  const handleHomiGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("homi-personalizar-mensagem", {
        body: {
          nome: leadNome,
          empreendimento: leadEmpreendimento,
          corretor: corretorNome,
          canal: "whatsapp",
        },
      });
      if (data?.mensagem) {
        navigator.clipboard.writeText(data.mensagem).catch(() => {});
        toast.success("✨ Mensagem HOMI copiada! Cole no WhatsApp 📋");
        onOpenChange(false);
      } else {
        toast.error("Erro ao gerar mensagem");
      }
    } catch {
      toast.error("Erro ao gerar mensagem");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 max-h-[85vh] overflow-y-auto">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            WhatsApp para {leadNome?.split(" ")[0]}
          </DialogTitle>
          {leadTelefone && (
            <p className="text-sm text-muted-foreground">{formatPhone(leadTelefone)}</p>
          )}
        </DialogHeader>

        <div className="px-5 pb-5 space-y-2">
          {/* Free message */}
          <Button
            variant="outline"
            className="w-full justify-start gap-2 h-10 text-sm"
            onClick={handleFreeMessage}
          >
            <ExternalLink className="h-4 w-4" />
            📝 Mensagem livre
          </Button>

          <div className="h-px bg-border my-2" />

          {/* Templates filtrados por etapa */}
          {primaryTemplates.map((t) => (
            <button
              key={t.id}
              className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors group"
              onClick={() => handleSelectTemplate(t.template)}
            >
              <span className="text-lg shrink-0 mt-0.5">{t.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t.label}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{replaceVars(t.template)}</p>
              </div>
              <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
            </button>
          ))}

          {/* Outros templates (colapsável) */}
          {secondaryTemplates.length > 0 && (
            <>
              <button
                className="w-full text-left text-[11px] text-muted-foreground font-medium px-3 py-1.5 hover:text-foreground transition-colors flex items-center gap-1"
                onClick={() => setShowOthers(!showOthers)}
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${showOthers ? 'rotate-180' : ''}`} />
                Outros templates ({secondaryTemplates.length})
              </button>
              {showOthers && secondaryTemplates.map((t) => (
                <button
                  key={t.id}
                  className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors group opacity-80"
                  onClick={() => handleSelectTemplate(t.template)}
                >
                  <span className="text-lg shrink-0 mt-0.5">{t.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{t.label}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{replaceVars(t.template)}</p>
                  </div>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
                </button>
              ))}
            </>
          )}

          <div className="h-px bg-border my-2" />

          {/* HOMI generate */}
          <Button
            variant="outline"
            className="w-full justify-start gap-2 h-10 text-sm border-primary/30 text-primary hover:bg-primary/5"
            onClick={handleHomiGenerate}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            ✨ HOMI: Gerar mensagem personalizada
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
