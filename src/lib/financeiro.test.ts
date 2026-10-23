import {describe,it,expect} from "vitest";
import {FINANCEIRO_VAZIO,ganhosPessoas,resumoFinanceiro,valorAlocado,diasSemCobertura,pendenciasRepasse,type DadosFinanceiro,type BeneficiarioFinanceiro,type IntermediacaoFinanceira,type ParcelaFinanceira,type VendaFinanceira,type CustoFinanceiro,type MidiaManual,type RepasseFinanceiro} from "./financeiro";
const venda={id:"n",fase:"ganho",status:"ativo",data_assinatura:"2026-10-22"} as VendaFinanceira;
const i={id:"i",negocio_id:"n",status:"ativa",forma_pagamento:"nota_fiscal",valor_bruto:10000,valor_liquido:9000} as IntermediacaoFinanceira;
const b={id:"b",nome:"Corretor",papel:"corretor",intermediacao_id:"i",valor_bruto:4000,desconto:400,valor_liquido:3600} as BeneficiarioFinanceiro;
const r={id:"r",intermediacao_id:"i",negocio_id:"n",valor:5000,status:"recebido",recebido_em:"2026-10-22",vencimento:"2026-10-22"} as ParcelaFinanceira;
const d:DadosFinanceiro={...FINANCEIRO_VAZIO,vendas:[venda],intermediacoes:[i],beneficiarios:[b],recebimentos:[r]};
describe("Financeiro da intermediação",()=>{
 it("repasses parcelados conservam todos os centavos do líquido",()=>{const inter={...i,valor_bruto:1};const benef={...b,valor_liquido:0.9};const ps=[0.33,0.33,0.34].map((valor,j)=>({...r,id:`r${j}`,parcela_num:j+1,valor}));expect(ps.map(p=>valorAlocado(benef,p,inter,ps))).toEqual([0.3,0.29,0.31]);expect(ps.reduce((s,p)=>s+valorAlocado(benef,p,inter,ps),0)).toBeCloseTo(0.9,2);});
 it("NF reduz 10% e parcela de metade do bruto tem líquido proporcional",()=>expect(valorAlocado(b,r,i)).toBe(1800));
 it("NF recebida na Uhome não presume repasse ao corretor",()=>expect(ganhosPessoas(d,"2026-10-01","2026-10-23")[0]).toMatchObject({liquido:3600,recebido:0,aReceber:3600}));
 it("NF conta só repasses comprovados da parcela recebida da mesma intermediação e venda",()=>{
  const parcelas=[r,{...r,id:"outra",intermediacao_id:"i2",negocio_id:"n2"},{...r,id:"pendente",status:"pendente"},{...r,id:"cancelada",status:"cancelado"}];
  const repasses=[{id:"p",beneficiario_id:"b",recebimento_id:"r",valor:1800,pago_em:"2026-10-23"},{id:"p2",beneficiario_id:"b",recebimento_id:"outra",valor:999},{id:"p3",beneficiario_id:"b",recebimento_id:"pendente",valor:888},{id:"p4",beneficiario_id:"b",recebimento_id:"cancelada",valor:777},{id:"p5",beneficiario_id:"b2",recebimento_id:"r",valor:666}] as RepasseFinanceiro[];
  expect(ganhosPessoas({...d,recebimentos:parcelas,repasses},"2026-10-01","2026-10-23")[0]).toMatchObject({liquido:3600,recebido:1800,aReceber:1800});
 });
 it("intermediações substituídas não geram ganhos ou repasses",()=>{
  const dados={...d,intermediacoes:[{...i,status:"substituida"}]};
  expect(ganhosPessoas(dados,"2026-10-01","2026-10-23")).toEqual([]);
  expect(pendenciasRepasse(dados)).toEqual([]);
 });
 it("PIX confirmado é ganho direto sem repasse presumido pela Uhome",()=>expect(ganhosPessoas({...d,intermediacoes:[{...i,forma_pagamento:"pix",valor_liquido:10000}],beneficiarios:[{...b,desconto:0,valor_liquido:4000}]},"2026-10-01","2026-10-23")[0].recebido).toBe(2000));
 it("venda sem intermediação não inventa comissão",()=>expect(resumoFinanceiro({...FINANCEIRO_VAZIO,vendas:[venda]},"2026-10-01","2026-10-23","2026-10-23").geradaUhome).toBe(0));
 it("distrato preserva recebido e repasses para conferência sem inventar saldo ativo",()=>{const x={...d,vendas:[{...venda,status:"distratado"}],recebimentos:[r,{...r,id:"pendente",status:"pendente"}]};expect(ganhosPessoas(x,"2026-10-01","2026-10-23")).toEqual([]);expect(resumoFinanceiro(x,"2026-10-01","2026-10-23","2026-10-23")).toMatchObject({recebido:5000,aReceber:0,saldoTotal:0,repassesPendentes:0});expect(pendenciasRepasse(x)).toHaveLength(1);expect(pendenciasRepasse(x)[0]).toMatchObject({distratado:true,valor:1800});});
 it("custo e lucro usam apenas parte da Uhome, não a comissão inteira",()=>{const x={...d,beneficiarios:[{...b,papel:"uhome"}],midia:[{dia:"2026-10-22",valor:100,atualizado_em:""}]};expect(resumoFinanceiro(x,"2026-10-01","2026-10-23","2026-10-23")).toMatchObject({recebidaUhome:1800,custos:100,lucro:1700,roi:1700});});
 it("ausência de mídia não significa gasto zero confirmado",()=>expect(diasSemCobertura({...d,cobertura_midia:[{since:"2026-10-22",until:"2026-10-23",atualizado_em:""}]},"2026-10-21","2026-10-23")).toEqual(["2026-10-21"]));
 it("busca por cliente soma apenas suas vendas, não as demais da pessoa",()=>{
  const dados={...d,vendas:[venda,{...venda,id:"n2"}],intermediacoes:[{...i,comprador_nome:"Cliente A"},{...i,id:"i2",negocio_id:"n2",comprador_nome:"Cliente B"}],beneficiarios:[b,{...b,id:"b2",intermediacao_id:"i2"}]};
  expect(ganhosPessoas(dados,"2026-10-01","2026-10-23","Cliente A")[0]).toMatchObject({vendas:1,liquido:3600});
  expect(ganhosPessoas(dados,"2026-10-01","2026-10-23","Corretor")[0]).toMatchObject({vendas:2,liquido:7200});
  expect(ganhosPessoas(dados,"2026-10-01","2026-10-23","Cliente A","gerente")).toEqual([]);
 });
 it("custos e mídia respeitam o período mesmo com dados de outros meses",()=>{
  const dados={...d,midia:[{dia:"2026-09-30",valor:999,atualizado_em:""},{dia:"2026-10-22",valor:100,atualizado_em:""}],custos:[{competencia:"2026-09-30",valor:888},{competencia:"2026-10-22",valor:200}] as CustoFinanceiro[],midia_manual:[{competencia:"2026-09-30",valor:777},{competencia:"2026-10-22",valor:300}] as MidiaManual[]};
  expect(resumoFinanceiro(dados,"2026-10-01","2026-10-23","2026-10-23")).toMatchObject({midia:400,fixos:200,custos:600});
 });
});
