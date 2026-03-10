import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import EmpreendimentoCombobox from "@/components/ui/empreendimento-combobox";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { supabase } from "@/integrations/supabase/client";

export interface TransitionResult {
  leadId: string;
  targetStageId: string;
  observacao?: string;
  extraData?: Record<string, any>;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: PipelineLead;
  targetStage: PipelineStage;
  onConfirm: (result: TransitionResult) => void;
  onCancel: () => void;
}

// ─── Sem Contato ───
function SemContatoForm({ lead, onConfirm, targetStageId }: { lead: PipelineLead; onConfirm: (r: TransitionResult) => void; targetStageId: string }) {
  const [acoes, setAcoes] = useState<string[]>([]);
  const [obs, setObs] = useState("");

  const toggleAcao = (a: string) => setAcoes(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base flex items-center gap-2">📵 Registro de Ação — Sem Contato</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">Lead: <strong>{lead.nome}</strong></p>

      <div className="space-y-3">
        <div>
          <Label className="text-xs mb-2 block">Qual ação foi realizada? *</Label>
          <div className="space-y-2">
            {[
              { id: "ligacao", label: "📞 Liguei para o cliente" },
              { id: "whatsapp", label: "💬 Mandei WhatsApp" },
              { id: "email", label: "📧 Enviei e-mail" },
              { id: "sms", label: "📱 Enviei SMS" },
            ].map(a => (
              <div key={a.id} className="flex items-center gap-2">
                <Checkbox checked={acoes.includes(a.id)} onCheckedChange={() => toggleAcao(a.id)} id={`acao-${a.id}`} />
                <Label htmlFor={`acao-${a.id}`} className="text-xs cursor-pointer">{a.label}</Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs">Observação</Label>
          <Textarea value={obs} onChange={e => setObs(e.target.value)} className="text-xs h-20" placeholder="Ex: Telefone tocou mas não atendeu..." />
        </div>
      </div>

      <DialogFooter>
        <Button
          size="sm"
          className="text-xs gap-1"
          disabled={acoes.length === 0}
          onClick={() => onConfirm({
            leadId: lead.id,
            targetStageId,
            observacao: `Ações: ${acoes.map(a => a === "ligacao" ? "Ligou" : a === "whatsapp" ? "WhatsApp" : a === "email" ? "E-mail" : "SMS").join(", ")}${obs ? ` | ${obs}` : ""}`,
            extraData: { acoes, observacao: obs },
          })}
        >
          📵 Confirmar e registrar
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Contato Inicial ───
function ContatoInicialForm({ lead, onConfirm, targetStageId }: { lead: PipelineLead; onConfirm: (r: TransitionResult) => void; targetStageId: string }) {
  const [retorno, setRetorno] = useState("");
  const [obs, setObs] = useState("");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base flex items-center gap-2">📞 Retorno do Contato Inicial</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">Lead: <strong>{lead.nome}</strong></p>

      <div className="space-y-3">
        <div>
          <Label className="text-xs mb-2 block">O cliente respondeu? *</Label>
          <RadioGroup value={retorno} onValueChange={setRetorno} className="space-y-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="atendeu_ligacao" id="ret-lig" />
              <Label htmlFor="ret-lig" className="text-xs cursor-pointer">📞 Atendeu ligação</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="respondeu_whatsapp" id="ret-wpp" />
              <Label htmlFor="ret-wpp" className="text-xs cursor-pointer">💬 Respondeu WhatsApp</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="respondeu_email" id="ret-email" />
              <Label htmlFor="ret-email" className="text-xs cursor-pointer">📧 Respondeu e-mail</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="retornou_ligacao" id="ret-retornou" />
              <Label htmlFor="ret-retornou" className="text-xs cursor-pointer">📲 Retornou a ligação</Label>
            </div>
          </RadioGroup>
        </div>
        <div>
          <Label className="text-xs">Observação sobre o contato</Label>
          <Textarea value={obs} onChange={e => setObs(e.target.value)} className="text-xs h-20" placeholder="O que foi conversado no primeiro contato..." />
        </div>
      </div>

      <DialogFooter>
        <Button
          size="sm"
          className="text-xs gap-1"
          disabled={!retorno}
          onClick={() => {
            const retornoLabel = retorno === "atendeu_ligacao" ? "Atendeu ligação" : retorno === "respondeu_whatsapp" ? "Respondeu WhatsApp" : retorno === "respondeu_email" ? "Respondeu e-mail" : "Retornou ligação";
            onConfirm({
              leadId: lead.id,
              targetStageId,
              observacao: `Contato: ${retornoLabel}${obs ? ` | ${obs}` : ""}`,
              extraData: { retorno, observacao: obs },
            });
          }}
        >
          📞 Confirmar contato
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Qualificação ───
function QualificacaoForm({ lead, onConfirm, targetStageId }: { lead: PipelineLead; onConfirm: (r: TransitionResult) => void; targetStageId: string }) {
  const [tipologia, setTipologia] = useState("");
  const [faixaValor, setFaixaValor] = useState("");
  const [regiao, setRegiao] = useState("");
  const [obs, setObs] = useState("");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base flex items-center gap-2">🎯 Perfil de Interesse — Qualificação</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">Lead: <strong>{lead.nome}</strong></p>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Tipologia de interesse</Label>
          <Select value={tipologia} onValueChange={setTipologia}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="apartamento_2q">Apartamento 2 quartos</SelectItem>
              <SelectItem value="apartamento_3q">Apartamento 3 quartos</SelectItem>
              <SelectItem value="apartamento_4q">Apartamento 4+ quartos</SelectItem>
              <SelectItem value="studio">Studio / Compacto</SelectItem>
              <SelectItem value="cobertura">Cobertura</SelectItem>
              <SelectItem value="casa">Casa</SelectItem>
              <SelectItem value="comercial">Comercial / Sala</SelectItem>
              <SelectItem value="terreno">Terreno / Lote</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Faixa de valor do imóvel</Label>
          <Select value={faixaValor} onValueChange={setFaixaValor}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ate_300k">Até R$ 300 mil</SelectItem>
              <SelectItem value="300k_500k">R$ 300 mil — R$ 500 mil</SelectItem>
              <SelectItem value="500k_800k">R$ 500 mil — R$ 800 mil</SelectItem>
              <SelectItem value="800k_1m">R$ 800 mil — R$ 1 milhão</SelectItem>
              <SelectItem value="1m_2m">R$ 1M — R$ 2M</SelectItem>
              <SelectItem value="acima_2m">Acima de R$ 2M</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Região preferida</Label>
          <Input value={regiao} onChange={e => setRegiao(e.target.value)} className="h-8 text-xs" placeholder="Ex: Centro, Zona Sul, Beira-mar..." />
        </div>
        <div>
          <Label className="text-xs">Observação</Label>
          <Textarea value={obs} onChange={e => setObs(e.target.value)} className="text-xs h-20" placeholder="Detalhes adicionais sobre o perfil do cliente..." />
        </div>
      </div>

      <DialogFooter>
        <Button
          size="sm"
          className="text-xs gap-1"
          onClick={() => {
            const parts: string[] = [];
            if (tipologia) parts.push(`Tipologia: ${tipologia.replace(/_/g, " ")}`);
            if (faixaValor) parts.push(`Valor: ${faixaValor.replace(/_/g, " ")}`);
            if (regiao) parts.push(`Região: ${regiao}`);
            if (obs) parts.push(obs);
            onConfirm({
              leadId: lead.id,
              targetStageId,
              observacao: `Qualificação: ${parts.join(" | ")}`,
              extraData: { tipologia, faixaValor, regiao, observacao: obs },
            });
          }}
        >
          🎯 Confirmar qualificação
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Possível Visita ───
function PossivelVisitaForm({ lead, onConfirm, targetStageId }: { lead: PipelineLead; onConfirm: (r: TransitionResult) => void; targetStageId: string }) {
  const [imovelTipo, setImovelTipo] = useState<"empreendimento" | "jetimob" | "manual">("empreendimento");
  const [empreendimento, setEmpreendimento] = useState(lead.empreendimento || "");
  const [codigoJetimob, setCodigoJetimob] = useState("");
  const [imovelManual, setImovelManual] = useState("");
  const [faltaParaMarcar, setFaltaParaMarcar] = useState("");
  const [obs, setObs] = useState("");

  const imovelEscolhido = imovelTipo === "empreendimento" ? empreendimento : imovelTipo === "jetimob" ? codigoJetimob : imovelManual;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base flex items-center gap-2">🏠 Possível Visita — Imóvel</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">Lead: <strong>{lead.nome}</strong></p>

      <div className="space-y-3">
        <div>
          <Label className="text-xs mb-2 block">Como identificar o imóvel?</Label>
          <RadioGroup value={imovelTipo} onValueChange={(v) => setImovelTipo(v as any)} className="flex gap-3">
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="empreendimento" id="iv-emp" />
              <Label htmlFor="iv-emp" className="text-xs cursor-pointer">🏗️ Empreendimento</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="jetimob" id="iv-jet" />
              <Label htmlFor="iv-jet" className="text-xs cursor-pointer">🔑 Código Jetimob</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="manual" id="iv-man" />
              <Label htmlFor="iv-man" className="text-xs cursor-pointer">✏️ Manual</Label>
            </div>
          </RadioGroup>
        </div>

        {imovelTipo === "empreendimento" && (
          <div>
            <Label className="text-xs">Empreendimento</Label>
            <EmpreendimentoCombobox value={empreendimento} onChange={setEmpreendimento} />
          </div>
        )}
        {imovelTipo === "jetimob" && (
          <div>
            <Label className="text-xs">Código do imóvel Jetimob</Label>
            <Input value={codigoJetimob} onChange={e => setCodigoJetimob(e.target.value)} className="h-8 text-xs" placeholder="Ex: JET-12345" />
          </div>
        )}
        {imovelTipo === "manual" && (
          <div>
            <Label className="text-xs">Descrição do imóvel</Label>
            <Input value={imovelManual} onChange={e => setImovelManual(e.target.value)} className="h-8 text-xs" placeholder="Ex: Apto 3Q Av. Beira Mar, 1500" />
          </div>
        )}

        <div>
          <Label className="text-xs">O que falta para marcar a visita? *</Label>
          <Textarea value={faltaParaMarcar} onChange={e => setFaltaParaMarcar(e.target.value)} className="text-xs h-20" placeholder="Ex: Confirmar horário com o cliente, chave do imóvel..." />
        </div>
      </div>

      <DialogFooter>
        <Button
          size="sm"
          className="text-xs gap-1"
          disabled={!imovelEscolhido || !faltaParaMarcar.trim()}
          onClick={() => onConfirm({
            leadId: lead.id,
            targetStageId,
            observacao: `Possível Visita | Imóvel: ${imovelEscolhido} | Falta: ${faltaParaMarcar}`,
            extraData: { imovelTipo, imovel: imovelEscolhido, faltaParaMarcar, observacao: obs, empreendimento: imovelTipo === "empreendimento" ? empreendimento : undefined },
          })}
        >
          🏠 Confirmar possível visita
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Visita Marcada ───
function VisitaMarcadaForm({ lead, onConfirm, targetStageId }: { lead: PipelineLead; onConfirm: (r: TransitionResult) => void; targetStageId: string }) {
  const [local, setLocal] = useState("stand");
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [parceiro, setParceiro] = useState("");
  const [obs, setObs] = useState("");
  const [corretores, setCorretores] = useState<{ user_id: string; nome: string }[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("team_members").select("user_id, nome").eq("ativo", true) as any;
      if (data) setCorretores(data.filter((c: any) => c.user_id));
    };
    load();
  }, []);

  const LOCAL_OPTIONS = [
    { value: "stand", label: "🏗️ Stand do empreendimento" },
    { value: "empresa", label: "🏢 Escritório" },
    { value: "videochamada", label: "📹 Videochamada" },
    { value: "decorado", label: "🎨 Decorado" },
    { value: "imovel", label: "🔑 No imóvel específico" },
  ];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base flex items-center gap-2">📅 Agendar Visita</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">Cliente: <strong>{lead.nome}</strong> {lead.empreendimento && <Badge variant="outline" className="ml-1 text-[10px]">{lead.empreendimento}</Badge>}</p>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Local da visita *</Label>
          <Select value={local} onValueChange={setLocal}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LOCAL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Data *</Label>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Horário *</Label>
            <Input type="time" value={horario} onChange={e => setHorario(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Corretor parceiro (opcional)</Label>
          <Select value={parceiro} onValueChange={setParceiro}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Nenhum parceiro" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {corretores.map(c => <SelectItem key={c.user_id} value={c.user_id!}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Observação</Label>
          <Textarea value={obs} onChange={e => setObs(e.target.value)} className="text-xs h-16" placeholder="Detalhes da visita..." />
        </div>
      </div>

      <DialogFooter>
        <Button
          size="sm"
          className="text-xs gap-1"
          disabled={!data || !horario}
          onClick={() => onConfirm({
            leadId: lead.id,
            targetStageId,
            observacao: `Visita Marcada | ${data} ${horario} | Local: ${LOCAL_OPTIONS.find(o => o.value === local)?.label || local}${obs ? ` | ${obs}` : ""}`,
            extraData: { local, data, horario, parceiro: parceiro === "none" ? null : parceiro, observacao: obs, criarVisita: true },
          })}
        >
          📅 Confirmar e agendar visita
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Visita Realizada ───
function VisitaRealizadaForm({ lead, onConfirm, targetStageId }: { lead: PipelineLead; onConfirm: (r: TransitionResult) => void; targetStageId: string }) {
  const [feedback, setFeedback] = useState("");
  const [interesse, setInteresse] = useState("");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base flex items-center gap-2">✅ Feedback da Visita Realizada</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">Cliente: <strong>{lead.nome}</strong></p>

      <div className="space-y-3">
        <div>
          <Label className="text-xs mb-2 block">Nível de interesse do cliente *</Label>
          <RadioGroup value={interesse} onValueChange={setInteresse} className="space-y-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="muito_interessado" id="int-muito" />
              <Label htmlFor="int-muito" className="text-xs cursor-pointer">🔥 Muito interessado — quer proposta</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="interessado" id="int-sim" />
              <Label htmlFor="int-sim" className="text-xs cursor-pointer">👍 Interessado — pensando</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="morno" id="int-morno" />
              <Label htmlFor="int-morno" className="text-xs cursor-pointer">🤔 Morno — precisa de mais opções</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="sem_interesse" id="int-nao" />
              <Label htmlFor="int-nao" className="text-xs cursor-pointer">👎 Sem interesse após visita</Label>
            </div>
          </RadioGroup>
        </div>
        <div>
          <Label className="text-xs">Feedback da visita *</Label>
          <Textarea value={feedback} onChange={e => setFeedback(e.target.value)} className="text-xs h-24" placeholder="Como foi a visita? O que o cliente achou? Próximos passos..." />
        </div>
      </div>

      <DialogFooter>
        <Button
          size="sm"
          className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
          disabled={!interesse || !feedback.trim()}
          onClick={() => onConfirm({
            leadId: lead.id,
            targetStageId,
            observacao: `Visita Realizada | Interesse: ${interesse.replace(/_/g, " ")} | ${feedback}`,
            extraData: { interesse, feedback, criarNegocio: interesse === "muito_interessado" || interesse === "interessado" },
          })}
        >
          ✅ Confirmar visita realizada
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Descarte ───
function DescarteForm({ lead, onConfirm, targetStageId }: { lead: PipelineLead; onConfirm: (r: TransitionResult) => void; targetStageId: string }) {
  const [motivo, setMotivo] = useState("");
  const [empreendimento, setEmpreendimento] = useState(lead.empreendimento || "");
  const [listas, setListas] = useState<{ id: string; nome: string; empreendimento: string }[]>([]);
  const [listaId, setListaId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("oferta_ativa_listas").select("id, nome, empreendimento").eq("status", "ativa").then(({ data }) => {
      setListas(data || []);
      setLoading(false);
    });
  }, []);

  // Auto-select lista matching empreendimento
  useEffect(() => {
    if (empreendimento && listas.length > 0 && !listaId) {
      const match = listas.find(l => l.empreendimento.toLowerCase() === empreendimento.toLowerCase());
      if (match) setListaId(match.id);
    }
  }, [empreendimento, listas, listaId]);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base flex items-center gap-2">🗑️ Descarte — Enviar para Oferta Ativa</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">Lead: <strong>{lead.nome}</strong></p>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Motivo do descarte *</Label>
          <Select value={motivo} onValueChange={setMotivo}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione o motivo..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sem_interesse">Sem interesse</SelectItem>
              <SelectItem value="nao_atende">Não atende / não responde</SelectItem>
              <SelectItem value="sem_perfil">Sem perfil financeiro</SelectItem>
              <SelectItem value="comprou_outro">Comprou com outro</SelectItem>
              <SelectItem value="desistiu">Desistiu da compra</SelectItem>
              <SelectItem value="duplicado">Lead duplicado</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Empreendimento vinculado *</Label>
          <EmpreendimentoCombobox value={empreendimento} onChange={setEmpreendimento} />
          <p className="text-[10px] text-muted-foreground mt-1">Vincule ao empreendimento para direcionar à lista correta da Oferta Ativa</p>
        </div>
        <div>
          <Label className="text-xs">Lista da Oferta Ativa</Label>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="h-3 w-3 animate-spin" /> Carregando listas...</div>
          ) : listas.length === 0 ? (
            <p className="text-xs text-amber-600 py-1">Nenhuma lista ativa encontrada</p>
          ) : (
            <Select value={listaId} onValueChange={setListaId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione a lista..." /></SelectTrigger>
              <SelectContent>
                {listas.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome} ({l.empreendimento})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button
          size="sm"
          variant="destructive"
          className="text-xs gap-1"
          disabled={!motivo || !empreendimento}
          onClick={() => onConfirm({
            leadId: lead.id,
            targetStageId,
            observacao: `Descarte: ${motivo.replace(/_/g, " ")} | Empreendimento: ${empreendimento}`,
            extraData: { motivo, empreendimento, listaId: listaId || null, enviarOfertaAtiva: true },
          })}
        >
          🗑️ Confirmar descarte
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Main Component ───
export default function PipelineStageTransitionPopup({ open, onOpenChange, lead, targetStage, onConfirm, onCancel }: Props) {
  const handleClose = (v: boolean) => {
    if (!v) onCancel();
    onOpenChange(v);
  };

  const stageName = targetStage.nome.toLowerCase();

  const renderForm = () => {
    if (stageName.includes("sem contato")) {
      return <SemContatoForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageName.includes("contato inic") || stageName.includes("contato iniciado")) {
      return <ContatoInicialForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageName.includes("qualifica")) {
      return <QualificacaoForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageName.includes("poss") && stageName.includes("visita")) {
      return <PossivelVisitaForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageName.includes("visita marcada") || (stageName.includes("visita") && stageName.includes("marcad"))) {
      return <VisitaMarcadaForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageName.includes("visita realizada") || (stageName.includes("visita") && stageName.includes("realizad"))) {
      return <VisitaRealizadaForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageName.includes("descarte") || targetStage.tipo === "descarte") {
      return <DescarteForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md space-y-3 max-h-[85vh] overflow-y-auto">
        {renderForm()}
      </DialogContent>
    </Dialog>
  );
}

// Stages that need a transition popup
export function needsTransitionPopup(stageName: string, stageType: string): boolean {
  const name = stageName.toLowerCase();
  if (name.includes("sem contato")) return true;
  if (name.includes("contato inic") || name.includes("contato iniciado")) return true;
  if (name.includes("qualifica")) return true;
  if (name.includes("poss") && name.includes("visita")) return true;
  if (name.includes("visita marcada") || (name.includes("visita") && name.includes("marcad"))) return true;
  if (name.includes("visita realizada") || (name.includes("visita") && name.includes("realizad"))) return true;
  if (name.includes("descarte") || stageType === "descarte") return true;
  return false;
}
