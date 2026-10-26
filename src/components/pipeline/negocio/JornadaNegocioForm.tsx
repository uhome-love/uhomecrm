import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Save, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useJornadaNegocio } from "@/hooks/useJornadaNegocio";
import { CONTRATO_SUBSTATUS, NEGOCIACAO_SUBSTATUS } from "@/lib/leadHelpers";
import { jornadaPodeSalvar, lerDocumentos, situacaoAutoritativa, valorSugerido, type DocumentosNegocio } from "@/lib/jornadaNegocio";
import { numberToRawCurrency, parseCurrencyToNumber } from "@/utils/currencyFormat";
import { PropostaCampos } from "./PropostaCampos";
import type { EmpreendimentoVenda } from "@/hooks/useConfirmarVenda";
import { DocumentosChecklist } from "./DocumentosChecklist";
import { ContratoIntermediacao } from "./ContratoIntermediacao";
import { toast } from "sonner";

interface Props { leadId: string; etapaId: string; tipo: string; mover?: boolean; onSaved: () => void; onCancel: () => void }
export function JornadaNegocioForm({ leadId, etapaId, tipo, mover = true, onSaved, onCancel }: Props) {
  const dados = useJornadaNegocio(leadId);
  const cache = useQueryClient();
  const [empId, setEmpId] = useState("");
  const [extras, setExtras] = useState<EmpreendimentoVenda[]>([]);
  const [unidade, setUnidade] = useState("");
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState(tipo === "contrato_gerado" ? "em_confeccao" : tipo === "documentacao" ? "documentacao_enviada" : "proposta_enviada");
  const [documentos, setDocumentos] = useState<DocumentosNegocio>(lerDocumentos(null));
  const [previsao, setPrevisao] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const [saving, setSaving] = useState(false);
  const init = useRef(false);
  const lock = useRef(false);
  const contrato = tipo === "contrato_gerado";
  useEffect(() => {
    if (!dados.data || dados.isFetching || init.current) return;
    init.current = true;
    const { negocio: n, lead: l, empreendimentos } = dados.data;
    const flags = l.flag_status && typeof l.flag_status === "object" && !Array.isArray(l.flag_status) ? l.flag_status : {};
    const jornada = n?.jornada && typeof n.jornada === "object" && !Array.isArray(n.jornada) ? n.jornada : {};
    setEmpId(n?.empreendimento_canonico_id ?? l.empreendimento_canonico_id ?? empreendimentos.find(e => e.nome === l.empreendimento)?.id ?? "");
    setUnidade(n?.unidade ?? "");
    setValor(numberToRawCurrency(valorSugerido(n, l.valor_estimado ?? 0)));
    setDocumentos(lerDocumentos(jornada.documentos));
    setPrevisao(typeof jornada.previsao_assinatura === "string" ? jornada.previsao_assinatura : "");
    setObs(n?.observacoes ?? "");
    const flag = situacaoAutoritativa(contrato, n, contrato ? flags.status_contrato : flags.status_negociacao);
    const options = contrato ? CONTRATO_SUBSTATUS : NEGOCIACAO_SUBSTATUS;
    if (typeof flag === "string" && options.some(o => o.value === flag)) setStatus(flag);
  }, [dados.data, dados.isFetching, contrato]);

  async function salvar() {
    if (lock.current) return;
    lock.current = true; setSaving(true); setErro("");
    try {
      const result = await supabase.rpc("registrar_jornada_negocio", { p_lead_id: leadId, p_etapa_id: etapaId, p_mover: mover,
        p_dados: { empreendimentoId: empId, unidade: unidade.trim(), valorProposta: parseCurrencyToNumber(valor), status, documentos: { ...documentos }, previsaoAssinatura: previsao || null, observacao: obs.trim() } });
      if (result.error) throw result.error;
      await Promise.all([cache.invalidateQueries({ queryKey: ["jornada-negocio", leadId] }), cache.invalidateQueries({ queryKey: ["negocios-board"] })]);
      window.dispatchEvent(new CustomEvent("pipeline-reload"));
      toast.success(contrato ? "Contrato atualizado." : tipo === "documentacao" ? "Conferência salva." : "Proposta salva.");
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String((e as { message?: string }).message ?? "Não foi possível salvar a jornada.");
      setErro(msg);
      void supabase.from("ops_events").insert({ fn: "registrar_jornada_negocio", level: "error", category: "crm", message: "Falha ao salvar jornada do negócio", error_detail: msg, ctx: { pipeline_lead_id: leadId, tipo } });
    }
    finally { lock.current = false; setSaving(false); }
  }
  if (dados.isPending || (dados.isFetching && !init.current)) return <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-primary" /></div>;
  if (dados.error) return <div role="alert" className="space-y-3 text-sm text-destructive">Não foi possível carregar o negócio.<Button variant="outline" onClick={() => void dados.refetch()}><RefreshCw className="mr-2 size-4" />Tentar novamente</Button></div>;
  if (dados.data?.negocio?.fase === "ganho") return <p className="text-sm text-muted-foreground">Venda assinada. Consulte os dados em Vendas.</p>;
  const options = contrato ? CONTRATO_SUBSTATUS : NEGOCIACAO_SUBSTATUS;
  const valido = jornadaPodeSalvar(tipo, empId, unidade, parseCurrencyToNumber(valor));
  return <div className="space-y-5 min-w-0">
    <div className="flex items-center gap-2"><FileText className="size-5 text-primary" /><h3 className="font-semibold">{contrato ? "Contrato" : tipo === "documentacao" ? "Documentação" : "Proposta"}</h3></div>
    <p className="text-sm text-muted-foreground">{dados.data?.lead.nome}</p>
    <fieldset disabled={saving} className="space-y-5 min-w-0">
      <div className="space-y-1.5"><Label>Situação {contrato ? "do contrato" : "da negociação"}</Label><Select value={status} onValueChange={setStatus} disabled={saving}><SelectTrigger aria-label="Situação da jornada"><SelectValue /></SelectTrigger><SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
      <PropostaCampos empreendimentos={[...(dados.data?.empreendimentos ?? []), ...extras.filter(x => !dados.data?.empreendimentos.some(e => e.id === x.id))]} empreendimentoId={empId} onEmpreendimento={setEmpId} onCriado={e => setExtras(l => [...l, e])} unidade={unidade} onUnidade={setUnidade} valor={valor} onValor={setValor} disabled={saving} />
      {tipo === "documentacao" && <DocumentosChecklist value={documentos} onChange={setDocumentos} disabled={saving} />}
      {contrato && <><div className="space-y-1.5"><Label htmlFor="jornada-previsao">Previsão de assinatura</Label><Input type="date" id="jornada-previsao" value={previsao} onChange={e => setPrevisao(e.target.value)} /></div><ContratoIntermediacao leadId={leadId} /></>}
      <div className="space-y-1.5"><Label htmlFor="jornada-obs">{contrato ? "Observação" : "Condições / observação"}</Label><Textarea id="jornada-obs" value={obs} onChange={e => setObs(e.target.value)} rows={2} maxLength={5000} /></div>
    </fieldset>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button><Button onClick={() => void salvar()} disabled={saving || !valido}>{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}{contrato ? "Salvar contrato" : tipo === "documentacao" ? "Salvar conferência" : "Salvar proposta"}</Button></div>
  </div>;
}