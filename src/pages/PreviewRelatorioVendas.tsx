import { VendasView } from "@/pages/RelatorioVendas";
import type { RelVendas } from "@/hooks/useVendas";

/** Rota PÚBLICA de layout da aba Vendas, com números reais do time do Bruno (ago). */
export default function PreviewRelatorioVendas() {
  const corretores = [
    { user_id: "1", nome: "Rafaela Sandin", vendas: 1, vgv: 450000 },
    { user_id: "2", nome: "Ebert Silva", vendas: 1, vgv: 380000 },
    { user_id: "3", nome: "Matheus Pasin", vendas: 1, vgv: 350000 },
    { user_id: "4", nome: "William Brizola", vendas: 1, vgv: 320000 },
    { user_id: "5", nome: "Larissa Barbosa", vendas: 1, vgv: 267500 },
  ];
  const data: RelVendas = {
    times: [{ equipe: "Bruno Schuler", corretores, total: { vendas: 5, vgv: 1767500 } }],
    total: { vendas: 5, vgv: 1767500 }, ticketMedio: 353500,
  };
  return (
    <div style={{ minHeight: "100vh", background: "#F1F4F9", padding: "24px 20px 60px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", fontSize: 12, color: "#5B6B7F", background: "#EAEEFF", borderRadius: 10, padding: "8px 14px", marginBottom: 18 }}>
          Preview do layout · números reais do time do Bruno (ago). Real: /relatorio-vendas (escopo por papel).
        </div>
        <VendasView data={data} periodoLabel="Mês atual"
          filtro={<select defaultValue="mes"><option value="mes">Mês atual</option><option value="mes_passado">Mês passado</option><option value="ano">Este ano</option></select>} />
      </div>
    </div>
  );
}
