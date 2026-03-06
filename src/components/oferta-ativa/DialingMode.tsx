import { useState, useCallback, useRef, useEffect } from "react";
import { useOAFila, useOARegistrarTentativa, useOATemplates, type OALista, type OALead } from "@/hooks/useOfertaAtiva";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, MessageCircle, Mail, Copy, User, Building2, Calendar, History, ChevronRight, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import AttemptModal from "./AttemptModal";

interface Props {
  lista: OALista;
  onBack: () => void;
}

export default function DialingMode({ lista, onBack }: Props) {
  const { fila, isLoading, refetch } = useOAFila(lista.id);
  const { registrar } = useOARegistrarTentativa();
  const { templates } = useOATemplates(lista.empreendimento);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [actionTaken, setActionTaken] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lead = fila[currentIndex];

  // TIMESTAMP-BASED Timer (fixes accelerated counting)
  const [callStartTimestamp, setCallStartTimestamp] = useState<number | null>(null);
  const startTimer = useCallback(() => {
    const now = Date.now();
    setCallStartTimestamp(now);
    setCallTimer(0);
    setCallActive(true);
    timerRef.current = setInterval(() => setCallTimer(Math.floor((Date.now() - now) / 1000)), 250);
  }, []);

  const stopTimer = useCallback(() => {
    setCallActive(false);
    if (callStartTimestamp) {
      setCallTimer(Math.floor((Date.now() - callStartTimestamp) / 1000));
    }
    setCallStartTimestamp(null);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, [callStartTimestamp]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleAction = (canal: string) => {
    if (!lead) return;

    if (canal === "ligacao") {
      setActionTaken("ligacao");
      startTimer();
      return;
    }

    setActionTaken(canal);
    if (canal === "whatsapp" && lead.telefone) {
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

  const handleFinalizarLigacao = () => {
    stopTimer();
    setShowModal(true);
  };

  const handleResultSubmit = async (resultado: string, feedback: string, visitaMarcada?: boolean) => {
    if (!lead || !actionTaken) return;
    await registrar(lead, actionTaken, resultado, feedback, lista, undefined, visitaMarcada);

    if (visitaMarcada) {
      toast.success("📅 Visita marcada contabilizada!");
    }

    stopTimer();
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
          <p className="text-sm text-muted-foreground mt-1">
            Todos os leads disponíveis de <strong>{lista.empreendimento}</strong> já foram trabalhados.
          </p>
          <Button className="mt-4" onClick={onBack}>Voltar às listas</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Lead {currentIndex + 1} de {fila.length}</span>
        <span className="font-semibold text-primary">{lista.empreendimento}</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${((currentIndex + 1) / fila.length) * 100}%` }} />
      </div>

      {/* Lead Card */}
      <Card className="border-2 border-primary/20">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> {lead.nome}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" /> {lead.empreendimento}
                {lead.campanha && <span>· {lead.campanha}</span>}
                {lead.origem && <span>· {lead.origem}</span>}
              </div>
            </div>
            {lead.tentativas_count > 0 && (
              <Badge variant="outline" className="text-xs gap-1">
                <History className="h-3 w-3" /> {lead.tentativas_count} tent.
              </Badge>
            )}
          </div>

          {/* Call Timer */}
          {callActive && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/10 border-2 border-red-500/30">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                <span className="text-xs font-semibold text-red-500 uppercase">Em ligação</span>
                <span className="text-2xl font-mono font-bold text-red-500">{formatTimer(callTimer)}</span>
              </div>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white gap-1" onClick={handleFinalizarLigacao}>
                <Phone className="h-3.5 w-3.5 rotate-[135deg]" /> Finalizar
              </Button>
            </div>
          )}

          {/* Contact info */}
          <div className="grid gap-2">
            {lead.telefone && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Telefone principal</p>
                  <p className="text-lg font-mono font-bold text-foreground">{lead.telefone}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(lead.telefone!, "Telefone")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
            {lead.telefone2 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Telefone secundário</p>
                  <p className="text-base font-mono text-foreground">{lead.telefone2}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(lead.telefone2!, "Telefone 2")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border">
                <div>
                  <p className="text-xs text-muted-foreground">E-mail</p>
                  <p className="text-sm text-foreground">{lead.email}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(lead.email!, "E-mail")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {lead.data_lead && (
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Lead de {lead.data_lead}</span>
            )}
            {lead.observacoes && <span className="italic">"{lead.observacoes}"</span>}
          </div>

          {/* Action Buttons — 2-step call flow */}
          {!callActive ? (
            <div className="grid grid-cols-3 gap-3 pt-2">
              <Button
                size="lg"
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 h-14 text-base"
                onClick={() => handleAction("ligacao")}
                disabled={showModal}
              >
                <Phone className="h-5 w-5" /> Iniciar Ligação
              </Button>
              <Button
                size="lg"
                className="gap-2 bg-green-600 hover:bg-green-700 h-14 text-base"
                onClick={() => handleAction("whatsapp")}
                disabled={showModal}
              >
                <MessageCircle className="h-5 w-5" /> WhatsApp
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 h-14 text-base"
                onClick={() => handleAction("email")}
                disabled={!lead.email || showModal}
              >
                <Mail className="h-5 w-5" /> E-mail
              </Button>
            </div>
          ) : (
            <div className="pt-2">
              <Button
                size="lg"
                className="w-full gap-2 bg-red-600 hover:bg-red-700 h-14 text-base text-white"
                onClick={handleFinalizarLigacao}
              >
                <Phone className="h-5 w-5 rotate-[135deg]" /> Finalizar Ligação · {formatTimer(callTimer)}
              </Button>
            </div>
          )}

          {actionTaken && !showModal && !callActive && (
            <div className="text-center text-sm text-muted-foreground animate-pulse">
              Registre o resultado para continuar...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attempt Modal */}
      {showModal && (
        <AttemptModal
          open={showModal}
          onClose={() => { setShowModal(false); setActionTaken(null); stopTimer(); }}
          onSubmit={handleResultSubmit}
          leadName={lead.nome}
          callDuration={actionTaken === "ligacao" ? callTimer : undefined}
        />
      )}
    </div>
  );
}
