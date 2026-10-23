import * as XLSX from "xlsx";
import { valorVenda, documentosVenda, type VendaRelatorio, type FiltrosVendas } from "./vendasRelatorio";
export function exportarVendas(vendas: VendaRelatorio[], filtros: FiltrosVendas, periodo: { start: string; end: string }) {
  const wb=XLSX.utils.book_new();
  const rows=vendas.map(v=>({Data:v.data_assinatura,Cliente:v.nome_cliente,Empreendimento:v.empreendimento,Construtora:v.construtora,Unidade:v.unidade,Corretor:v.rateios.map(r=>r.corretor_nome).join(" / "),Equipe:[...new Set(v.rateios.map(r=>r.equipe))].join(" / "),VGV:valorVenda(v,filtros),Documentos:documentosVenda(v).join(", ")||"Completa",Origem:v.origem,Campanha:v.campanha}));
  const ws=XLSX.utils.json_to_sheet(rows); ws['!cols']=[{wch:12},{wch:30},{wch:28},{wch:18},{wch:14},{wch:30},{wch:25},{wch:18},{wch:32},{wch:20},{wch:35}];
  XLSX.utils.book_append_sheet(wb,ws,"Vendas");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{De:periodo.start,Ate:periodo.end,...filtros}]),"Filtros");
  XLSX.writeFile(wb,`Vendas_${periodo.start}_${periodo.end}.xlsx`);
}