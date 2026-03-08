import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Phone, Award, MapPin, Target } from "lucide-react";
import { format, subDays } from "date-fns";

const pct = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100);
const fmt = (n: number) => n.toLocaleString("pt-BR");
const fmtR = (n: number) => `R$ ${n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : n >= 1_000 ? (n / 1_000).toFixed(0) + "k" : n}`;

interface Props {
  teamUserIds: string[];
  teamNameMap: Record<string, string>;
}

interface RelatorioData {
  periodo: string;
  total_ligacoes: number;
  total_aproveitados: number;
  taxa_aproveitamento: number;
  total_visitas_realizadas: number;
  total_visitas_marcadas: number;
  vgv_gerado: number;
  vgv_assinado: number;
  por_corretor: { nome: string; ligacoes: number; aproveitados: number; visitas: number; propostas: number }[];
}

export default function RelatoriosTab({ teamUserIds, teamNameMap }: Props) {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<"hoje" | "semana" | "mes">("semana");
  const [relatorio, setRelatorio] = useState<RelatorioData | null>(null);

  const load = useCallback(async () => {
    if (!user || teamUserIds.length === 0) return;
    const hoje = new Date();
    let inicio: Date;
    if (periodo === "hoje") inicio = hoje;
    else if (periodo === "semana") inicio = subDays(hoje, 7);
    else inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    const inicioStr = format(inicio, "yyyy-MM-dd");
    const fimStr = format(hoje, "yyyy-MM-dd");

    const [{ data: tent }, { data: vis }, { data: neg }] = await Promise.all([
      supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado").in("corretor_id", teamUserIds).gte("created_at", `${inicioStr}T00:00:00`).lte("created_at", `${fimStr}T23:59:59`),
      supabase.from("visitas").select("corretor_id, status").in("corretor_id", teamUserIds).gte("data_visita", inicioStr).lte("data_visita", fimStr),
      supabase.from("negocios").select("corretor_id, vgv_estimado, vgv_final, fase").eq("gerente_id", user.id).gte("created_at", `${inicioStr}T00:00:00`).lte("created_at", `${fimStr}T23:59:59`),
    ]);

    const ligMap: Record<string, number> = {};
    const aprovMap: Record<string, number> = {};
    tent?.forEach(t => { ligMap[t.corretor_id] = (ligMap[t.corretor_id] || 0) + 1; if (t.resultado === "com_interesse") aprovMap[t.corretor_id] = (aprovMap[t.corretor_id] || 0) + 1; });

    const vrMap: Record<string, number> = {};
    const vmMap: Record<string, number> = {};
    vis?.forEach(v => { if (v.corretor_id) { vmMap[v.corretor_id] = (vmMap[v.corretor_id] || 0) + 1; if (v.status === "realizada") vrMap[v.corretor_id] = (vrMap[v.corretor_id] || 0) + 1; } });

    const propMap: Record<string, number> = {};
    let vgvGerado = 0, vgvAssinado = 0;
    neg?.forEach(n => { if (n.corretor_id) propMap[n.corretor_id] = (propMap[n.corretor_id] || 0) + 1; vgvGerado += Number(n.vgv_estimado ?? 0); if (n.fase === "assinado") vgvAssinado += Number(n.vgv_final ?? 0); });

    const totalLig = Object.values(ligMap).reduce((a, b) => a + b, 0);
    const totalAprov = Object.values(aprovMap).reduce((a, b) => a + b, 0);

    setRelatorio({
      periodo: `${format(inicio, "dd/MM")} a ${format(hoje, "dd/MM/yyyy")}`,
      total_ligacoes: totalLig,
      total_aproveitados: totalAprov,
      taxa_aproveitamento: pct(totalAprov, totalLig),
      total_visitas_marcadas: Object.values(vmMap).reduce((a, b) => a + b, 0),
      total_visitas_realizadas: Object.values(vrMap).reduce((a, b) => a + b, 0),
      vgv_gerado: vgvGerado,
      vgv_assinado: vgvAssinado,
      por_corretor: teamUserIds.map(id => ({
        nome: teamNameMap[id] || "Corretor",
        ligacoes: ligMap[id] ?? 0,
        aproveitados: aprovMap[id] ?? 0,
        visitas: vrMap[id] ?? 0,
        propostas: propMap[id] ?? 0,
      })).sort((a, b) => b.ligacoes - a.ligacoes),
    });
  }, [user, periodo, teamUserIds, teamNameMap]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-white border border-gray-200 rounded-b-xl rounded-tr-xl p-5">
      <div className="flex items-center gap-3 mb-5">
        <select value={periodo} onChange={e => setPeriodo(e.target.value as any)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400">
          <option value="hoje">Hoje</option>
          <option value="semana">Última Semana</option>
          <option value="mes">Este Mês</option>
        </select>
        {relatorio && <span className="text-xs text-gray-400">Período: {relatorio.periodo}</span>}
      </div>

      {!relatorio ? (
        <p className="text-center text-gray-400 py-10">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Ligações", value: fmt(relatorio.total_ligacoes), sub: `${relatorio.taxa_aproveitamento}% aproveitamento`, icon: <Phone size={16} className="text-blue-500" /> },
              { label: "Aproveitados", value: fmt(relatorio.total_aproveitados), sub: `de ${fmt(relatorio.total_ligacoes)} tentativas`, icon: <Award size={16} className="text-green-500" /> },
              { label: "Visitas", value: `${relatorio.total_visitas_realizadas}/${relatorio.total_visitas_marcadas}`, sub: "realizadas/marcadas", icon: <MapPin size={16} className="text-amber-500" /> },
              { label: "VGV", value: fmtR(relatorio.vgv_assinado), sub: `Gerado: ${fmtR(relatorio.vgv_gerado)}`, icon: <Target size={16} className="text-purple-500" /> },
            ].map(card => (
              <div key={card.label} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">{card.icon}<span className="text-xs text-gray-500">{card.label}</span></div>
                <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Desempenho por Corretor</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="text-left py-2 font-medium">Corretor</th>
                  <th className="text-center py-2 font-medium">Ligações</th>
                  <th className="text-center py-2 font-medium">Aproveitados</th>
                  <th className="text-center py-2 font-medium">Taxa %</th>
                  <th className="text-center py-2 font-medium">Visitas</th>
                  <th className="text-center py-2 font-medium">Propostas</th>
                </tr>
              </thead>
              <tbody>
                {relatorio.por_corretor.map((c, i) => (
                  <tr key={c.nome} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 font-medium text-gray-700"><span className="text-gray-400 text-xs mr-2">#{i + 1}</span>{c.nome}</td>
                    <td className="text-center py-2.5 font-semibold text-blue-600">{c.ligacoes}</td>
                    <td className="text-center py-2.5 font-semibold text-green-600">{c.aproveitados}</td>
                    <td className="text-center py-2.5">
                      <span className={`text-xs font-bold ${pct(c.aproveitados, c.ligacoes) >= 10 ? "text-green-500" : "text-amber-500"}`}>
                        {pct(c.aproveitados, c.ligacoes)}%
                      </span>
                    </td>
                    <td className="text-center py-2.5 text-amber-600">{c.visitas}</td>
                    <td className="text-center py-2.5 text-purple-600">{c.propostas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
