import {useMemo,useState} from "react";
import {Download,Loader2,RefreshCw,Search,Wallet,History} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Tabs,TabsContent,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {useUserRole} from "@/hooks/useUserRole";
import {useFinanceiro} from "@/hooks/useFinanceiro";
import {todayBRT,formatBRT} from "@/lib/brtTime";
import {FINANCEIRO_VAZIO,resumoFinanceiro,noPeriodo} from "@/lib/financeiro";
import {FinanceiroIndicadores,dinheiro} from "@/components/financeiro/FinanceiroIndicadores";
import {FinanceiroParcelas} from "@/components/financeiro/FinanceiroParcelas";
import {FinanceiroGanhos} from "@/components/financeiro/FinanceiroGanhos";
import {FinanceiroCustos,FinanceiroResultado} from "@/components/financeiro/FinanceiroCustos";
import {FinanceiroOperacao,type OperacaoFinanceira} from "@/components/financeiro/FinanceiroOperacao";
import {exportarFinanceiro} from "@/lib/financeiroExport";
export default function Financeiro(){
 const {isAdmin,isDiretor}=useUserRole();const hoje=todayBRT();const [inicio,setInicio]=useState(`${hoje.slice(0,7)}-01`);const [fim,setFim]=useState(hoje);const [busca,setBusca]=useState("");const [operacao,setOperacao]=useState<OperacaoFinanceira|null>(null);
 const q=useFinanceiro(inicio,fim);const d=q.data??FINANCEIRO_VAZIO;const resumo=useMemo(()=>resumoFinanceiro(d,inicio,fim,hoje),[d,inicio,fim,hoje]);
 const vendas=d.vendas.filter(n=>noPeriodo(n.data_assinatura,inicio,fim)&&[n.nome_cliente,n.empreendimento].join(" ").toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
 if(!isAdmin&&!isDiretor)return <p className="text-muted-foreground py-12 text-center">Financeiro é exclusivo do CEO e da diretora.</p>;
 return <div className="space-y-5 min-w-0"><header className="flex items-center justify-between gap-3 flex-wrap"><div className="flex items-center gap-3"><Wallet className="size-6 text-primary"/><div><h1 className="font-bold text-2xl">Financeiro</h1><p className="text-sm text-muted-foreground">Comissões e balanço da Uhome</p></div></div><div className="flex gap-2"><Button size="icon" variant="outline" title="Atualizar Financeiro" aria-label="Atualizar Financeiro" onClick={()=>void q.refetch()}><RefreshCw className={q.isFetching?"animate-spin":""}/></Button><Button variant="outline" disabled={!q.data} onClick={()=>exportarFinanceiro(d,inicio,fim,hoje)}><Download/>Excel</Button></div></header>
 <section className="grid grid-cols-2 md:grid-cols-[180px_180px_1fr] gap-3 border-t border-border pt-4"><div className="space-y-1"><Label htmlFor="fin-inicio">De</Label><Input id="fin-inicio" type="date" value={inicio} onChange={e=>setInicio(e.target.value)}/></div><div className="space-y-1"><Label htmlFor="fin-fim">Até</Label><Input id="fin-fim" type="date" min={inicio} value={fim} onChange={e=>setFim(e.target.value)}/></div><div className="relative col-span-2 md:col-span-1 self-end"><Search className="absolute left-3 top-3 size-4 text-muted-foreground"/><Input className="pl-9" aria-label="Buscar no Financeiro" placeholder="Cliente, empreendimento ou pessoa" value={busca} onChange={e=>setBusca(e.target.value)}/></div></section>
 <FinanceiroIndicadores resumo={resumo}/>
 {q.isPending?<div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary"/></div>:q.error?<p role="alert" className="text-destructive">Não foi possível carregar Financeiro. <Button variant="outline" onClick={()=>void q.refetch()}>Tentar novamente</Button></p>:<Tabs defaultValue="receber" className="space-y-5"><div className="overflow-x-auto"><TabsList className="bg-transparent border-b border-border rounded-none h-auto gap-1 p-0">{[["receber","A receber"],["recebido","Recebido"],["ganhos","Ganhos e repasses"],["custos","Custos"],["resultado","Lucro e ROI"],["distratos","Distratos"],["historico","Histórico"]].map(([v,l])=><TabsTrigger key={v} value={v}>{l}</TabsTrigger>)}</TabsList></div>
 <TabsContent value="receber"><FinanceiroParcelas dados={d} inicio={inicio} fim={fim} busca={busca} recebido={false} onOperacao={setOperacao}/><p className="text-xs text-muted-foreground border-t border-border pt-4 mt-6">Saldo total pendente: {dinheiro(resumo.saldoTotal)} · Vencidas: {dinheiro(resumo.vencidas)}</p></TabsContent>
 <TabsContent value="recebido"><FinanceiroParcelas dados={d} inicio={inicio} fim={fim} busca={busca} recebido onOperacao={setOperacao}/></TabsContent>
 <TabsContent value="ganhos"><FinanceiroGanhos dados={d} inicio={inicio} fim={fim} busca={busca} onOperacao={setOperacao}/></TabsContent>
 <TabsContent value="custos"><FinanceiroCustos dados={d} inicio={inicio} fim={fim} onOperacao={setOperacao} atualizar={q.atualizar}/></TabsContent>
 <TabsContent value="resultado"><FinanceiroResultado dados={d} resumo={resumo} inicio={inicio} fim={fim}/></TabsContent>
 <TabsContent value="distratos"><section className="divide-y divide-border">{vendas.map(n=><div key={n.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="font-semibold text-sm">{n.nome_cliente}</p><p className="text-xs text-muted-foreground">{n.empreendimento} · {dinheiro(n.vgv_final??n.vgv_estimado??0)}</p>{n.distrato_em&&<p className="text-xs text-destructive mt-1">Distrato em {n.distrato_em.split("-").reverse().join("/")} · {n.distrato_motivo}</p>}</div>{n.status==="ativo"&&<Button variant="outline" size="sm" className="text-destructive shrink-0" onClick={()=>setOperacao({tipo:"distrato",negocioId:n.id,nome:n.nome_cliente})}>Distrato</Button>}</div>)}{!vendas.length&&<p className="text-muted-foreground py-12 text-center">Nenhuma venda nesta seleção.</p>}</section></TabsContent>
 <TabsContent value="historico"><section className="divide-y divide-border">{d.historico.map(h=><div className="py-3 flex gap-3" key={h.id}><History className="size-4 text-muted-foreground shrink-0 mt-1"/><div className="min-w-0"><p className="text-sm font-medium">{h.acao==="distrato"?"Distrato":h.entidade==="financeiro_repasses"?"Repasse":h.entidade==="negocios_recebimentos"?"Parcela":h.entidade==="negocios"?"Venda":"Custo"} · {h.acao}</p><p className="text-xs text-muted-foreground">{formatBRT(h.created_at,"dd/MM/yyyy HH:mm")} · Responsável {h.user_id?"identificado":"sistema"}</p><details className="text-xs mt-2"><summary className="cursor-pointer text-primary">Detalhes</summary><pre className="whitespace-pre-wrap break-all p-2 bg-muted rounded-md mt-2">{JSON.stringify({antes:h.antes,depois:h.depois},null,2)}</pre></details></div></div>)}{!d.historico.length&&<p className="text-muted-foreground py-12 text-center">Nenhuma alteração financeira neste período.</p>}</section></TabsContent>
 </Tabs>}
 {operacao&&<FinanceiroOperacao key={`${operacao.tipo}:${"r" in operacao?operacao.r?.id??"":""}`} operacao={operacao} dados={d} onClose={()=>setOperacao(null)} onSaved={q.atualizar}/>}
 </div>;
}
