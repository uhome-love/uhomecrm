import { VisitasView } from "@/pages/RelatorioVisitas";
import type { RaioXTime, RaioXCorretor } from "@/hooks/useRelatorioGeral";

/** Rota PÚBLICA de layout da aba Visitas, dados de exemplo (time do Bruno). */
export default function PreviewRelatorioVisitas() {
  // [nome, criadas, realizadas, no_show]
  const mock: [string, number, number, number][] = [
    ["Billy John", 8, 4, 4], ["Ebert Silva", 10, 5, 4], ["Gustavo Niz", 7, 4, 3],
    ["Larissa Barbosa", 9, 5, 4], ["Luiza Clós", 8, 4, 3], ["Matheus Pasin", 9, 5, 4],
    ["Rafaela Sandin", 12, 6, 5], ["William Brizola", 11, 6, 5],
  ];
  const corretores: RaioXCorretor[] = mock.map((m, i) => ({
    user_id: `mock-${i}`, nome: m[0],
    leads_recebidos: 0, pipeline_ativo: 0, descartes: 0, estagnados: 0, qualif_aquec: 0, negocios_zona: 0,
    visitas_criadas: m[1], visitas_realizadas: m[2], no_show: m[3],
    negocios_criados: 0, negocios_ativos: 0, vendas: 0,
  }));
  const total = corretores.reduce((a, c) => { for (const k of Object.keys(a) as (keyof typeof a)[]) a[k] += (c[k] as number); return a; }, { leads_recebidos: 0, pipeline_ativo: 0, descartes: 0, estagnados: 0, qualif_aquec: 0, negocios_zona: 0, visitas_criadas: 0, visitas_realizadas: 0, no_show: 0, negocios_criados: 0, negocios_ativos: 0, vendas: 0 });
  const time: RaioXTime = { gerente_id: "mock", gerente_nome: "Bruno Schuler", corretores, total };

  return (
    <div style={{ minHeight: "100vh", background: "#F1F4F9", padding: "24px 20px 60px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", fontSize: 12, color: "#5B6B7F", background: "#EAEEFF", borderRadius: 10, padding: "8px 14px", marginBottom: 18 }}>
          Preview do layout · dados de exemplo. Real: /relatorio-visitas (escopo por papel).
        </div>
        <VisitasView times={[time]} periodoLabel="Mês atual"
          filtro={<select defaultValue="mes"><option value="mes">Mês atual</option><option value="mes_passado">Mês passado</option><option value="ano">Este ano</option></select>} />
      </div>
    </div>
  );
}
