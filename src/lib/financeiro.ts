import type { Database } from "@/integrations/supabase/types";
type Row<K extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][K]["Row"];
export type ParcelaFinanceira = Row<"negocios_recebimentos">;
export type BeneficiarioFinanceiro = Row<"intermediacao_beneficiarios">;
export type IntermediacaoFinanceira = Omit<Row<"intermediacoes">,"payload">;
export type VendaFinanceira = Row<"negocios">;
export type RepasseFinanceiro = Row<"financeiro_repasses">;
export type CustoFinanceiro = Row<"custos_fixos">;
export type MidiaManual = Row<"custos_midia_manual">;
export interface DadosFinanceiro {
 vendas: VendaFinanceira[]; intermediacoes: IntermediacaoFinanceira[]; beneficiarios: BeneficiarioFinanceiro[];
 recebimentos: ParcelaFinanceira[]; repasses: RepasseFinanceiro[]; custos: CustoFinanceiro[]; midia_manual: MidiaManual[];
 midia: {dia:string;valor:number;atualizado_em:string}[]; cobertura_midia: {since:string;until:string;atualizado_em:string}[];
 historico: Row<"financeiro_historico">[];
}
export const FINANCEIRO_VAZIO: DadosFinanceiro = {vendas:[],intermediacoes:[],beneficiarios:[],recebimentos:[],repasses:[],custos:[],midia_manual:[],midia:[],cobertura_midia:[],historico:[]};
export function lerFinanceiro(value: unknown): DadosFinanceiro {
 if(!value || typeof value!=="object" || Array.isArray(value))throw Error("Resposta financeira inválida.");
 for(const k of Object.keys(FINANCEIRO_VAZIO)) if(!Array.isArray((value as Record<string,unknown>)[k]))throw Error("Resposta financeira incompleta.");
 return value as DadosFinanceiro;
}
export const arredondar = (n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export const noPeriodo=(d:string|null,inicio:string,fim:string)=>!!d&&d>=inicio&&d<=fim;
export function valorAlocado(b:BeneficiarioFinanceiro,r:ParcelaFinanceira,i:IntermediacaoFinanceira,parcelas:ParcelaFinanceira[] = [r]){
 const bruto=Number(i.valor_bruto??i.valor_comissao??0);
 const anteriores=parcelas.filter(p=>p.intermediacao_id===i.id&&p.status!=="cancelado"&&((p.parcela_num??0)<(r.parcela_num??0)||((p.parcela_num??0)===(r.parcela_num??0)&&p.id<r.id))).reduce((s,p)=>s+Number(p.valor),0);
 return bruto>0?arredondar(arredondar(Number(b.valor_liquido)*(anteriores+Number(r.valor))/bruto)-arredondar(Number(b.valor_liquido)*anteriores/bruto)):0;
}
export function pendenciasRepasse(d:DadosFinanceiro) {
 return d.recebimentos.filter(r=>r.status==="recebido").flatMap(r=>{
  const i=d.intermediacoes.find(x=>x.id===r.intermediacao_id);
  if(!i||i.forma_pagamento!=="nota_fiscal"||!d.vendas.some(n=>n.id===i.negocio_id&&n.status==="ativo"))return [];
  return d.beneficiarios.filter(b=>b.intermediacao_id===i.id&&b.papel!=="uhome"&&b.valor_liquido>0).map(b=>({r,i,b,valor:valorAlocado(b,r,i,d.recebimentos),repasse:d.repasses.find(p=>p.recebimento_id===r.id&&p.beneficiario_id===b.id)}));
 });
}
export function ganhosPessoas(d:DadosFinanceiro,inicio:string,fim:string){
 const grupos=new Map<string,{identidade:string;nome:string;papel:string;bruto:number;desconto:number;liquido:number;recebido:number;aReceber:number;vendas:Set<string>}>();
 for(const b of d.beneficiarios){
  const i=d.intermediacoes.find(x=>x.id===b.intermediacao_id);const n=d.vendas.find(x=>x.id===i?.negocio_id);
  if(!i||!n||n.status!=="ativo"||!noPeriodo(n.data_assinatura,inicio,fim))continue;
  const key=`${b.user_id||b.nome.trim().toLocaleLowerCase("pt-BR")}:${b.papel}`;
  const g=grupos.get(key)??{identidade:b.user_id||b.nome,nome:b.nome,papel:b.papel,bruto:0,desconto:0,liquido:0,recebido:0,aReceber:0,vendas:new Set<string>()};
  const recebidos=d.recebimentos.filter(r=>r.intermediacao_id===i.id&&r.status==="recebido");
  const pago=i.forma_pagamento==="nota_fiscal"&&b.papel!=="uhome"?d.repasses.filter(p=>p.beneficiario_id===b.id).reduce((s,p)=>s+Number(p.valor),0):recebidos.reduce((s,r)=>s+valorAlocado(b,r,i,d.recebimentos),0);
  g.bruto+=Number(b.valor_bruto);g.desconto+=Number(b.desconto);g.liquido+=Number(b.valor_liquido);g.recebido+=pago;g.aReceber+=Math.max(0,Number(b.valor_liquido)-pago);g.vendas.add(n.id);grupos.set(key,g);
 }
 return [...grupos.values()].map(g=>({...g,vendas:g.vendas.size})).sort((a,b)=>b.liquido-a.liquido);
}
export function resumoFinanceiro(d:DadosFinanceiro,inicio:string,fim:string,hoje:string){
 const ativo=(r:ParcelaFinanceira)=>d.vendas.some(n=>n.id===r.negocio_id&&n.status==="ativo");
 const pendentes=d.recebimentos.filter(r=>r.status==="pendente"&&ativo(r));
 const noPrazo=pendentes.filter(r=>noPeriodo(r.vencimento,inicio,fim));
 const recebidos=d.recebimentos.filter(r=>r.status==="recebido"&&noPeriodo(r.recebido_em,inicio,fim));
 const recebidaUhome=recebidos.reduce((s,r)=>{
  const i=d.intermediacoes.find(x=>x.id===r.intermediacao_id);if(!i)return s;
  return s+d.beneficiarios.filter(b=>b.intermediacao_id===i.id&&b.papel==="uhome").reduce((a,b)=>a+valorAlocado(b,r,i,d.recebimentos),0);
 },0);
 const geradaUhome=ganhosPessoas(d,inicio,fim).filter(g=>g.papel==="uhome").reduce((s,g)=>s+g.liquido,0);
 const midia=d.midia.reduce((s,m)=>s+Number(m.valor),0)+d.midia_manual.reduce((s,m)=>s+Number(m.valor),0);
 const fixos=d.custos.reduce((s,c)=>s+Number(c.valor),0);const custos=midia+fixos;
 const lucro=recebidaUhome-custos;
 return {aReceber:noPrazo.reduce((s,r)=>s+Number(r.valor),0),saldoTotal:pendentes.reduce((s,r)=>s+Number(r.valor),0),vencidas:pendentes.filter(r=>!!r.vencimento&&r.vencimento<hoje).reduce((s,r)=>s+Number(r.valor),0),recebido:recebidos.reduce((s,r)=>s+Number(r.valor),0),recebidaUhome,geradaUhome,midia,fixos,custos,lucro,roi:custos>0?lucro/custos*100:null,repassesPendentes:pendenciasRepasse(d).filter(x=>!x.repasse).reduce((s,x)=>s+x.valor,0)};
}
export const FORMAS_FINANCEIRO: Record<string,string>={pix:"PIX",zemo:"ZemoBank",nota_fiscal:"Nota fiscal"};
export const PAPEIS_FINANCEIRO: Record<string,string>={corretor:"Corretor",gerente:"Gerente",diretora:"Diretora",diretoria:"Diretoria",administrativo:"Administrativo",uhome:"Uhome"};
export function diasSemCobertura(d:DadosFinanceiro,inicio:string,fim:string){
 const faltam:string[]=[];let dia=inicio;
 while(dia<=fim){if(!d.cobertura_midia.some(c=>dia>=c.since&&dia<=c.until))faltam.push(dia);const t=new Date(`${dia}T12:00:00Z`);t.setUTCDate(t.getUTCDate()+1);dia=t.toISOString().slice(0,10);}
 return faltam;
}
