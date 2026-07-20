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
import { fmtMoney } from "@/lib/fmtMoney";
import { NEGOCIACAO_SUBSTATUS, CONTRATO_SUBSTATUS, AQUECIMENTO_SUBSTATUS } from "@/lib/leadHelpers";

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

const SectionTitle = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold">{n}</span>
    {children}
  </div>
);

// ─── Qualificação ───
export const QUALIFICACAO_STATUS_ATEND: Record<string, string> = {
  contato_inicial: "Contato inicial",
  alinhamento_perfil: "Alinhamento de perfil",
  busca: "Busca de imóveis",
  envio_opcoes: "Envio de opções",
  follow_up: "Follow up",
  alinhando_visita: "Alinhando visita",
};
export const QUALIFICACAO_TIPOLOGIAS: { value: string; label: string }[] = [
  { value: "apartamento_2q", label: "Apto 2Q" },
  { value: "apartamento_3q", label: "Apto 3Q" },
  { value: "apartamento_4q", label: "Apto 4+Q" },
  { value: "studio", label: "Studio" },
  { value: "cobertura", label: "Cobertura" },
  { value: "casa", label: "Casa" },
  { value: "comercial", label: "Comercial" },
  { value: "terreno", label: "Terreno" },
];
export const QUALIFICACAO_FAIXAS: { value: string; label: string }[] = [
  { value: "ate_300k", label: "Até R$ 300 mil" },
  { value: "300k_500k", label: "R$ 300–500 mil" },
  { value: "500k_800k", label: "R$ 500–800 mil" },
  { value: "800k_1m", label: "R$ 800 mil – R$ 1M" },
  { value: "1m_2m", label: "R$ 1M – R$ 2M" },
  { value: "acima_2m", label: "Acima de R$ 2M" },
];
export const QUALIFICACAO_FORMAS_PAGAMENTO: { value: string; label: string }[] = [
  { value: "a_vista", label: "À vista" },
  { value: "financiamento", label: "Financiamento" },
  { value: "fgts", label: "FGTS" },
  { value: "consorcio", label: "Consórcio" },
  { value: "nao_sei", label: "Não sei ainda" },
];
export const QUALIFICACAO_PRAZOS: { value: string; label: string }[] = [
  { value: "imediato", label: "Imediato" },
  { value: "ate_30_dias", label: "Até 30 dias" },
  { value: "30_90_dias", label: "30–90 dias" },
  { value: "sem_prazo", label: "Sem prazo definido" },
];
export const QUALIFICACAO_BAIRROS_UHOME: string[] = [
  "Moinhos de Vento",
  "Petrópolis",
  "Bela Vista",
  "Três Figueiras",
  "Auxiliadora",
  "Mont'Serrat",
  "Menino Deus",
];

// Componente reutilizável de "chip toggle" (single-select)
function ChipRow({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(active ? "" : o.value)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border text-foreground"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Chip multi-select
function ChipMulti({ values, onToggle, options }: { values: string[]; onToggle: (v: string) => void; options: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const active = values.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border text-foreground"}`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function QualificacaoForm({ lead, onConfirm, targetStageId }: { lead: PipelineLead; onConfirm: (r: TransitionResult) => void; targetStageId: string }) {
  const flag = ((lead as any)?.flag_status || {}) as Record<string, any>;
  const [statusAtend, setStatusAtend] = useState<string>((flag.status_atendimento as string) || "contato_inicial");
  const [tipologia, setTipologia] = useState<string>((flag.tipologia as string) || "");
  const [faixaValor, setFaixaValor] = useState<string>(((lead as any)?.faixa_valor as string) || "");
  const [formaPagamento, setFormaPagamento] = useState<string>(((lead as any)?.forma_pagamento as string) || "");
  const [prazoDecisao, setPrazoDecisao] = useState<string>(((lead as any)?.prazo_decisao as string) || "");
  const bairroInicial: string[] = (() => {
    const raw = ((lead as any)?.bairro_regiao as string) || "";
    if (!raw) return [];
    return raw.split(",").map(s => s.trim()).filter(Boolean).filter(b => QUALIFICACAO_BAIRROS_UHOME.includes(b));
  })();
  const outroInicial: string = (() => {
    const raw = ((lead as any)?.bairro_regiao as string) || "";
    if (!raw) return "";
    const fora = raw.split(",").map(s => s.trim()).filter(Boolean).filter(b => !QUALIFICACAO_BAIRROS_UHOME.includes(b));
    return fora.join(", ");
  })();
  const [bairros, setBairros] = useState<string[]>(bairroInicial);
  const [outroSelecionado, setOutroSelecionado] = useState<boolean>(!!outroInicial);
  const [outroBairro, setOutroBairro] = useState<string>(outroInicial);
  const [obs, setObs] = useState("");

  const toggleBairro = (b: string) => setBairros(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);

  const bairrosFinal = [
    ...bairros,
    ...(outroSelecionado && outroBairro.trim() ? [outroBairro.trim()] : []),
  ];
  const bairroStr = bairrosFinal.join(", ");

  

  return (
    <div className="max-w-lg mx-auto w-full">
      <DialogHeader>
        <DialogTitle className="text-base flex items-center gap-2">🎯 Perfil de Interesse — Qualificação</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground mt-1">Lead: <strong>{lead.nome}</strong></p>

      <div className="space-y-3 mt-3">
        {/* 1. Status */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
          <SectionTitle n={1}>Status do atendimento *</SectionTitle>
          <Select value={statusAtend} onValueChange={setStatusAtend}>
            <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {Object.entries(QUALIFICACAO_STATUS_ATEND).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 2. O que ele procura */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
          <SectionTitle n={2}>O que ele procura</SectionTitle>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Tipologia</Label>
            <ChipRow value={tipologia} onChange={setTipologia} options={QUALIFICACAO_TIPOLOGIAS} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Faixa de valor</Label>
            <ChipRow value={faixaValor} onChange={setFaixaValor} options={QUALIFICACAO_FAIXAS} />
          </div>
        </div>

        {/* 3. Como e quando */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
          <SectionTitle n={3}>Como e quando</SectionTitle>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Forma de pagamento</Label>
            <ChipRow value={formaPagamento} onChange={setFormaPagamento} options={QUALIFICACAO_FORMAS_PAGAMENTO} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Prazo de decisão</Label>
            <ChipRow value={prazoDecisao} onChange={setPrazoDecisao} options={QUALIFICACAO_PRAZOS} />
          </div>
        </div>

        {/* 4. Onde */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
          <SectionTitle n={4}>Onde</SectionTitle>
          <Label className="text-xs font-medium">Região / bairros</Label>
          <ChipMulti values={bairros} onToggle={toggleBairro} options={QUALIFICACAO_BAIRROS_UHOME} />
          <div className="mt-1 flex items-center gap-2">
            <Checkbox
              id="qual-outro-bairro"
              checked={outroSelecionado}
              onCheckedChange={(v) => setOutroSelecionado(!!v)}
            />
            <Label htmlFor="qual-outro-bairro" className="text-[11px] cursor-pointer">Outro bairro</Label>
          </div>
          {outroSelecionado && (
            <Input
              value={outroBairro}
              onChange={e => setOutroBairro(e.target.value)}
              className="h-8 text-xs mt-1.5 bg-background"
              placeholder="Digite o(s) bairro(s), separados por vírgula"
            />
          )}
        </div>

        {/* 5. Observação */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
          <SectionTitle n={5}>Observação</SectionTitle>
          <Textarea value={obs} onChange={e => setObs(e.target.value)} className="text-xs h-20 bg-background" placeholder="Detalhes adicionais sobre o perfil do cliente..." />
        </div>
      </div>


      <DialogFooter>
        <Button
          size="sm"
          className="text-xs gap-1"
          onClick={() => {
            const tipologiaLabel = QUALIFICACAO_TIPOLOGIAS.find(t => t.value === tipologia)?.label;
            const faixaLabel = QUALIFICACAO_FAIXAS.find(f => f.value === faixaValor)?.label;
            const formaLabel = QUALIFICACAO_FORMAS_PAGAMENTO.find(f => f.value === formaPagamento)?.label;
            const prazoLabel = QUALIFICACAO_PRAZOS.find(p => p.value === prazoDecisao)?.label;
            const parts: string[] = [`Status: ${QUALIFICACAO_STATUS_ATEND[statusAtend]}`];
            if (tipologiaLabel) parts.push(`Tipologia: ${tipologiaLabel}`);
            if (faixaLabel) parts.push(`Valor: ${faixaLabel}`);
            if (formaLabel) parts.push(`Pagamento: ${formaLabel}`);
            if (prazoLabel) parts.push(`Prazo: ${prazoLabel}`);
            if (bairroStr) parts.push(`Região: ${bairroStr}`);
            if (obs) parts.push(obs);
            onConfirm({
              leadId: lead.id,
              targetStageId,
              observacao: `Atendimento: ${parts.join(" | ")}`,
              extraData: {
                statusAtendimento: statusAtend,
                tipologia,
                faixaValor,
                formaPagamento,
                prazoDecisao,
                bairroRegiao: bairroStr,
                observacao: obs,
              },
            });
          }}
        >
          🎯 Confirmar qualificação
        </Button>
      </DialogFooter>
    </div>

  );
}

// ─── Possível Visita ───
function AquecimentoForm({ lead, onConfirm, targetStageId }: { lead: PipelineLead; onConfirm: (r: TransitionResult) => void; targetStageId: string }) {
  const [prazo, setPrazo] = useState<string>(((lead as any)?.flag_status?.prazo as string) || "30");
  const [obs, setObs] = useState("");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base flex items-center gap-2">🔥 Aquecimento / Nutrição</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground mt-1">Lead: <strong>{lead.nome}</strong></p>
      <p className="text-[10px] text-muted-foreground">Defina quando retomar o contato — aparece no card.</p>

      <div className="space-y-3 mt-3">
        {/* 1. Quando retomar */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
          <SectionTitle n={1}>Quando retomar? *</SectionTitle>
          <Select value={prazo} onValueChange={setPrazo}>
            <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {AQUECIMENTO_SUBSTATUS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* 2. Observação */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
          <SectionTitle n={2}>Observação</SectionTitle>
          <Textarea value={obs} onChange={e => setObs(e.target.value)} className="text-xs h-20 bg-background" placeholder="Motivo do aquecimento, próximos passos..." />
        </div>
      </div>

      <DialogFooter>
        <Button
          size="sm"
          className="text-xs gap-1"
          onClick={() => onConfirm({
            leadId: lead.id,
            targetStageId,
            observacao: `Aquecimento — retomar em ${prazo}D${obs ? ` | ${obs}` : ""}`,
            extraData: { prazoRetomar: prazo, observacao: obs },
          })}
        >
          🔥 Confirmar
        </Button>
      </DialogFooter>
    </>
  );
}

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
  const [responsavel, setResponsavel] = useState("corretor");
  const [parceiro, setParceiro] = useState("");
  const [obs, setObs] = useState("");
  const [empreendimento, setEmpreendimento] = useState(lead.empreendimento || "");
  const [corretores, setCorretores] = useState<{ user_id: string; nome: string }[]>([]);
  const [empreendimentos, setEmpreendimentos] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("team_members").select("user_id, nome").eq("status", "ativo");
      if (data) setCorretores(data.filter((c: any) => c.user_id));
      
      const { data: empData } = await supabase.from("empreendimento_overrides").select("nome, codigo");
      if (empData) {
        const nomes = empData.map((e: any) => e.nome || e.codigo).filter(Boolean);
        const unique = [...new Set(nomes)] as string[];
        setEmpreendimentos(unique.sort());
      }
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

  const RESPONSAVEL_OPTIONS = [
    { value: "gerente", label: "👔 Gerente" },
    { value: "corretor", label: "🧑‍💼 Próprio corretor" },
    { value: "parceiro", label: "🤝 Corretor parceiro" },
    { value: "especialista", label: "🏗️ Especialista da construtora" },
  ];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base flex items-center gap-2">📅 Agendar Visita</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">Cliente: <strong>{lead.nome}</strong> {lead.empreendimento && <Badge variant="outline" className="ml-1 text-[10px]">{lead.empreendimento}</Badge>}</p>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Empreendimento *</Label>
          <Select value={empreendimento} onValueChange={setEmpreendimento}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione o empreendimento" /></SelectTrigger>
            <SelectContent>
              {empreendimentos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              {empreendimento && !empreendimentos.includes(empreendimento) && (
                <SelectItem value={empreendimento}>{empreendimento}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
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
          <Label className="text-xs">Responsável pela visita</Label>
          <Select value={responsavel} onValueChange={setResponsavel}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RESPONSAVEL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
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
          disabled={!data || !horario || !empreendimento}
          onClick={() => onConfirm({
            leadId: lead.id,
            targetStageId,
            observacao: `Visita Marcada | ${data} ${horario} | Empreendimento: ${empreendimento} | Local: ${LOCAL_OPTIONS.find(o => o.value === local)?.label || local} | Responsável: ${RESPONSAVEL_OPTIONS.find(o => o.value === responsavel)?.label || responsavel}${obs ? ` | ${obs}` : ""}`,
            extraData: { local, data, horario, responsavel, parceiro: parceiro === "none" ? null : parceiro, observacao: obs, empreendimento, criarVisita: true },
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
            extraData: { interesse, feedback, registrarVisitaRealizada: true },
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

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base flex items-center gap-2">🗑️ Descarte — Enviar para Oferta Ativa</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">Lead: <strong>{lead.nome}</strong></p>
      <p className="text-[10px] text-muted-foreground">O lead será removido do pipeline e enviado automaticamente para a lista da Oferta Ativa do empreendimento selecionado.</p>

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
          <p className="text-[10px] text-muted-foreground mt-1">O sistema encontrará automaticamente a lista da Oferta Ativa correspondente</p>
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
            extraData: { motivo, empreendimento, enviarOfertaAtiva: true },
          })}
        >
          🗑️ Confirmar descarte
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Caiu (queda do negócio) ───
function CaiuForm({ lead, onConfirm, targetStageId }: { lead: PipelineLead; onConfirm: (r: TransitionResult) => void; targetStageId: string }) {
  const [motivo, setMotivo] = useState("");
  const [destino, setDestino] = useState<"descarte" | "inativar">("descarte");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base flex items-center gap-2">💔 Negócio caiu</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">Negócio: <strong>{lead.nome}</strong></p>
      <p className="text-[10px] text-muted-foreground">Registre o motivo e escolha o destino do lead. O negócio ficará salvo como perdido (histórico e PDN).</p>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Motivo da queda *</Label>
          <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} className="text-xs h-20" placeholder="Ex: cliente não aprovou crédito, comprou com outro, desistiu..." />
        </div>
        <div>
          <Label className="text-xs mb-2 block">Destino do lead *</Label>
          <RadioGroup value={destino} onValueChange={(v) => setDestino(v as "descarte" | "inativar")} className="space-y-2">
            <div className="flex items-start gap-2">
              <RadioGroupItem value="descarte" id="caiu-descarte" className="mt-0.5" />
              <Label htmlFor="caiu-descarte" className="text-xs cursor-pointer font-normal">
                🗑️ <strong>Descartar</strong> — vai para Descarte, reengajável por nutrição/oferta ativa
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="inativar" id="caiu-inativar" className="mt-0.5" />
              <Label htmlFor="caiu-inativar" className="text-xs cursor-pointer font-normal">
                🚫 <strong>Inativar</strong> — arquiva o lead definitivamente
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <DialogFooter>
        <Button
          size="sm"
          variant="destructive"
          className="text-xs gap-1"
          disabled={!motivo.trim()}
          onClick={() => onConfirm({
            leadId: lead.id,
            targetStageId,
            observacao: `Negócio caiu: ${motivo.trim()} | Destino: ${destino === "inativar" ? "Inativado" : "Descarte"}`,
            extraData: { queda: true, motivo: motivo.trim(), destino },
          })}
        >
          💔 Confirmar queda
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Negócio Criado (convertido) ───
function NegocioCriadoForm({ lead, onConfirm, targetStageId }: { lead: PipelineLead; onConfirm: (r: TransitionResult) => void; targetStageId: string }) {
  const [vgv, setVgv] = useState<string>(lead.valor_estimado ? String(lead.valor_estimado) : "");
  const [empreendimento, setEmpreendimento] = useState(lead.empreendimento || "");
  const [obs, setObs] = useState("");

  const vgvNumber = Number(vgv.replace(/\./g, "").replace(",", ".")) || 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base flex items-center gap-2">🤝 Criar Negócio</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">Lead: <strong>{lead.nome}</strong></p>
      <p className="text-[10px] text-muted-foreground">Confirme os dados antes de criar o negócio. Esta ação é manual e não pode ser revertida automaticamente.</p>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">VGV estimado (R$) *</Label>
          <Input
            type="text"
            inputMode="decimal"
            value={vgv}
            onChange={e => setVgv(e.target.value)}
            placeholder="Ex: 850000"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Empreendimento</Label>
          <EmpreendimentoCombobox value={empreendimento} onChange={setEmpreendimento} />
        </div>
        <div>
          <Label className="text-xs">Observação</Label>
          <Textarea value={obs} onChange={e => setObs(e.target.value)} className="text-xs h-20" placeholder="Detalhes do negócio (unidade, condições, etc.)" />
        </div>
      </div>

      <DialogFooter>
        <Button
          size="sm"
          className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
          disabled={vgvNumber <= 0}
          onClick={() => onConfirm({
            leadId: lead.id,
            targetStageId,
            observacao: `Negócio Criado | VGV: ${fmtMoney(vgvNumber, "exact")} | Empreendimento: ${empreendimento || "—"}${obs ? ` | ${obs}` : ""}`,
            extraData: { criarNegocio: true, vgv: vgvNumber, empreendimento, observacao: obs },
          })}
        >
          🤝 Confirmar e criar negócio
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Proposta / Negociação ───
function PropostaForm({ lead, onConfirm, targetStageId }: { lead: PipelineLead; onConfirm: (r: TransitionResult) => void; targetStageId: string }) {
  const [valor, setValor] = useState<string>(lead.valor_estimado ? String(lead.valor_estimado) : "");
  const [empreendimento, setEmpreendimento] = useState(lead.empreendimento || "");
  const [unidade, setUnidade] = useState("");
  const [statusNeg, setStatusNeg] = useState<string>(((lead as any)?.flag_status?.status_negociacao as string) || "proposta_enviada");
  const [obs, setObs] = useState("");
  const valorNum = Number(valor.replace(/\./g, "").replace(",", ".")) || 0;

  return (
    <div className="max-w-lg mx-auto w-full">
      <DialogHeader>
        <DialogTitle className="text-base flex items-center gap-2">🤝 Em Negociação</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground mt-1">Lead: <strong>{lead.nome}</strong></p>
      <p className="text-[10px] text-muted-foreground">Registre a negociação — fica salva no histórico do lead.</p>

      <div className="space-y-3 mt-3">
        {/* 1. Situação */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
          <SectionTitle n={1}>Situação da negociação *</SectionTitle>
          <Select value={statusNeg} onValueChange={setStatusNeg}>
            <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {NEGOCIACAO_SUBSTATUS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* 2. Proposta */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
          <SectionTitle n={2}>Proposta</SectionTitle>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Valor da proposta (R$) *</Label>
            <Input type="text" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="Ex: 850000" className="h-8 text-xs bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Empreendimento</Label>
            <EmpreendimentoCombobox value={empreendimento} onChange={setEmpreendimento} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Unidade / imóvel</Label>
            <Input value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="Ex: Torre A, apto 1203" className="h-8 text-xs bg-background" />
          </div>
        </div>

        {/* 3. Detalhes */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
          <SectionTitle n={3}>Detalhes da proposta</SectionTitle>
          <Textarea value={obs} onChange={e => setObs(e.target.value)} className="text-xs h-20 bg-background" placeholder="Condições, entrada, forma de pagamento..." />
        </div>
      </div>


      <DialogFooter>
        <Button
          size="sm"
          className="text-xs gap-1"
          disabled={valorNum <= 0}
          onClick={() => {
            const subLabel = NEGOCIACAO_SUBSTATUS.find(o => o.value === statusNeg)?.label || "";
            onConfirm({
              leadId: lead.id,
              targetStageId,
              observacao: `${subLabel} — ${fmtMoney(valorNum, "exact")}${empreendimento ? ` | ${empreendimento}` : ""}${unidade ? ` | Unidade: ${unidade}` : ""}${obs ? ` | ${obs}` : ""}`,
              extraData: { criarNegocio: true, vgv: valorNum, empreendimento, unidade, observacao: obs, statusNegociacao: statusNeg },
            });
          }}
        >
          🤝 Confirmar
        </Button>
      </DialogFooter>
    </div>
  );
}


// ─── Aprovação / Documentação ───
function AprovacaoForm({ lead, onConfirm, targetStageId }: { lead: PipelineLead; onConfirm: (r: TransitionResult) => void; targetStageId: string }) {
  const [tipo, setTipo] = useState("");
  const [obs, setObs] = useState("");
  const TIPOS: Record<string, string> = {
    financiamento: "Análise de financiamento",
    credito: "Análise de crédito",
    proposta_construtora: "Proposta enviada à construtora",
    a_vista: "Pagamento à vista",
    fgts: "Uso de FGTS",
    outro: "Outro",
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base flex items-center gap-2">📑 Aprovação / Documentação</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">Lead: <strong>{lead.nome}</strong></p>
      <p className="text-[10px] text-muted-foreground">Qual aprovação/documentação está em andamento? Fica salva no histórico do lead.</p>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Tipo de aprovação *</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {Object.entries(TIPOS).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Observação</Label>
          <Textarea value={obs} onChange={e => setObs(e.target.value)} className="text-xs h-20" placeholder="Banco, status, prazo, pendências..." />
        </div>
      </div>

      <DialogFooter>
        <Button
          size="sm"
          className="text-xs gap-1"
          disabled={!tipo}
          onClick={() => onConfirm({
            leadId: lead.id,
            targetStageId,
            observacao: `Aprovação: ${TIPOS[tipo]}${obs ? ` | ${obs}` : ""}`,
            extraData: { aprovacaoTipo: tipo, observacao: obs },
          })}
        >
          📑 Confirmar aprovação
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Contrato Gerado ───
function ContratoForm({ lead, onConfirm, targetStageId }: { lead: PipelineLead; onConfirm: (r: TransitionResult) => void; targetStageId: string }) {
  const [unidade, setUnidade] = useState("");
  const [vgv, setVgv] = useState<string>(lead.valor_estimado ? String(lead.valor_estimado) : "");
  const [construtora, setConstrutora] = useState("");
  const [empreendimento, setEmpreendimento] = useState(lead.empreendimento || "");
  const [dataAssinatura, setDataAssinatura] = useState("");
  const [statusContrato, setStatusContrato] = useState<string>(((lead as any)?.flag_status?.status_contrato as string) || "em_confeccao");
  const [obs, setObs] = useState("");
  const vgvNum = Number(vgv.replace(/\./g, "").replace(",", ".")) || 0;

  const canConfirm = vgvNum > 0 && unidade.trim().length > 0;

  return (
    <div className="max-w-lg mx-auto w-full">
      <DialogHeader>
        <DialogTitle className="text-base flex items-center gap-2">📄 Contrato</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground mt-1">Lead: <strong>{lead.nome}</strong></p>
      <p className="text-[10px] text-muted-foreground">Registre os dados do contrato — ficam salvos no histórico do lead e no PDN.</p>

      <div className="space-y-3 mt-3">
        {/* 1. Situação */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
          <SectionTitle n={1}>Situação do contrato *</SectionTitle>
          <Select value={statusContrato} onValueChange={setStatusContrato}>
            <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {CONTRATO_SUBSTATUS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* 2. Contrato */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
          <SectionTitle n={2}>Contrato</SectionTitle>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Empreendimento</Label>
            <EmpreendimentoCombobox value={empreendimento} onChange={setEmpreendimento} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Unidade *</Label>
            <Input value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="Ex: Torre A, apto 1203" className="h-8 text-xs bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">VGV (R$) *</Label>
            <Input type="text" inputMode="decimal" value={vgv} onChange={e => setVgv(e.target.value)} placeholder="Ex: 850000" className="h-8 text-xs bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Construtora</Label>
            <Input value={construtora} onChange={e => setConstrutora(e.target.value)} placeholder="Ex: Melnick" className="h-8 text-xs bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Data de assinatura prevista</Label>
            <Input type="date" value={dataAssinatura} onChange={e => setDataAssinatura(e.target.value)} className="h-8 text-xs bg-background" />
          </div>
        </div>

        {/* 3. Observação */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
          <SectionTitle n={3}>Observação</SectionTitle>
          <Textarea value={obs} onChange={e => setObs(e.target.value)} className="text-xs h-20 bg-background" placeholder="Detalhes do contrato..." />
        </div>
      </div>

      <DialogFooter className="mt-3">
        <Button
          size="sm"
          className="text-xs gap-1"
          disabled={!canConfirm}
          onClick={() => onConfirm({
            leadId: lead.id,
            targetStageId,
            observacao: `Contrato (${CONTRATO_SUBSTATUS.find(o => o.value === statusContrato)?.label || statusContrato}) | Unidade: ${unidade} | VGV: ${fmtMoney(vgvNum, "exact")}${construtora ? ` | ${construtora}` : ""}${dataAssinatura ? ` | Assinatura: ${dataAssinatura}` : ""}${obs ? ` | ${obs}` : ""}`,
            extraData: { criarNegocio: true, vgv: vgvNum, empreendimento, unidade, construtora, dataContrato: dataAssinatura, observacao: obs, statusContrato },
          })}
        >
          📄 Confirmar contrato
        </Button>
      </DialogFooter>
    </div>
  );
}


export default function PipelineStageTransitionPopup({ open, onOpenChange, lead, targetStage, onConfirm, onCancel }: Props) {
  const handleClose = (v: boolean) => {
    if (!v) onCancel();
    onOpenChange(v);
  };

  const stageName = targetStage.nome.toLowerCase();
  const stageType = targetStage.tipo;

  const renderForm = () => {
    if (stageType === "sem_contato" || stageName.includes("sem contato")) {
      return <SemContatoForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageType === "contato_inicial" || stageName.includes("contato inic") || stageName.includes("contato iniciado")) {
      return <ContatoInicialForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageType === "busca" || stageType === "qualificacao" || stageName.includes("qualifica") || stageName.includes("busca")) {
      return <QualificacaoForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageType === "aquecimento" || stageName.includes("aquecimento") || stageName.includes("nutri")) {
      return <AquecimentoForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageType === "possibilidade_visita" || (stageName.includes("poss") && stageName.includes("visita"))) {
      return <PossivelVisitaForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageType === "visita" || stageType === "visita_marcada" || stageName === "visita" || stageName.includes("visita marcada")) {
      return <VisitaMarcadaForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageType === "pos_visita" || stageType === "visita_realizada" || stageName.includes("pós-visita") || stageName.includes("visita realizada")) {
      return <VisitaRealizadaForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageType === "proposta" || stageName.includes("proposta")) {
      return <PropostaForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageType === "documentacao" || stageName.includes("aprova") || stageName.includes("documenta")) {
      return <AprovacaoForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageType === "contrato_gerado" || stageName.includes("contrato")) {
      return <ContratoForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageType === "convertido" || stageName.includes("negócio criado") || stageName.includes("negocio criado")) {
      return <NegocioCriadoForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageType === "caiu" || stageName.includes("caiu")) {
      return <CaiuForm lead={lead} onConfirm={onConfirm} targetStageId={targetStage.id} />;
    }
    if (stageType === "descarte" || stageName.includes("descarte")) {
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
export function needsTransitionPopup(stageName: string, stageType: string, lead?: PipelineLead): boolean {
  const name = stageName.toLowerCase();

  // Use stageType as primary source of truth
  if (stageType === "sem_contato" || name.includes("sem contato")) return true;
  if (stageType === "contato_inicial" || name.includes("contato inic") || name.includes("contato iniciado")) return true;
  if (stageType === "busca" || stageType === "qualificacao" || name.includes("qualifica") || name.includes("busca")) return true;
  if (stageType === "aquecimento" || stageType === "possibilidade_visita" || (name.includes("poss") && name.includes("visita")) || name.includes("aquecimento")) return true;

  if (stageType === "visita" || name === "visita" || stageType === "visita_marcada" || name.includes("visita marcada")) {
    // Skip popup se o lead já tem visita marcada/agendada (flag definida pelo agendamento na Agenda)
    const flagStatus = (lead as any)?.flag_status as Record<string, any> | undefined;
    const statusVisita = flagStatus?.status_visita;
    if (statusVisita && ["marcada", "confirmada", "reagendada", "agendada"].includes(String(statusVisita))) {
      return false;
    }
    return true;
  }

  if (stageType === "pos_visita" || stageType === "visita_realizada" || name.includes("pós-visita") || name.includes("visita realizada")) return true;
  if (stageType === "proposta" || name.includes("proposta")) return true;
  if (stageType === "documentacao" || name.includes("aprova") || name.includes("documenta")) return true;
  if (stageType === "contrato_gerado" || name.includes("contrato")) return true;
  if (stageType === "convertido" || name.includes("negócio criado") || name.includes("negocio criado")) return true;
  if (stageType === "caiu" || name.includes("caiu")) return true;
  if (stageType === "descarte" || name.includes("descarte")) return true;
  return false;
}
