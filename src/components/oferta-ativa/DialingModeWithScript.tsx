import { useState, useEffect, useRef } from "react";
import { useOAFila, useOARegistrarTentativa, useOATemplates, type OALista, type OALead } from "@/hooks/useOfertaAtiva";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, MessageCircle, Mail, Copy, User, Building2, Calendar, History, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import AttemptModal from "./AttemptModal";
import ScriptPanel from "./ScriptPanel";
import AttemptHistory from "./AttemptHistory";

interface Props {
  lista: OALista;
  onBack: () => void;
}

export default function DialingModeWithScript({ lista, onBack }: Props) {
  const { fila, isLoading, lockLead, unlockLead, refetch } = useOAFila(lista.id);
  const { registrar } = useOARegistrarTentativa();
  const { templates } = useOATemplates(lista.empreendimento);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [actionTaken, setActionTaken] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const lead = fila[currentIndex];

  // Lock lead when it becomes active
  const prevLeadIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (lead && lead.id !== prevLeadIdRef.current) {
      prevLeadIdRef.current = lead.id;
      lockLead(lead.id);
    }
    return () => {
      // Unlock on unmount if lead was locked
      if (prevLeadIdRef.current) {
        unlockLead(prevLeadIdRef.current);
      }
    };
  }, [lead?.id, lockLead, unlockLead]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleAction = (canal: string) => {
    if (!lead) return;
    setActionTaken(canal);

    if (canal === "ligacao" && lead.telefone) {
      window.open(`tel:${lead.telefone}`, "_self");
    } else if (canal === "whatsapp" && lead.telefone) {
      const phone = lead.telefone.replace(/\D/g, "");
      const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
      const template = templates.find(t => t.canal === "whatsapp" && t.tipo === "primeiro_contato");
      const msg = template
        ? template.conteudo.replace("{nome}", lead.nome).replace("{empreendimento}", lead.empreendimento || "")
        : `Olá ${lead.nome}! Vi que você se interessou pelo ${lead.empreendimento || "nosso empreendimento"}. Podemos conversar?`;
      window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
    } else if (canal === "email" && lead.email) {
      const subject = `${lead.empreendimento || "Oportunidade"} - Informações`;
      const body = `Olá ${lead.nome},\n\nGostaria de apresentar mais detalhes sobre o ${lead.empreendimento || "empreendimento"}.\n\nPodemos agendar uma conversa?`;
      window.open(`mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
    }

    setTimeout(() => setShowModal(true), 500);
  };

  const handleResultSubmit = async (resultado: string, feedback: string) => {
    if (!lead || !actionTaken) return;
    await registrar(lead, actionTaken, resultado, feedback, lista);
    setShowModal(false);
    setActionTaken(null);

    if (currentIndex < fila.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      refetch();
      setCurrentIndex(0);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!lead) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
          <p className="font-bold text-lg text-foreground">Fila concluída! 🎉</p>
          <p className="text-sm text-muted-foreground mt-1">Todos os leads de <strong>{lista.empreendimento}</strong> foram trabalhados.</p>
          <Button className="mt-4" onClick={onBack}>Voltar às listas</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Lead {currentIndex + 1} de {fila.length}</span>
        <span className="font-semibold text-primary">{lista.empreendimento} · Modo Missão</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${((currentIndex + 1) / fila.length) * 100}%` }} />
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Lead Card (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          <Card className="border-2 border-primary/20">
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> {lead.nome}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" /> {lead.empreendimento}
                    {lead.campanha && <span>· {lead.campanha}</span>}
                    {lead.origem && <span>· {lead.origem}</span>}
                  </div>
                </div>
                {lead.tentativas_count > 0 && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <History className="h-3 w-3" /> {lead.tentativas_count} tent.
                  </Badge>
                )}
              </div>

              {/* Contact info */}
              <div className="grid gap-2">
                {lead.telefone && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border border-border">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Telefone principal</p>
                      <p className="text-base font-mono font-bold text-foreground">{lead.telefone}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(lead.telefone!, "Telefone")}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                {lead.telefone2 && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Telefone secundário</p>
                      <p className="text-sm font-mono text-foreground">{lead.telefone2}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(lead.telefone2!, "Telefone 2")}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                {lead.email && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border">
                    <div>
                      <p className="text-[10px] text-muted-foreground">E-mail</p>
                      <p className="text-xs text-foreground">{lead.email}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(lead.email!, "E-mail")}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Extra info */}
              <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                {lead.data_lead && (
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Lead de {lead.data_lead}</span>
                )}
                {lead.observacoes && <span className="italic">"{lead.observacoes}"</span>}
              </div>

              {/* Attempt History */}
              {lead.tentativas_count > 0 && <AttemptHistory leadId={lead.id} />}

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <Button
                  size="lg"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-12 text-sm"
                  onClick={() => handleAction("ligacao")}
                  disabled={!!actionTaken && !showModal}
                >
                  <Phone className="h-4 w-4" /> Ligar
                </Button>
                <Button
                  size="lg"
                  className="gap-1.5 bg-green-600 hover:bg-green-700 h-12 text-sm"
                  onClick={() => handleAction("whatsapp")}
                  disabled={!!actionTaken && !showModal}
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-1.5 h-12 text-sm"
                  onClick={() => handleAction("email")}
                  disabled={!lead.email || (!!actionTaken && !showModal)}
                >
                  <Mail className="h-4 w-4" /> E-mail
                </Button>
              </div>

              {actionTaken && !showModal && (
                <div className="text-center text-xs text-muted-foreground animate-pulse">
                  Registre o resultado para continuar...
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Script Panel (2 cols) */}
        <div className="lg:col-span-2">
          <div className="sticky top-4">
            <ScriptPanel empreendimento={lista.empreendimento} lead={lead} />
          </div>
        </div>
      </div>

      {/* Attempt Modal */}
      {showModal && (
        <AttemptModal
          open={showModal}
          onClose={() => { setShowModal(false); setActionTaken(null); }}
          onSubmit={handleResultSubmit}
          leadName={lead.nome}
        />
      )}
    </div>
  );
}
