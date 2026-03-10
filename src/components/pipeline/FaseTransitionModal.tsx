import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Negocio } from "@/hooks/useNegocios";

export interface TransitionData {
  fase: string;
  fields: Record<string, any>;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetFase: string;
  negocio: Negocio;
  onConfirm: (data: TransitionData) => void;
}

// Format number as BRL currency: 900000 → "900.000,00"
function formatBRL(value: string): string {
  const num = value.replace(/\D/g, "");
  if (!num) return "";
  const cents = num.padStart(3, "0");
  const intPart = cents.slice(0, -2);
  const decPart = cents.slice(-2);
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formatted},${decPart}`;
}

// Parse formatted BRL back to raw cents string
function parseBRL(formatted: string): string {
  return formatted.replace(/\./g, "").replace(",", "");
}

// Get numeric value from raw cents string
function rawToNumber(raw: string): number {
  if (!raw) return 0;
  return parseInt(raw, 10) / 100;
}

function CurrencyInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder?: string; label: string }) {
  const display = value ? `R$ ${formatBRL(value)}` : "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    onChange(raw);
  };

  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        value={display}
        onChange={handleChange}
        className="h-8 text-xs"
        placeholder={placeholder || "R$ 0,00"}
        inputMode="numeric"
      />
    </div>
  );
}

export default function FaseTransitionModal({ open, onOpenChange, targetFase, negocio, onConfirm }: Props) {
  // Proposta fields
  const [propImovel, setPropImovel] = useState(negocio.empreendimento || "");
  const [propValorImovel, setPropValorImovel] = useState("");
  const [propValorProposta, setPropValorProposta] = useState(
    negocio.vgv_estimado ? String(Math.round(negocio.vgv_estimado * 100)) : ""
  );
  const [propUnidade, setPropUnidade] = useState("");
  const [propDocsStatus, setPropDocsStatus] = useState("sem_documentos");

  // Negociação fields
  const [negContraProposta, setNegContraProposta] = useState("");
  const [negObs, setNegObs] = useState("");

  // Contrato Gerado fields
  const [contImovel, setContImovel] = useState(negocio.empreendimento || "");
  const [contUnidade, setContUnidade] = useState("");
  const [contEndereco, setContEndereco] = useState("");
  const [contVgv, setContVgv] = useState(
    negocio.vgv_estimado ? String(Math.round(negocio.vgv_estimado * 100)) : ""
  );
  const [contTaxa, setContTaxa] = useState("5");
  const [contTaxaCustom, setContTaxaCustom] = useState("");
  const [contDataAssinatura, setContDataAssinatura] = useState("");

  // Assinado fields
  const [assDigital, setAssDigital] = useState("digital");
  const [assAtoPago, setAssAtoPago] = useState("sim");
  const [assObs, setAssObs] = useState("");

  // Caiu fields
  const [caiuMotivo, setCaiuMotivo] = useState("");
  const [caiuDestino, setCaiuDestino] = useState<"pipeline" | "descarte">("pipeline");

  const handleConfirm = () => {
    if (targetFase === "proposta") {
      onConfirm({
        fase: "proposta",
        fields: {
          imovel: propImovel,
          valor_imovel: rawToNumber(propValorImovel),
          valor_proposta: rawToNumber(propValorProposta),
          unidade: propUnidade,
          docs_status: propDocsStatus,
        },
      });
    } else if (targetFase === "negociacao") {
      onConfirm({
        fase: "negociacao",
        fields: { valor_contra_proposta: rawToNumber(negContraProposta), observacoes: negObs },
      });
    } else if (targetFase === "documentacao") {
      const taxa = contTaxa === "custom" ? contTaxaCustom : contTaxa;
      onConfirm({
        fase: "documentacao",
        fields: {
          imovel: contImovel,
          unidade: contUnidade,
          endereco: contEndereco,
          vgv: rawToNumber(contVgv),
          taxa_corretagem: taxa,
          data_assinatura: contDataAssinatura,
        },
      });
    } else if (targetFase === "assinado") {
      onConfirm({
        fase: "assinado",
        fields: { tipo_assinatura: assDigital, ato_pago: assAtoPago, observacoes: assObs },
      });
    } else if (targetFase === "distrato") {
      if (!caiuMotivo.trim()) return;
      onConfirm({
        fase: "distrato",
        fields: { motivo: caiuMotivo, destino: caiuDestino },
      });
    }
  };

  const renderContent = () => {
    switch (targetFase) {
      case "proposta":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">📋 Dados da Proposta</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">Negócio: <strong>{negocio.nome_cliente}</strong></p>
            <div className="space-y-3">
              <div><Label className="text-xs">Imóvel / Empreendimento</Label><Input value={propImovel} onChange={e => setPropImovel(e.target.value)} className="h-8 text-xs" /></div>
              <CurrencyInput label="Valor do Imóvel (R$)" value={propValorImovel} onChange={setPropValorImovel} placeholder="R$ 900.000,00" />
              <CurrencyInput label="Valor da Proposta (R$)" value={propValorProposta} onChange={setPropValorProposta} placeholder="R$ 850.000,00" />
              <div><Label className="text-xs">Unidade</Label><Input value={propUnidade} onChange={e => setPropUnidade(e.target.value)} className="h-8 text-xs" placeholder="Ex: Apto 1201" /></div>
              <div>
                <Label className="text-xs mb-1 block">Documentos</Label>
                <RadioGroup value={propDocsStatus} onValueChange={setPropDocsStatus} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="enviados" id="docs-enviados" />
                    <Label htmlFor="docs-enviados" className="text-xs cursor-pointer">✅ Documentos enviados</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="parcialmente" id="docs-parcial" />
                    <Label htmlFor="docs-parcial" className="text-xs cursor-pointer">⚠️ Documentos parcialmente enviados</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="sem_documentos" id="docs-sem" />
                    <Label htmlFor="docs-sem" className="text-xs cursor-pointer">❌ Sem documentos</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" onClick={handleConfirm} className="text-xs gap-1">📋 Confirmar e mover para Proposta</Button>
            </DialogFooter>
          </>
        );

      case "negociacao":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">🤝 Dados da Negociação</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">Negócio: <strong>{negocio.nome_cliente}</strong></p>
            <div className="space-y-3">
              <CurrencyInput label="Valor da Contra Proposta (R$)" value={negContraProposta} onChange={setNegContraProposta} placeholder="R$ 440.000,00" />
              <div><Label className="text-xs">Observações Importantes</Label><Textarea value={negObs} onChange={e => setNegObs(e.target.value)} className="text-xs h-24" placeholder="Detalhes da negociação, condições, etc..." /></div>
            </div>
            <DialogFooter>
              <Button size="sm" onClick={handleConfirm} className="text-xs gap-1">🤝 Confirmar e mover para Negociação</Button>
            </DialogFooter>
          </>
        );

      case "documentacao":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">📄 Dados do Contrato</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">Negócio: <strong>{negocio.nome_cliente}</strong></p>
            <div className="space-y-3">
              <div><Label className="text-xs">Imóvel / Empreendimento</Label><Input value={contImovel} onChange={e => setContImovel(e.target.value)} className="h-8 text-xs" /></div>
              <div><Label className="text-xs">Unidade</Label><Input value={contUnidade} onChange={e => setContUnidade(e.target.value)} className="h-8 text-xs" placeholder="Ex: Apto 1201" /></div>
              <div><Label className="text-xs">Endereço</Label><Input value={contEndereco} onChange={e => setContEndereco(e.target.value)} className="h-8 text-xs" placeholder="Rua, nº, bairro..." /></div>
              <CurrencyInput label="VGV (R$)" value={contVgv} onChange={setContVgv} placeholder="R$ 2.000.000,00" />
              <div>
                <Label className="text-xs">Taxa de Corretagem</Label>
                <Select value={contTaxa} onValueChange={setContTaxa}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4%</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="6">6%</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
                {contTaxa === "custom" && (
                  <Input value={contTaxaCustom} onChange={e => setContTaxaCustom(e.target.value)} className="h-8 text-xs mt-2" placeholder="Ex: 4.5" type="number" step="0.1" />
                )}
              </div>
              <div><Label className="text-xs">Data da Assinatura</Label><Input value={contDataAssinatura} onChange={e => setContDataAssinatura(e.target.value)} type="date" className="h-8 text-xs" /></div>
            </div>
            <DialogFooter>
              <Button size="sm" onClick={handleConfirm} className="text-xs gap-1">📄 Confirmar e mover para Contrato Gerado</Button>
            </DialogFooter>
          </>
        );

      case "assinado":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">✅ Confirmação de Assinatura</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">Negócio: <strong>{negocio.nome_cliente}</strong></p>
            <div className="space-y-4">
              <div>
                <Label className="text-xs mb-2 block">Tipo de Assinatura</Label>
                <RadioGroup value={assDigital} onValueChange={setAssDigital} className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="digital" id="ass-digital" />
                    <Label htmlFor="ass-digital" className="text-xs cursor-pointer">🖊️ Digital</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="fisico" id="ass-fisico" />
                    <Label htmlFor="ass-fisico" className="text-xs cursor-pointer">📝 Físico</Label>
                  </div>
                </RadioGroup>
              </div>
              <div>
                <Label className="text-xs mb-2 block">Ato pago?</Label>
                <RadioGroup value={assAtoPago} onValueChange={setAssAtoPago} className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="sim" id="ato-sim" />
                    <Label htmlFor="ato-sim" className="text-xs cursor-pointer">✅ Sim</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="nao" id="ato-nao" />
                    <Label htmlFor="ato-nao" className="text-xs cursor-pointer">❌ Não</Label>
                  </div>
                </RadioGroup>
              </div>
              <div><Label className="text-xs">Observações</Label><Textarea value={assObs} onChange={e => setAssObs(e.target.value)} className="text-xs h-20" placeholder="Observações importantes sobre a assinatura..." /></div>
            </div>
            <DialogFooter>
              <Button size="sm" onClick={handleConfirm} className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700">✅ Confirmar Assinatura 🎉</Button>
            </DialogFooter>
          </>
        );

      case "distrato":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">❌ Negócio Caiu</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">Negócio: <strong>{negocio.nome_cliente}</strong></p>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Motivo da queda *</Label>
                <Textarea value={caiuMotivo} onChange={e => setCaiuMotivo(e.target.value)} className="text-xs h-24" placeholder="Explique o motivo da queda do negócio..." />
                {!caiuMotivo.trim() && <p className="text-[10px] text-red-400 mt-1">Obrigatório informar o motivo</p>}
              </div>
              <div>
                <Label className="text-xs mb-2 block">O que fazer com o lead?</Label>
                <RadioGroup value={caiuDestino} onValueChange={(v) => setCaiuDestino(v as "pipeline" | "descarte")} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="pipeline" id="dest-pipeline" />
                    <Label htmlFor="dest-pipeline" className="text-xs cursor-pointer">🔄 Voltar para Pipeline de Leads</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="descarte" id="dest-descarte" />
                    <Label htmlFor="dest-descarte" className="text-xs cursor-pointer">🗑️ Descartar para Oferta Ativa</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" variant="destructive" onClick={handleConfirm} className="text-xs gap-1" disabled={!caiuMotivo.trim()}>
                ❌ Confirmar queda
              </Button>
            </DialogFooter>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md space-y-3">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
