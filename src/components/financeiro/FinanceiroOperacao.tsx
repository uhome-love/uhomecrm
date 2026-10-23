import {useState} from "react";
import {Loader2,Save} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Sheet,SheetContent,SheetHeader,SheetTitle} from "@/components/ui/sheet";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {supabase} from "@/integrations/supabase/client";
import {todayBRT} from "@/lib/brtTime";
import {FORMAS_FINANCEIRO,type ParcelaFinanceira,type DadosFinanceiro,type BeneficiarioFinanceiro,type IntermediacaoFinanceira} from "@/lib/financeiro";
import {toast} from "sonner";
import {dinheiro} from "./FinanceiroIndicadores";
export type OperacaoFinanceira = {tipo:"receber";r:ParcelaFinanceira}|{tipo:"parcela";i?:IntermediacaoFinanceira;r?:ParcelaFinanceira}|{tipo:"repasse";r:ParcelaFinanceira;b:BeneficiarioFinanceiro;valor:number}|{tipo:"distrato";negocioId:string;nome:string}|{tipo:"custo";midia:boolean};
export function FinanceiroOperacao({operacao:o,dados,onClose,onSaved}:{operacao:OperacaoFinanceira;dados:DadosFinanceiro;onClose:()=>void;onSaved:()=>Promise<void>}){
 const [data,setData]=useState(o.tipo==="parcela"?o.r?.vencimento??"":todayBRT());const [valor,setValor]=useState(o.tipo==="parcela"?String(o.r?.valor??""):"");
 const [inter,setInter]=useState(o.tipo==="parcela"?o.i?.id??o.r?.intermediacao_id??"":"");const [observacao,setObservacao]=useState(o.tipo==="parcela"?o.r?.observacao??"":"");const [categoria,setCategoria]=useState("");const [arquivo,setArquivo]=useState<File|null>(null);const [saving,setSaving]=useState(false);const [erro,setErro]=useState("");
 const titulo=o.tipo==="receber"?"Confirmar recebimento":o.tipo==="repasse"?"Confirmar repasse":o.tipo==="distrato"?"Registrar distrato":o.tipo==="custo"?o.midia?"Novo custo de mídia":"Novo custo fixo":o.r?"Editar parcela":"Adicionar parcela";
 const i=dados.intermediacoes.find(x=>x.id===inter);const n=o.tipo==="receber"||o.tipo==="repasse"?dados.vendas.find(x=>x.id===o.r.negocio_id):null;
 const comprovante=o.tipo==="receber"||o.tipo==="repasse";
 async function salvar(){
  if(saving)return;setSaving(true);setErro("");
  try{
   let path="";
   if(comprovante){if(!arquivo||!n)throw Error("Anexe o comprovante.");if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(arquivo.type)||arquivo.size>10*1024*1024)throw Error("Use PDF ou imagem de até 10 MB.");path=`${n.id}/financeiro/${crypto.randomUUID()}.${arquivo.type==="application/pdf"?"pdf":arquivo.type.split("/")[1]}`;const up=await supabase.storage.from("vendas-docs").upload(path,arquivo,{contentType:arquivo.type});if(up.error)throw up.error;}
   let error: {message:string}|null=null;
   if(o.tipo==="receber"){({error}=await supabase.rpc("financeiro_receber_parcela",{p_id:o.r.id,p_data:data,p_path:path}));}
   else if(o.tipo==="repasse"){({error}=await supabase.rpc("financeiro_registrar_repasse",{p_recebimento:o.r.id,p_beneficiario:o.b.id,p_data:data,p_path:path}));}
   else if(o.tipo==="parcela"){if(!i?.forma_pagamento)throw Error("Confira a forma escolhida na intermediação.");({error}=await supabase.rpc("financeiro_salvar_parcela",{p_intermediacao:i.id,p_id:o.r?.id??null,p_valor:Number(valor),p_vencimento:data,p_forma:i.forma_pagamento,p_observacao:observacao}));}
   else if(o.tipo==="distrato"){({error}=await supabase.rpc("registrar_distrato",{p_negocio:o.negocioId,p_data:data,p_motivo:observacao}));}
   else {const u=await supabase.auth.getUser();if(!u.data.user)throw Error("Entre na sua conta.");if(!categoria.trim()||Number(valor)<=0)throw Error("Informe categoria e valor positivo.");if(o.midia){({error}=await supabase.from("custos_midia_manual").insert({competencia:data,canal:categoria,descricao:observacao,valor:Number(valor),created_by:u.data.user.id}));}else{({error}=await supabase.from("custos_fixos").insert({competencia:data,categoria,descricao:observacao,valor:Number(valor),created_by:u.data.user.id}));}}
   if(error)throw Error(error.message);await onSaved();toast.success(o.tipo==="distrato"?"Distrato registrado; valores já recebidos foram preservados.":"Registro financeiro salvo.");onClose();
  }catch(e){setErro(e instanceof Error?e.message:"Não foi possível salvar.");}finally{setSaving(false);}
 }
 const valido=!!data&&(!comprovante||!!arquivo)&&(o.tipo!=="parcela"||(!!inter&&Number(valor)>0))&&(o.tipo!=="distrato"||observacao.trim().length>=10)&&(o.tipo!=="custo"||(!!categoria.trim()&&Number(valor)>0));
 return <Sheet open onOpenChange={v=>{if(!v&&!saving)onClose();}}><SheetContent className="w-full sm:max-w-lg overflow-y-auto"><SheetHeader><SheetTitle>{titulo}</SheetTitle></SheetHeader><div className="space-y-5 py-6">
 {o.tipo==="distrato"&&<div className="border-l-2 border-destructive pl-3 text-sm"><p className="font-semibold">{o.nome}</p><p className="text-muted-foreground">A venda sai do VGV. Parcelas pendentes são canceladas; valores recebidos e comprovantes permanecem.</p></div>}
 {comprovante&&<div className="space-y-1"><h3 className="font-semibold">{n?.nome_cliente}</h3><p className="text-sm text-muted-foreground">{o.tipo==="repasse"?o.b.nome:FORMAS_FINANCEIRO[o.r.forma??""]} · {dinheiro(o.tipo==="repasse"?o.valor:o.r.valor)}</p></div>}
 {o.tipo==="parcela"&&<div className="space-y-2"><Label>Venda / intermediação</Label><Select value={inter} onValueChange={setInter} disabled={!!o.r}><SelectTrigger aria-label="Intermediação da parcela"><SelectValue placeholder="Selecione a venda"/></SelectTrigger><SelectContent>{dados.intermediacoes.filter(x=>dados.vendas.some(n=>n.id===x.negocio_id&&n.status==="ativo")).map(x=><SelectItem key={x.id} value={x.id}>{x.comprador_nome} · {x.empreendimento}</SelectItem>)}</SelectContent></Select>{i&&<p className="text-sm text-muted-foreground">{FORMAS_FINANCEIRO[i.forma_pagamento??""]??"Forma de pagamento pendente de conferência"} · Comissão {dinheiro(i.valor_bruto??i.valor_comissao)}</p>}</div>}
 {o.tipo==="custo"&&<div className="space-y-2"><Label htmlFor="fin-categoria">{o.midia?"Canal":"Categoria"}</Label>{o.midia?<Select value={categoria} onValueChange={setCategoria}><SelectTrigger aria-label="Canal do custo"><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{["Google Ads","Portais","Produção de conteúdo","Outros"].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>:<Input id="fin-categoria" value={categoria} onChange={e=>setCategoria(e.target.value)} placeholder="Aluguel, equipe, ferramentas…"/>}</div>}
 {(o.tipo==="parcela"||o.tipo==="custo")&&<div className="space-y-2"><Label htmlFor="fin-valor">Valor (R$)</Label><Input id="fin-valor" type="number" min="0.01" step="0.01" value={valor} onChange={e=>setValor(e.target.value)}/></div>}
 <div className="space-y-2"><Label htmlFor="fin-data">{o.tipo==="parcela"?"Vencimento":o.tipo==="custo"?"Competência":"Data do registro"}</Label><Input id="fin-data" type="date" max={o.tipo==="parcela"||o.tipo==="custo"?undefined:todayBRT()} value={data} onChange={e=>setData(e.target.value)}/></div>
 {comprovante&&<div className="space-y-2"><Label htmlFor="fin-arquivo">Comprovante</Label><Input id="fin-arquivo" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setArquivo(e.target.files?.[0]??null)}/></div>}
 {(o.tipo==="distrato"||o.tipo==="parcela"||o.tipo==="custo")&&<div className="space-y-2"><Label htmlFor="fin-obs">{o.tipo==="distrato"?"Motivo":"Descrição / observação"}</Label><Textarea id="fin-obs" value={observacao} onChange={e=>setObservacao(e.target.value)} maxLength={2000}/></div>}
 {erro&&<p role="alert" className="text-sm text-destructive">{erro}</p>}<div className="flex gap-2 justify-end"><Button variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button><Button variant={o.tipo==="distrato"?"destructive":"default"} disabled={!valido||saving} onClick={()=>void salvar()}>{saving?<Loader2 className="animate-spin"/>:<Save/>}{o.tipo==="distrato"?"Confirmar distrato":"Salvar"}</Button></div>
 </div></SheetContent></Sheet>;
}
