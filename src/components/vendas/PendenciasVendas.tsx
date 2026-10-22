import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertCircle, ExternalLink, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { pendenciasVenda } from "@/lib/vendaConfirmacao";
import { formatBRT } from "@/lib/brtTime";

interface VendaPendente {
  id: string; nome_cliente: string; empreendimento: string | null; pipeline_lead_id: string | null;
  empreendimento_canonico_id: string | null; construtora: string | null; unidade: string | null;
  vgv_final: number | null; data_assinatura: string | null; intermediacao_id: string | null; comprovante_ato_path: string | null;
}
interface InterPendente { id: string; comprador_nome: string; empreendimento: string | null; unidade: string | null; status: string }

export function PendenciasVendas() {
  const [busca, setBusca] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["vendas-pendencias-documentos"],
    queryFn: async () => {
      const vendas: VendaPendente[] = [];
      for (let offset = 0; ; offset += 500) {
        const result = await supabase.from("negocios").select("id,nome_cliente,empreendimento,pipeline_lead_id,empreendimento_canonico_id,construtora,unidade,vgv_final,data_assinatura,intermediacao_id,comprovante_ato_path")
          .eq("fase", "ganho").eq("status", "ativo").order("id").range(offset, offset + 499);
        if (result.error) throw result.error;
        const rows: VendaPendente[] = result.data ?? [];
        vendas.push(...rows);
        if (rows.length < 500) break;
      }
      const inters = await supabase.from("intermediacoes").select("id,comprador_nome,empreendimento,unidade,status")
        .in("status", ["ativa", "pendente_conferencia"]).is("negocio_id", null).order("comprador_nome");
      if (inters.error) throw inters.error;
      return { vendas, inters: (inters.data ?? []) as InterPendente[] };
    },
  });
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  if (error) return <p role="alert" className="text-destructive text-sm">Não foi possível carregar as pendências.</p>;
  const hoje = formatBRT(new Date(), "yyyy-MM-dd");
  const pendentes = (data?.vendas ?? []).map(v => ({ ...v, faltas: pendenciasVenda({ empreendimentoCanonicoId: v.empreendimento_canonico_id, construtora: v.construtora, unidade: v.unidade, vgvFinal: v.vgv_final, dataAssinatura: v.data_assinatura, intermediacaoId: v.intermediacao_id, comprovanteAtoPath: v.comprovante_ato_path }, hoje) })).filter(v => v.faltas.length > 0);
  const termo = busca.toLocaleLowerCase("pt-BR");
  const corresponde = (nome: string, empreendimento: string | null) => `${nome} ${empreendimento ?? ""}`.toLocaleLowerCase("pt-BR").includes(termo);
  return <section className="space-y-5">
    <div className="flex flex-wrap gap-3 justify-between items-center"><h2 className="font-semibold flex items-center gap-2"><AlertCircle className="size-4 text-primary" />Pendências de documentos <Badge variant="secondary">{pendentes.length}</Badge></h2><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Buscar pendências" className="pl-9" placeholder="Cliente ou empreendimento" value={busca} onChange={e => setBusca(e.target.value)} /></div></div>
    <div className="divide-y divide-border">{pendentes.filter(v => corresponde(v.nome_cliente, v.empreendimento)).map(v => <div key={v.id} className="flex flex-wrap items-center gap-3 py-4"><div className="min-w-0 flex-1"><p className="font-medium text-sm">{v.nome_cliente}</p><p className="text-sm text-muted-foreground">{v.empreendimento || "Sem empreendimento"}{v.unidade ? ` · ${v.unidade}` : ""}</p><div className="flex flex-wrap gap-1 mt-2">{v.faltas.map(f => <Badge key={f} variant="outline" className="text-xs">{f}</Badge>)}</div></div>{v.pipeline_lead_id && <Button asChild variant="outline" size="sm"><Link to={`/pipeline-leads?lead=${v.pipeline_lead_id}`}><ExternalLink className="size-4 mr-2" />Abrir cliente</Link></Button>}</div>)}</div>
    <div className="border-t border-border pt-5 space-y-3"><h3 className="text-sm font-semibold">Intermediações sem venda confirmada <Badge variant="secondary">{data?.inters.length ?? 0}</Badge></h3><div className="divide-y divide-border">{(data?.inters ?? []).filter(i => corresponde(i.comprador_nome, i.empreendimento)).map(i => <div key={i.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="text-sm font-medium">{i.comprador_nome}</p><p className="text-sm text-muted-foreground">{i.empreendimento} · {i.unidade || "Sem unidade"}</p></div><Badge variant="outline">{i.status === "pendente_conferencia" ? "Conferir vínculo" : "Sem venda ligada"}</Badge></div>)}</div></div>
  </section>;
}