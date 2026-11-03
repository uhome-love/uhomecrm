import {Wallet,Clock,Receipt,ArrowUpRight,Coins} from "lucide-react";
import {fmtMoney} from "@/lib/fmtMoney";
import {resumoFinanceiro} from "@/lib/financeiro";
export const dinheiro=(n:number)=>fmtMoney(n,"exact",{decimals:2});
export function FinanceiroIndicadores({resumo}:{resumo:ReturnType<typeof resumoFinanceiro>}){
 const itens=[{label:"A receber no período",valor:resumo.aReceber,Icon:Clock},{label:"Comissão recebida",valor:resumo.recebido,Icon:Receipt},{label:"Parte líquida da Uhome",valor:resumo.recebidaUhome,Icon:Wallet},{label:"Repasses NF pendentes",valor:resumo.repassesPendentes,Icon:ArrowUpRight}];
 return <section className="grid grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1fr_1fr] gap-3">
  <div className="col-span-2 xl:col-span-1 rounded-2xl border border-warning-500 bg-warning-50 dark:bg-card p-4 shadow-sm min-w-0">
   <p className="text-xs font-medium text-muted-foreground flex items-center gap-2 mb-2"><span className="grid size-7 place-items-center rounded-lg bg-card text-warning-700 dark:text-warning-500"><Coins className="size-4"/></span>Saldo pendente a receber</p>
   <p className="text-2xl font-bold text-foreground tabular-nums break-words">{dinheiro(resumo.saldoTotal)}</p>
   <p className="mt-1 text-xs text-muted-foreground">{resumo.qtdPendentes} {resumo.qtdPendentes===1?"parcela em aberto":"parcelas em aberto"}{resumo.vencidas>0&&<> · <span className="font-semibold text-destructive">{dinheiro(resumo.vencidas)} vencidas</span></>}</p>
  </div>
  {itens.map(x=><div key={x.label} className={`rounded-2xl border border-border bg-card p-4 shadow-sm min-w-0 ${x.valor===0?"opacity-60":""}`}><p className="text-xs font-medium text-muted-foreground flex items-center gap-2 mb-2"><span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary"><x.Icon className="size-4 shrink-0"/></span>{x.label}</p><p className="text-lg font-bold text-foreground break-words tabular-nums">{dinheiro(x.valor)}</p></div>)}
 </section>;
}
