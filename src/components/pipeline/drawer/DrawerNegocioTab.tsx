import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Briefcase, TrendingUp, Save, Pencil } from "lucide-react";
import { fmtMoney } from "@/lib/fmtMoney";
import { MoneyInput } from "@/components/simulador/MoneyInput";
import { type Negocio, NEGOCIOS_FASES } from "@/hooks/useNegocios";
import { NEGOCIACAO_SUBSTATUS, CONTRATO_SUBSTATUS } from "@/lib/leadHelpers";
import { toast } from "sonner";

interface NegocioFull extends Negocio {
  unidade?: string | null;
  data_assinatura?: string | null;
  proposta_situacao?: string | null;
  proposta_valor?: number | null;
  negociacao_situacao?: string | null;
  negociacao_pendencia?: string | null;
  documentacao_situacao?: string | null;
  motivo_queda?: string | null;
  construtora?: string | null;
}

interface Props {
  negocioId: string | null;
  pipelineLeadId?: string;
  corretorNome?: string;
}

/**
 * Aba Negócio do modal do lead — painel de INFORMAÇÕES editáveis do negócio.
 *
 * No fluxo único, as fases do negócio são as próprias etapas do pipeline de
 * leads (Em Negociação → Contrato → Ganho). A mudança de fase acontece movendo
 * o card no pipeline. Esta aba mostra e permite editar os dados do negócio,
 * registrando cada alteração no Histórico do lead.
 */
export default function DrawerNegocioTab({ negocioId, pipelineLeadId }: Props) {
  const { user } = useAuth();
  const [negocio, setNegocio] = useState<NegocioFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Campos editáveis
  const [empreendimento, setEmpreendimento] = useState("");
  const [unidade, setUnidade] = useState("");
  const [construtora, setConstrutora] = useState("");
  const [vgv, setVgv] = useState(0);
  const [propostaValor, setPropostaValor] = useState(0);
  const [propostaSituacao, setPropostaSituacao] = useState("");
  const [negociacaoSituacao, setNegociacaoSituacao] = useState("");
  const [documentacaoSituacao, setDocumentacaoSituacao] = useState("");
  const [dataAssinatura, setDataAssinatura] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const load = useCallback(async () => {
    if (!negocioId) {
      setNegocio(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("negocios")
      .select("*")
      .eq("id", negocioId)
      .maybeSingle();
    const n = (data as NegocioFull) || null;
    setNegocio(n);
    if (n) {
      setEmpreendimento(n.empreendimento || "");
      setUnidade(n.unidade || "");
      setConstrutora(n.construtora || "");
      setVgv(Number(n.vgv_final || n.vgv_estimado || 0));
      setPropostaValor(Number(n.proposta_valor || 0));
      setPropostaSituacao(n.proposta_situacao || "");
      setNegociacaoSituacao(n.negociacao_situacao || "");
      setDocumentacaoSituacao(n.documentacao_situacao || "");
      setDataAssinatura(n.data_assinatura || "");
      setObservacoes(n.observacoes || "");
    }
    setLoading(false);
  }, [negocioId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleSave = useCallback(async () => {
    if (!negocioId) return;
    setSaving(true);
    const vgvNum = Number(vgv) || 0;
    const payload: Record<string, any> = {
      empreendimento: empreendimento || null,
      unidade: unidade || null,
      construtora: construtora || null,
      vgv_estimado: vgvNum || null,
      proposta_valor: Number(propostaValor) || null,
      proposta_situacao: propostaSituacao || null,
      negociacao_situacao: negociacaoSituacao || null,
      documentacao_situacao: documentacaoSituacao || null,
      data_assinatura: dataAssinatura || null,
      observacoes: observacoes || null,
    };
    const { error } = await supabase.from("negocios").update(payload).eq("id", negocioId);
    if (error) {
      console.error("Erro ao salvar negócio:", error);
      toast.error("Erro ao salvar informações do negócio.");
      setSaving(false);
      return;
    }
    // Registra no histórico/timeline do lead
    if (pipelineLeadId && user) {
      try {
        await supabase.from("pipeline_atividades").insert({
          pipeline_lead_id: pipelineLeadId,
          tipo: "sistema",
          titulo: "Informações do negócio atualizadas",
          descricao: [
            empreendimento && `Empreendimento: ${empreendimento}${unidade ? ` · ${unidade}` : ""}`,
            vgvNum > 0 && `VGV: ${fmtMoney(vgvNum, "exact")}`,
            propostaSituacao && `Proposta: ${propostaSituacao}`,
            negociacaoSituacao && `Negociação: ${negociacaoSituacao}`,
            documentacaoSituacao && `Documentação: ${documentacaoSituacao}`,
            observacoes && `Obs: ${observacoes}`,
          ].filter(Boolean).join(" · ") || "Dados do negócio atualizados",
          created_by: user.id,
        } as any);
      } catch (e) {
        console.error("Erro ao registrar no histórico:", e);
      }
    }
    toast.success("Negócio atualizado!");
    setEditing(false);
    setSaving(false);
    load();
  }, [negocioId, pipelineLeadId, user, empreendimento, unidade, construtora, vgv, propostaValor, propostaSituacao, negociacaoSituacao, documentacaoSituacao, dataAssinatura, observacoes, load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!negocio) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-2">
        <Briefcase className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Nenhum negócio ainda. Ao mover o lead para <strong>Em Negociação</strong> o negócio é iniciado.
        </p>
      </div>
    );
  }

  const faseInfo = NEGOCIOS_FASES.find((f) => f.key === negocio.fase);
  const isPerdido = negocio.status === "perdido" || negocio.fase === "perdido";
  const vgvView = negocio.vgv_final || negocio.vgv_estimado || 0;

  return (
    <div className="px-3 md:px-5 py-4 space-y-4">
      {/* Header do negócio */}
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-primary">
              <Briefcase className="h-3.5 w-3.5" /> Negócio
            </div>
            <p className="text-sm font-semibold text-foreground truncate mt-0.5">
              {negocio.empreendimento || "Sem empreendimento"}
              {negocio.unidade ? ` · ${negocio.unidade}` : ""}
            </p>
            {negocio.construtora && (
              <p className="text-[11px] text-muted-foreground truncate">{negocio.construtora}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1 justify-end text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-sm font-bold">{vgvView > 0 ? fmtMoney(vgvView, "short") : "—"}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">VGV</span>
          </div>
        </div>

        {isPerdido ? (
          <Badge variant="destructive" className="text-[11px]">
            Negócio caiu{negocio.motivo_queda ? ` · ${negocio.motivo_queda}` : ""}
          </Badge>
        ) : (
          <Badge
            className="text-[11px] border-0 text-white"
            style={{ backgroundColor: faseInfo?.cor || "#4969FF" }}
          >
            {faseInfo?.label || negocio.fase}
          </Badge>
        )}

        <p className="text-[10px] text-muted-foreground">
          As fases avançam movendo o card no pipeline. Cada alteração fica registrada no Histórico do lead.
        </p>
      </div>

      {/* Modo edição vs leitura */}
      {!editing ? (
        <>
          <div className="grid grid-cols-1 gap-2">
            <SummaryRow label="Proposta" value={negocio.proposta_situacao || (negocio.proposta_valor ? fmtMoney(negocio.proposta_valor, "exact") : null)} />
            <SummaryRow label="Negociação" value={negocio.negociacao_situacao || negocio.negociacao_pendencia} />
            <SummaryRow label="Documentação" value={negocio.documentacao_situacao} />
            {negocio.data_assinatura && <SummaryRow label="Assinatura" value={negocio.data_assinatura} />}
            {negocio.observacoes && <SummaryRow label="Observações" value={negocio.observacoes} />}
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar informações do negócio
          </Button>
        </>
      ) : (
        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Empreendimento"><Input className="h-8 text-xs" value={empreendimento} onChange={(e) => setEmpreendimento(e.target.value)} /></Field>
            <Field label="Unidade"><Input className="h-8 text-xs" value={unidade} onChange={(e) => setUnidade(e.target.value)} /></Field>
            <Field label="Construtora"><Input className="h-8 text-xs" value={construtora} onChange={(e) => setConstrutora(e.target.value)} /></Field>
            <Field label="VGV (R$)"><MoneyInput className="h-8 text-xs" value={vgv} onValueChange={setVgv} /></Field>
            <Field label="Valor proposta (R$)"><MoneyInput className="h-8 text-xs" value={propostaValor} onValueChange={setPropostaValor} /></Field>
            <Field label="Data assinatura"><Input type="date" className="h-8 text-xs" value={dataAssinatura} onChange={(e) => setDataAssinatura(e.target.value)} /></Field>
          </div>
          <Field label="Situação da proposta">
            <Select value={propostaSituacao} onValueChange={setPropostaSituacao}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {NEGOCIACAO_SUBSTATUS.map(o => <SelectItem key={o.value} value={o.label}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Situação do contrato">
            <Select value={documentacaoSituacao} onValueChange={setDocumentacaoSituacao}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {CONTRATO_SUBSTATUS.map(o => <SelectItem key={o.value} value={o.label}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Negociação / pendência">
            <Input className="h-8 text-xs" value={negociacaoSituacao} onChange={(e) => setNegociacaoSituacao(e.target.value)} />
          </Field>
          <Field label="Observações do negócio">
            <Textarea className="text-xs min-h-[60px]" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); load(); }} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2">
      <span className="text-[11px] font-medium text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="text-xs text-foreground flex-1 break-words">{value}</span>
    </div>
  );
}
