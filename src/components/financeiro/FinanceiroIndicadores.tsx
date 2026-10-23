import {Wallet,Clock,Receipt,ArrowUpRight} from "lucide-react";
import {fmtMoney} from "@/lib/fmtMoney";
import {resumoFinanceiro} from "@/lib/financeiro";
export const dinheiro=(n:number)=>fmtMoney(n,"exact",{decimals:2});
export function FinanceiroIndicadores({resumo}:{resumo:ReturnType<typeof resumoFinanceiro>}){
 const itens=[{label:"A receber no período",valor:resumo.aReceber,Icon:Clock},{label:"Comissão recebida",valor:resumo.recebido,Icon:Receipt},{label:"Parte líquida da Uhome",valor:resumo.recebidaUhome,Icon:Wallet},{label:"Repasses NF pendentes",valor:resumo.repassesPendentes,Icon:ArrowUpRight}];
 return <section className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border border-y border-border py-5 gap-y-5">{itens.map(x=><div key={x.label} className="px-4 min-w-0"><p className="text-xs text-muted-foreground flex items-center gap-2 mb-2"><x.Icon className="size-4 shrink-0"/>{x.label}</p><p className="text-lg font-bold text-foreground break-words tabular-nums">{dinheiro(x.valor)}</p></div>)}</section>;
}
