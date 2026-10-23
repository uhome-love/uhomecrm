import { useState } from "react";
import { Briefcase, Loader2, Pencil } from "lucide-react";
import { useJornadaNegocio } from "@/hooks/useJornadaNegocio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtMoney } from "@/lib/fmtMoney";
import { formatBRT } from "@/lib/brtTime";
import { substatusValueLabel } from "@/lib/pipelineAudit";
import { DOCUMENTOS_NEGOCIO, lerDocumentos, valorSugerido } from "@/lib/jornadaNegocio";
import { JornadaNegocioForm } from "../negocio/JornadaNegocioForm";
import { ContratoIntermediacao } from "../negocio/ContratoIntermediacao";

interface Props { negocioId: string | null; pipelineLeadId?: string; corretorNome?: string }
export default function DrawerNegocioTab({ pipelineLeadId }: Props) {
  if (!pipelineLeadId) return <p className="p-5 text-sm text-muted-foreground">Nenhum cliente vinculado.</p>;
  return <NegocioDoCliente leadId={pipelineLeadId} />;
}

function NegocioDoCliente({ leadId }: { leadId: string }) {
  const dados = useJornadaNegocio(leadId);
  const [editing, setEditing] = useState(false);
  if (dados.isPending) return <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-primary" /></div>;
  if (dados.error) return <div className="space-y-3 p-5"><p role="alert" className="text-sm text-destructive">Não foi possível carregar o negócio.</p><Button variant="outline" onClick={() => void dados.refetch()}>Tentar novamente</Button></div>;
  const n = dados.data?.negocio;
  if (!n) return <div className="flex flex-col items-center gap-3 p-8 text-center text-muted-foreground"><Briefcase className="size-7" /><p className="text-sm">Nenhum negócio em andamento.</p></div>;
  const etapa = dados.data?.etapa;
  const editavel = n.fase !== "ganho" && !!etapa && ["proposta", "documentacao", "contrato_gerado"].includes(etapa.tipo);
  if (editing && editavel && etapa) return <div className="p-4"><JornadaNegocioForm leadId={leadId} etapaId={etapa.id} tipo={etapa.tipo} mover={false} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); void dados.refetch(); }} /></div>;
  const jornada = n.jornada && typeof n.jornada === "object" && !Array.isArray(n.jornada) ? n.jornada : {};
  const rawFlags = dados.data?.lead.flag_status;
  const flags = rawFlags && typeof rawFlags === "object" && !Array.isArray(rawFlags) ? rawFlags : {};
  const documentos = lerDocumentos(jornada.documentos);
  return <div className="space-y-5 px-4 py-5">
    <header className="space-y-2 border-b border-border pb-4">
      <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold"><Briefcase className="size-4 text-primary" />{n.empreendimento || "Negócio"}</h3><Badge variant="secondary">{n.fase === "ganho" ? "Ganho" : etapa?.nome || "Em andamento"}</Badge></div>
      <p className="text-sm text-muted-foreground">{n.construtora}{n.unidade ? ` · Unidade ${n.unidade}` : ""}</p>
      <p className="text-lg font-semibold text-primary">{fmtMoney(valorSugerido(n), "exact")}</p>
    </header>
    <dl className="space-y-3 text-sm">
      {typeof flags.status_negociacao === "string" && <Info label="Negociação" value={substatusValueLabel("status_negociacao", flags.status_negociacao)} />}
      {typeof flags.status_contrato === "string" && <Info label="Contrato" value={substatusValueLabel("status_contrato", flags.status_contrato)} />}
      {n.proposta_valor && <Info label="Valor da proposta" value={fmtMoney(n.proposta_valor, "exact")} />}
      {typeof jornada.previsao_assinatura === "string" && <Info label="Previsão de assinatura" value={formatBRT(`${jornada.previsao_assinatura}T12:00:00-03:00`, "dd/MM/yyyy")} />}
      {n.observacoes && <Info label="Condições / observação" value={n.observacoes} />}
    </dl>
    <section className="space-y-2 border-t border-border pt-4"><h3 className="text-sm font-semibold">Documentos do cliente</h3>{DOCUMENTOS_NEGOCIO.map(doc => <p key={doc.key} className="flex items-center gap-2 text-sm"><span className={documentos[doc.key] ? "text-primary" : "text-muted-foreground"}>{documentos[doc.key] ? "✓" : "—"}</span>{doc.label}</p>)}<p className="text-xs text-muted-foreground">Conferência informativa</p></section>
    {etapa?.tipo === "contrato_gerado" && n.fase !== "ganho" && <ContratoIntermediacao leadId={leadId} />}
    {editavel && <Button variant="outline" className="w-full" onClick={() => setEditing(true)}><Pencil className="mr-2 size-4" />Editar informações do negócio</Button>}
  </div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-1 gap-1 sm:grid-cols-[140px_minmax(0,1fr)]"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words">{value}</dd></div>;
}