import { ConversaoView } from "@/pages/RelatorioConversao";
import type { RaioXTime, RaioXCorretor } from "@/hooks/useRelatorioGeral";

/**
 * PreviewRelatorioConversao — rota PÚBLICA (sem login) só pra ver o layout da
 * Conversão com os números reais validados do time do Bruno (ago/2026). A versão
 * real (escopo por RLS, dados vivos) é RelatorioConversao em /relatorio-conversao.
 */
export default function PreviewRelatorioConversao() {
  const corretores: RaioXCorretor[] = Array.from({ length: 13 }, (_, i) => ({
    user_id: `mock-${i}`, nome: `Corretor ${i + 1}`,
    leads_recebidos: 0, pipeline_ativo: 0, descartes: 0, estagnados: 0, qualif_aquec: 0, negocios_zona: 0,
    visitas_criadas: 0, visitas_realizadas: 0, no_show: 0,
    negocios_criados: 0, negocios_ativos: 0, vendas: 0,
  }));
  const time: RaioXTime = {
    gerente_id: "mock", gerente_nome: "Bruno Schuler", corretores,
    total: { leads_recebidos: 484, pipeline_ativo: 801, descartes: 253, estagnados: 97, qualif_aquec: 332, negocios_zona: 7, visitas_criadas: 84, visitas_realizadas: 42, no_show: 38, negocios_criados: 2, negocios_ativos: 45, vendas: 5 },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F1F4F9", padding: "24px 20px 60px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", fontSize: 12, color: "#5B6B7F", background: "#EAEEFF", borderRadius: 10, padding: "8px 14px", marginBottom: 18 }}>
          Preview do layout · números reais do time do Bruno (ago). A versão real (/relatorio-conversao) roda com escopo por papel.
        </div>
        <ConversaoView
          times={[time]}
          periodoLabel="Mês atual"
          filtro={<select defaultValue="mes"><option value="mes">Mês atual</option><option value="mes_passado">Mês passado</option><option value="ano">Este ano</option></select>}
        />
      </div>
    </div>
  );
}
