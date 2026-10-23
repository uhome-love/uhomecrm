import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/fmtMoney";
import { documentosVenda, type VendaRelatorio } from "@/lib/vendasRelatorio";
import { toast } from "sonner";
export function VendaDetalhes({ venda, onClose }: { venda: VendaRelatorio | null; onClose: () => void }) {
  const [loading,setLoading]=useState("");
  async function baixar(intermediacao: boolean) {
    if (!venda) return; setLoading(intermediacao ? "inter" : "ato");
    try {
      let path=venda.comprovante_ato_path;
      if (intermediacao && venda.intermediacao_id) { const r=await supabase.from("intermediacoes").select("arquivo_path").eq("id",venda.intermediacao_id).eq("status","ativa").single(); if(r.error)throw r.error; path=r.data.arquivo_path; }
      if (!path) throw Error("Documento não localizado.");
      const r=await supabase.storage.from(intermediacao ? "intermediacoes" : "vendas-docs").createSignedUrl(path,120);
      if(r.error)throw r.error; window.open(r.data.signedUrl,"_blank","noopener,noreferrer");
    } catch { toast.error("Não foi possível abrir o documento."); } finally { setLoading(""); }
  }
  return <Sheet open={!!venda} onOpenChange={o=>{if(!o)onClose();}}><SheetContent className="w-full sm:max-w-lg overflow-y-auto"><SheetHeader><SheetTitle>Detalhes da venda</SheetTitle></SheetHeader>{venda && <div className="space-y-5 py-5"><h2 className="text-lg font-semibold">{venda.nome_cliente}</h2><dl className="divide-y divide-border">{[["Empreendimento",venda.empreendimento],["Construtora",venda.construtora],["Unidade",venda.unidade],["VGV",fmtMoney(venda.vgv_final??venda.vgv_estimado??0,"exact",{decimals:2})],["Assinatura",venda.data_assinatura?.split("-").reverse().join("/")],["Corretor",venda.rateios.map(r=>r.corretor_nome).join(" / ")],["Equipe da venda",[...new Set(venda.rateios.map(r=>r.equipe).filter(Boolean))].join(" / ")],["Origem",venda.origem],["Campanha",venda.campanha],["Observação",venda.observacoes]].map(([k,v])=><div key={k} className="grid grid-cols-[110px_1fr] gap-3 py-3 text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="break-words font-medium">{v||"—"}</dd></div>)}</dl><div className="space-y-2"><h3 className="text-sm font-semibold">Documentos</h3>{documentosVenda(venda).length>0&&<p className="text-sm text-warning-700 dark:text-warning-500">Pendentes: {documentosVenda(venda).join(", ")}</p>}<Button className="w-full justify-start" variant="outline" disabled={!venda.intermediacao_id||!!loading} onClick={()=>void baixar(true)}>{loading==="inter"?<Loader2 className="animate-spin"/>:<Download/>}Intermediação</Button><Button className="w-full justify-start" variant="outline" disabled={!venda.comprovante_ato_path||!!loading} onClick={()=>void baixar(false)}>{loading==="ato"?<Loader2 className="animate-spin"/>:<Download/>}Comprovante do ato</Button></div>{venda.pipeline_lead_id&&<Button asChild variant="outline"><Link to={`/pipeline-leads?lead=${venda.pipeline_lead_id}`}><ExternalLink/>Abrir cliente</Link></Button>}</div>}</SheetContent></Sheet>;
}