import * as XLSX from "xlsx";
import {ganhosPessoas,resumoFinanceiro,FORMAS_FINANCEIRO,type DadosFinanceiro} from "./financeiro";
import {custosNoPeriodo,dadosPorBusca,parcelasSelecionadas} from "./financeiroSelecao";
export function exportarFinanceiro(dados:DadosFinanceiro,inicio:string,fim:string,hoje:string,busca="",papel="todos",modoPendente="periodo",modoRecebido="periodo"){
 const d={...dadosPorBusca(dados,busca),...custosNoPeriodo(dados,inicio,fim)};
 const book=XLSX.utils.book_new();const adicionar=(nome:string,rows:object[])=>XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(rows),nome);
 adicionar("Resumo",[resumoFinanceiro(d,inicio,fim,hoje)]);
 adicionar("Filtros",[{De:inicio,Até:fim,Busca:busca,Papel:papel,"A receber":modoPendente,Recebido:modoRecebido}]);
 adicionar("Parcelas",[...parcelasSelecionadas(dados,inicio,fim,hoje,busca,false,modoPendente),...parcelasSelecionadas(dados,inicio,fim,hoje,busca,true,modoRecebido)].map(r=>({Cliente:dados.vendas.find(n=>n.id===r.negocio_id)?.nome_cliente,Parcela:r.parcela_num,Vencimento:r.vencimento,Forma:FORMAS_FINANCEIRO[r.forma??""]??"Pendente",Bruto:r.valor,Situação:r.status,Recebido:r.recebido_em})));
 adicionar("Ganhos",ganhosPessoas(dados,inicio,fim,busca,papel));adicionar("Custos",d.custos.map(c=>({Data:c.competencia,Categoria:c.categoria,Descrição:c.descricao,Valor:c.valor})));adicionar("Mídia",[...d.midia.map(m=>({Data:m.dia,Canal:"Meta Ads",Valor:m.valor})),...d.midia_manual.map(m=>({Data:m.competencia,Canal:m.canal,Valor:m.valor}))]);
 XLSX.writeFile(book,`Financeiro_${inicio}_${fim}.xlsx`);
}
