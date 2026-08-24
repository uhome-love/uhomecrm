import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import RelatorioGeral from "@/pages/RelatorioGeral";
import RaioXCorretorPage from "@/pages/RaioXCorretorPage";
import {
  PERIODO_OPCOES, calcJanela, hojeBRT, labelJanela, labelOpcao,
  type PeriodoOpt,
} from "@/lib/periodoFiltro";

/**
 * Relatorios — a página única de relatórios do CRM, em 2 abas:
 *   • Raio-X do Time     → visão por equipe (RelatorioGeral: raio-x + conversão + PDF)
 *   • Raio-X do Corretor → visão individual (RaioXCorretorPage: cards + PDF)
 *
 * O período é ÚNICO para as duas abas e vive na URL (?periodo=&de=&ate=),
 * usando a régua oficial `periodoFiltro`. Padrão: mês acumulado (1º até hoje).
 *
 * Escopo por papel:
 *   - CEO/Diretora (admin/diretor): as duas abas, selecionam qualquer equipe/corretor.
 *   - Gerente (gestor): as duas abas, só sua equipe/corretores (RLS + seletores).
 *   - Corretor: SÓ a aba Raio-X do Corretor, travada nele mesmo.
 * (O escopo real dos dados é garantido por RLS + pelos seletores de cada aba.)
 */

type Aba = "time" | "corretor";

const REL_STYLE = `
  .relwrap{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,system-ui,sans-serif;}
  .relwrap .rel-tabs{display:inline-flex;gap:4px;background:#EEF2F8;border:1px solid #E4E9F1;border-radius:12px;padding:4px;}
  .relwrap .rel-tabs button{border:0;background:transparent;color:#5B6B7F;font:inherit;font-size:13.5px;font-weight:750;padding:9px 18px;border-radius:9px;cursor:pointer;transition:.15s;}
  .relwrap .rel-tabs button.on{background:#fff;color:#2E44C7;box-shadow:0 1px 2px rgba(16,27,45,.06),0 6px 16px rgba(16,27,45,.06);}
  .relwrap .rel-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:18px;}
  .relwrap .rel-per{display:flex;align-items:center;gap:6px;}
  .relwrap .rel-per label{font-size:12px;font-weight:700;color:#5B6B7F;}
  .relwrap .rel-per select,.relwrap .rel-per input{font:inherit;font-size:13px;font-weight:650;color:#0F1B2D;background:#fff;border:1px solid #D2DAE6;border-radius:10px;padding:8px 12px;cursor:pointer;}
  .relwrap .rel-janela{font-size:11.5px;color:#93A0B2;}
  .relwrap .rel-load{padding:60px;text-align:center;color:#93A0B2;font-size:13px;}
  @media print{ .rel-bar{display:none !important;} }
`;

export default function Relatorios() {
  const { isGestor, loading } = useUserRole();
  const [abaManual, setAbaManual] = useState<Aba | null>(null);
  const [params, setParams] = useSearchParams();

  const hoje = hojeBRT();
  const bruto = params.get("periodo");
  const opt: PeriodoOpt = PERIODO_OPCOES.some((o) => o.value === bruto)
    ? (bruto as PeriodoOpt)
    : "mes";
  const custom = {
    inicio: params.get("de") || `${hoje.slice(0, 8)}01`,
    fim: params.get("ate") || hoje,
  };

  const set = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => p.set(k, v));
    setParams(p, { replace: true });
  };

  const janela = useMemo(() => calcJanela(opt, custom), [opt, custom.inicio, custom.fim]);
  const label = opt === "custom" ? labelJanela(janela) : labelOpcao(opt);

  // Corretor puro: sempre a aba do corretor. Gestão: default "time", troca no clique.
  const aba: Aba = !isGestor ? "corretor" : (abaManual ?? "time");

  if (loading) {
    return <div className="relwrap"><style>{REL_STYLE}</style><div className="rel-load">Carregando relatórios…</div></div>;
  }

  return (
    <div className="relwrap">
      <style>{REL_STYLE}</style>

      <div className="rel-bar rel-noprint">
        {isGestor && (
          <div className="rel-tabs">
            <button className={aba === "time" ? "on" : ""} onClick={() => setAbaManual("time")}>Raio-X do Time</button>
            <button className={aba === "corretor" ? "on" : ""} onClick={() => setAbaManual("corretor")}>Raio-X do Corretor</button>
          </div>
        )}

        <div className="rel-per">
          <label htmlFor="rel-periodo">Período</label>
          <select id="rel-periodo" value={opt} onChange={(e) => set({ periodo: e.target.value })}>
            {PERIODO_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {opt === "custom" && (
          <>
            <div className="rel-per">
              <label htmlFor="rel-de">De</label>
              <input id="rel-de" type="date" value={custom.inicio} max={custom.fim}
                     onChange={(e) => set({ de: e.target.value })} />
            </div>
            <div className="rel-per">
              <label htmlFor="rel-ate">Até</label>
              <input id="rel-ate" type="date" value={custom.fim} min={custom.inicio}
                     onChange={(e) => set({ ate: e.target.value })} />
            </div>
          </>
        )}

        <span className="rel-janela">{labelJanela(janela)}</span>
      </div>

      {aba === "time"
        ? <RelatorioGeral janela={janela} periodoLabel={label} />
        : <RaioXCorretorPage esconderPeriodo />}
    </div>
  );
}
