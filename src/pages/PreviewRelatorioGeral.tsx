import { RaioXView } from "@/pages/RelatorioGeral";
import { ConversaoView } from "@/pages/RelatorioConversao";
import type { RaioXCorretor, RaioXTime } from "@/hooks/useRelatorioGeral";

/**
 * PreviewRelatorioGeral — rota PÚBLICA (sem login) só pra ver o layout do
 * Raio-X do Time com dados de EXEMPLO. A versão real (dados verdadeiros, escopo
 * por RLS) é RelatorioGeral em /relatorio-geral (protegida).
 */

// [nome, leads, pipeline, descartes, estagnados, vCriadas, vReal, noShow, nCriados, nAtivos, vendas]
const MOCK: [string, number, number, number, number, number, number, number, number, number, number][] = [
  ["Billy John", 35, 60, 22, 7, 8, 4, 4, 1, 3, 0],
  ["Ebert Silva", 55, 108, 34, 14, 10, 5, 4, 0, 6, 1],
  ["Gustavo Niz", 40, 80, 26, 9, 7, 4, 3, 0, 4, 0],
  ["Larissa Barbosa", 38, 70, 24, 8, 9, 5, 4, 0, 4, 1],
  ["Luiza Clós", 48, 93, 30, 12, 8, 4, 3, 0, 5, 0],
  ["Matheus Pasin", 44, 91, 28, 11, 9, 5, 4, 1, 5, 1],
  ["Rafaela Sandin", 62, 137, 38, 18, 12, 6, 5, 0, 8, 1],
  ["William Brizola", 51, 112, 31, 13, 11, 6, 5, 0, 7, 1],
];

export default function PreviewRelatorioGeral() {
  const corretores: RaioXCorretor[] = MOCK.map((m, i) => ({
    user_id: `mock-${i}`, nome: m[0],
    leads_recebidos: m[1], pipeline_ativo: m[2], descartes: m[3], estagnados: m[4],
    qualif_aquec: Math.round(m[1] * 0.69), negocios_zona: i < 7 ? 1 : 0,
    visitas_criadas: m[5], visitas_realizadas: m[6], no_show: m[7],
    negocios_criados: m[8], negocios_ativos: m[9], vendas: m[10],
  }));
  const total = corretores.reduce((a, c) => ({
    leads_recebidos: a.leads_recebidos + c.leads_recebidos, pipeline_ativo: a.pipeline_ativo + c.pipeline_ativo,
    descartes: a.descartes + c.descartes, estagnados: a.estagnados + c.estagnados,
    qualif_aquec: a.qualif_aquec + c.qualif_aquec, negocios_zona: a.negocios_zona + c.negocios_zona,
    visitas_criadas: a.visitas_criadas + c.visitas_criadas, visitas_realizadas: a.visitas_realizadas + c.visitas_realizadas,
    no_show: a.no_show + c.no_show, negocios_criados: a.negocios_criados + c.negocios_criados,
    negocios_ativos: a.negocios_ativos + c.negocios_ativos, vendas: a.vendas + c.vendas,
  }), { leads_recebidos: 0, pipeline_ativo: 0, descartes: 0, estagnados: 0, qualif_aquec: 0, negocios_zona: 0, visitas_criadas: 0, visitas_realizadas: 0, no_show: 0, negocios_criados: 0, negocios_ativos: 0, vendas: 0 });

  const time: RaioXTime = { gerente_id: "mock", gerente_nome: "Bruno Schuler", corretores, total };

  return (
    <div style={{ minHeight: "100vh", background: "#F1F4F9", padding: "24px 20px 60px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ textAlign: "center", fontSize: 12, color: "#5B6B7F", background: "#EAEEFF", borderRadius: 10, padding: "8px 14px", marginBottom: 18 }}>
          Preview do layout · <b>dados de exemplo</b>. A versão real (/relatorio-geral) mostra os números verdadeiros do time.
        </div>
        <RaioXView
          times={[time]}
          totalGeral={total}
          periodoLabel="Mês atual"
          filtro={<><select defaultValue="mes"><option value="mes">Mês atual</option><option value="mes_passado">Mês passado</option><option value="ano">Este ano</option></select><button className="rg-pdf" onClick={() => window.print()}>⬇ Baixar PDF</button></>}
        />
        <div style={{ marginTop: 8 }}>
          <ConversaoView times={[time]} periodoLabel="Mês atual" />
        </div>
      </div>
    </div>
  );
}
