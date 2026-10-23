import * as XLSX from "xlsx";
import {ganhosPessoas,noPeriodo,resumoFinanceiro,FORMAS_FINANCEIRO,type DadosFinanceiro} from "./financeiro";
export function exportarFinanceiro(d:DadosFinanceiro,inicio:string,fim:string,hoje:string){
 const book=XLSX.utils.book_new();const adicionar=(nome:string,rows:object[])=>XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(rows),nome);
 adicionar("Resumo",[resumoFinanceiro(d,inicio,fim,hoje)]);
 adicionar("Parcelas",d.recebimentos.filter(r=>noPeriodo(r.status==="recebido"?r.recebido_em:r.vencimento,inicio,fim)).map(r=>({Cliente:d.vendas.find(n=>n.id===r.negocio_id)?.nome_cliente,Parcela:r.parcela_num,Vencimento:r.vencimento,Forma:FORMAS_FINANCEIRO[r.forma??""]??"Pendente",Bruto:r.valor,Situação:r.status,Recebido:r.recebido_em})));
 adicionar("Ganhos",ganhosPessoas(d,inicio,fim));adicionar("Custos",d.custos.map(c=>({Data:c.competencia,Categoria:c.categoria,Descrição:c.descricao,Valor:c.valor})));adicionar("Mídia",[...d.midia.map(m=>({Data:m.dia,Canal:"Meta Ads",Valor:m.valor})),...d.midia_manual.map(m=>({Data:m.competencia,Canal:m.canal,Valor:m.valor}))]);
 XLSX.writeFile(book,`Financeiro_${inicio}_${fim}.xlsx`);
}
