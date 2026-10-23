import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FileSignature, Loader2, Paperclip, RefreshCw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirmarVenda } from "@/hooks/useConfirmarVenda";
import { supabase } from "@/integrations/supabase/client";
import { comprovantePermitido, pendenciasVenda } from "@/lib/vendaConfirmacao";
import { formatBRT } from "@/lib/brtTime";
import { handleCurrencyChange, formatCurrencyInput, parseCurrencyToNumber, numberToRawCurrency } from "@/utils/currencyFormat";
import { fmtMoney } from "@/lib/fmtMoney";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { valorSugerido } from "@/lib/jornadaNegocio";

interface Props { leadId: string; nome: string; valorEstimado?: number | null; empreendimento?: string | null; onConfirmed: () => void; onCancel: () => void }

export function ConfirmarVendaForm({ leadId, nome, valorEstimado, empreendimento, onConfirmed, onCancel }: Props) {
  const dados = useConfirmarVenda(leadId);
  const queryClient = useQueryClient();
  const { isGestor, isAdmin, isDiretor } = useUserRole();
  const [empId, setEmpId] = useState("");
  const [unidade, setUnidade] = useState("");
  const [valor, setValor] = useState(numberToRawCurrency(valorEstimado ?? 0));
  const [data, setData] = useState("");
  const [interId, setInterId] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [path, setPath] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const inicializado = useRef(false);
  const ocupado = useRef(false);
  const confirmado = useRef(false);
  const rascunho = useRef("");
  const hoje = formatBRT(new Date(), "yyyy-MM-dd");
  const emp = dados.empreendimentos.find(e => e.id === empId);
  const inter = dados.intermediacoes.find(i => i.id === interId);
  const vgv = parseCurrencyToNumber(valor);
  useEffect(() => {
    if (dados.loading || inicializado.current) return;
    inicializado.current = true;
    const n = dados.negocio;
    setEmpId(n?.empreendimento_canonico_id ?? dados.empreendimentos.find(e => e.nome === empreendimento)?.id ?? "");
    setUnidade(n?.unidade ?? "");
    setValor(numberToRawCurrency(valorSugerido(n, valorEstimado ?? 0)));
    setData(n?.data_assinatura ?? ""); setInterId(n?.intermediacao_id ?? ""); setPath(n?.comprovante_ato_path ?? "");
  }, [dados.loading, dados.negocio, dados.empreendimentos, empreendimento, valorEstimado]);

  const pendencias = pendenciasVenda({ empreendimentoCanonicoId: empId, construtora: emp?.construtora, unidade, vgvFinal: vgv, dataAssinatura: data, intermediacaoId: interId, comprovanteAtoPath: path || (arquivo ? "novo-anexo" : null) }, hoje);
  const unidadeDiferente = !!inter && inter.unidade?.trim().toLowerCase() !== unidade.trim().toLowerCase();
  const vgvDiferente = !!inter?.vgv && Math.abs(Number(inter.vgv) - vgv) > 0.01;
  useEffect(() => () => {
    if (rascunho.current && !confirmado.current) {
      void supabase.storage.from("vendas-docs").remove([rascunho.current]);
    }
  }, []);

  async function removerComprovante() {
    if (saving) return;
    if (rascunho.current) {
      const result = await supabase.storage.from("vendas-docs").remove([rascunho.current]);
      if (result.error) { setErro("Não foi possível remover o anexo. Tente novamente."); return; }
      rascunho.current = "";
    }
    setArquivo(null); setPath("");
    if (input.current) input.current.value = "";
  }

  async function confirmar() {
    if (ocupado.current || pendencias.length || unidadeDiferente) return;
    ocupado.current = true; setSaving(true); setErro(null);
    try {
      let comprovante = path;
      if (arquivo && !path) {
        const ext = ({ "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[arquivo.type];
        comprovante = `lead/${leadId}/${crypto.randomUUID()}.${ext}`;
        const upload = await supabase.storage.from("vendas-docs").upload(comprovante, arquivo, { upsert: false, contentType: arquivo.type });
        if (upload.error) throw upload.error;
        rascunho.current = comprovante;
        setPath(comprovante);
      }
      const result = await supabase.rpc("confirmar_venda", { p_lead_id: leadId, p_empreendimento_id: empId, p_unidade: unidade.trim(), p_vgv: vgv, p_data: data, p_intermediacao_id: interId, p_comprovante_path: comprovante, p_observacao: obs.trim() || null });
      if (result.error) throw result.error;
      confirmado.current = true;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["negocios-board"] }),
        queryClient.invalidateQueries({ queryKey: ["vendas-realizadas"] }),
        queryClient.invalidateQueries({ queryKey: ["vendas-pendencias-documentos"] }),
      ]);
      const resposta = result.data as { ja_confirmada?: boolean } | null;
      toast.success(resposta?.ja_confirmada ? "Venda já registrada." : "Venda assinada e registrada!");
      window.dispatchEvent(new CustomEvent("pipeline-reload"));
      onConfirmed();
    } catch (e) {
      const message = e instanceof Error ? e.message : String((e as { message?: string }).message ?? "Não foi possível confirmar a venda.");
      setErro(message);
    } finally { ocupado.current = false; setSaving(false); }
  }

  return <div className="space-y-3.5 min-w-0">
    <DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-primary" />Confirmar venda</DialogTitle><DialogDescription>{nome}</DialogDescription></DialogHeader>
    {dados.loading ? <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-primary" /></div> : dados.error ? <div role="alert" className="text-sm text-destructive">{dados.error}<Button variant="outline" onClick={dados.recarregar} className="mt-3"><RefreshCw className="mr-2 size-4" />Tentar novamente</Button></div> : <>
      <section className="space-y-2.5">
        <div className="space-y-1"><Label>Empreendimento *</Label><Select value={empId} onValueChange={setEmpId}><SelectTrigger aria-label="Empreendimento"><SelectValue placeholder="Selecionar empreendimento" /></SelectTrigger><SelectContent>{dados.empreendimentos.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent></Select>{emp && <p className="text-xs text-muted-foreground">Construtora: <span className="font-medium text-foreground">{emp.construtora || "—"}</span></p>}</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"><div className="space-y-1"><Label htmlFor="venda-unidade">Unidade *</Label><Input id="venda-unidade" value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="Ex.: 321" /></div><div className="space-y-1"><Label htmlFor="venda-vgv">VGV final *</Label><Input id="venda-vgv" inputMode="numeric" value={formatCurrencyInput(valor)} onChange={e => setValor(handleCurrencyChange(e.target.value))} /></div><div className="space-y-1 col-span-2 sm:col-span-1"><Label htmlFor="venda-data">Assinatura *</Label><Input id="venda-data" type="date" max={hoje} value={data} onChange={e => setData(e.target.value)} /></div></div>
      </section>
      <section className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between"><Label>Intermediação *</Label><Button variant="ghost" size="icon" className="size-7" aria-label="Atualizar intermediações" title="Atualizar intermediações" onClick={dados.recarregar}><RefreshCw className="size-4" /></Button></div>
        <div className="flex gap-2"><div className="flex-1 min-w-0"><Select value={interId} onValueChange={id => { setInterId(id); const i = dados.intermediacoes.find(x => x.id === id); if (i?.unidade && !unidade) setUnidade(i.unidade); }}><SelectTrigger aria-label="Intermediação"><SelectValue placeholder="Selecionar documento do cliente" /></SelectTrigger><SelectContent>{dados.intermediacoes.map(i => <SelectItem key={i.id} value={i.id}>{i.empreendimento} · {i.unidade || "sem unidade"}</SelectItem>)}</SelectContent></Select></div>
        {(isGestor || isAdmin || isDiretor) && <Button variant="outline" asChild className="shrink-0"><Link to={`/intermediacao?lead=${encodeURIComponent(leadId)}`} target="_blank"><FileSignature className="mr-1.5 size-4" />Gerar</Link></Button>}</div>
        {inter && <div className="flex items-start gap-2 text-xs text-muted-foreground"><FileSignature className="mt-0.5 size-3.5 shrink-0" /><span className="break-words min-w-0">{inter.filename || inter.comprador_nome}</span></div>}
        {unidadeDiferente && <p role="alert" className="text-sm text-destructive">Unidade diferente da intermediação: {inter?.unidade}.</p>}
        {vgvDiferente && <p className="text-xs text-muted-foreground">VGV na intermediação: {fmtMoney(Number(inter?.vgv), "exact")}. Confira o valor final.</p>}
      </section>
      <section className="space-y-2 border-t border-border pt-3">
        <Label>Comprovante do pagamento do ato *</Label>
        <input ref={input} type="file" className="hidden" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => {
          const f = e.target.files?.[0]; if (!f) return;
          if (!comprovantePermitido(f)) { setErro("Selecione um PDF ou imagem de até 20 MB."); return; }
          setArquivo(f); setPath(""); setErro(null);
        }} />
        {arquivo || path ? <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-1.5"><Paperclip className="size-4 shrink-0 text-primary" /><span className="text-sm break-all min-w-0 flex-1">{arquivo?.name || "Comprovante anexado"}</span><Button disabled={saving || (!!path && !rascunho.current)} variant="ghost" size="icon" className="size-7" aria-label="Remover comprovante" onClick={() => void removerComprovante()}><X className="size-4" /></Button></div> : <Button variant="outline" className="w-full" onClick={() => input.current?.click()}><Upload className="mr-2 size-4" />Anexar PDF ou imagem</Button>}
      </section>
      {mostrarObs || obs ? <div className="space-y-1"><Label htmlFor="venda-observacao">Observação</Label><Textarea id="venda-observacao" value={obs} onChange={e => setObs(e.target.value)} rows={2} autoFocus={!obs} /></div> : <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setMostrarObs(true)}>+ Adicionar observação</button>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <DialogFooter className="sticky bottom-0 z-10 -mx-6 -mb-6 gap-2 border-t border-border bg-background px-6 py-3"><Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button><Button disabled={saving || pendencias.length > 0 || unidadeDiferente || !inter} onClick={confirmar}>{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}Confirmar venda</Button></DialogFooter>
    </>}
  </div>;
}