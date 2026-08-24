import { useState, type ReactNode } from "react";
import { useRelatorioGeral, type RaioXCorretor, type RaioXTime, type RelatorioGeral as RGData } from "@/hooks/useRelatorioGeral";
import { ConversaoView } from "@/pages/RelatorioConversao";

/**
 * RelatorioGeral — aba GERAL dos relatórios: o Raio-X do Time. Caminho completo
 * do corretor (lead → venda) numa linha, agrupado por time. Dados reais, escopo
 * por RLS. Só leitura. RaioXView é a parte visual (reutilizada pelo preview).
 */

const COLS: { key: keyof RaioXCorretor; label: string; grupo: "leads" | "visitas" | "negocios"; alerta?: "estag" | "venda" | "noshow" }[] = [
  { key: "leads_recebidos", label: "Recebidos", grupo: "leads" },
  { key: "pipeline_ativo", label: "Pipeline", grupo: "leads" },
  { key: "descartes", label: "Descartes", grupo: "leads" },
  { key: "estagnados", label: "Estagnados", grupo: "leads", alerta: "estag" },
  { key: "visitas_criadas", label: "Criadas", grupo: "visitas" },
  { key: "visitas_realizadas", label: "Realizadas", grupo: "visitas" },
  { key: "no_show", label: "No-show", grupo: "visitas", alerta: "noshow" },
  { key: "negocios_criados", label: "Criados", grupo: "negocios" },
  { key: "negocios_ativos", label: "Ativos", grupo: "negocios" },
  { key: "vendas", label: "Vendas", grupo: "negocios", alerta: "venda" },
];

function cellClass(alerta: string | undefined, valor: number): string {
  if (alerta === "estag" && valor > 0) return "rg-bad";
  if (alerta === "noshow" && valor > 0) return "rg-warn";
  if (alerta === "venda" && valor > 0) return "rg-good";
  return "";
}

function Tabela({ time }: { time: RaioXTime }) {
  return (
    <div className="rg-block">
      <div className="rg-th">
        <span className="rg-tname">{time.gerente_nome}</span>
        <span className="rg-tsub">Equipe · {time.corretores.length} corretores</span>
      </div>
      <div className="rg-scroll">
        <table className="rg-table">
          <thead>
            <tr className="rg-grp">
              <th className="rg-name-h" rowSpan={2}>Corretor</th>
              <th colSpan={4} className="g-leads">Leads</th>
              <th colSpan={3} className="g-visitas">Visitas</th>
              <th colSpan={3} className="g-negocios">Negócios</th>
            </tr>
            <tr className="rg-sub">
              {COLS.map((c) => <th key={c.key} className={`s-${c.grupo}`}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {time.corretores.map((c) => (
              <tr key={c.user_id}>
                <td className="rg-name">
                  <a className="rg-link" href={`/raio-x-corretor?corretor=${c.user_id}`}>{c.nome}</a>
                </td>
                {COLS.map((col) => (
                  <td key={col.key} className={`rg-num ${cellClass(col.alerta, c[col.key] as number)}`}>{c[col.key] as number}</td>
                ))}
              </tr>
            ))}
            <tr className="rg-total">
              <td className="rg-name">Total do time</td>
              {COLS.map((col) => (
                <td key={col.key} className={`rg-num ${cellClass(col.alerta, time.total[col.key] as number)}`}>{time.total[col.key] as number}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const RG_STYLE = `
  .rgeral{
    --surface:#FFFFFF; --surface-2:#F7F9FC; --surface-3:#EEF2F8;
    --ink:#0F1B2D; --muted:#5B6B7F; --faint:#93A0B2;
    --border:#E4E9F1; --border-strong:#D2DAE6; --accent:#4969FF; --accent-ink:#2E44C7;
    --good:#0B7A50; --warn:#9E680F; --bad:#C2410C;
    color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,system-ui,sans-serif;
  }
  .rgeral *{box-sizing:border-box}
  .rgeral .rg-head{margin-bottom:18px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;}
  .rgeral .rg-head h1{font-size:21px;font-weight:850;margin:0;letter-spacing:-.015em;}
  .rgeral .rg-head p{font-size:12.5px;color:var(--muted);margin:5px 0 0;}
  .rgeral .rg-filter{display:flex;align-items:center;gap:8px;}
  .rgeral .rg-filter label{font-size:11.5px;font-weight:700;color:var(--muted);}
  .rgeral .rg-filter select{font:inherit;font-size:13px;font-weight:650;color:var(--ink);background:var(--surface);border:1px solid var(--border-strong);border-radius:10px;padding:8px 12px;cursor:pointer;}
  .rgeral .rg-block{margin-bottom:20px;border:1px solid var(--border);border-radius:16px;overflow:hidden;background:var(--surface);box-shadow:0 1px 2px rgba(16,27,45,.04),0 10px 28px rgba(16,27,45,.06);}
  .rgeral .rg-th{padding:14px 18px;background:var(--surface-2);border-bottom:1px solid var(--border);display:flex;align-items:baseline;gap:10px;}
  .rgeral .rg-tname{font-size:15px;font-weight:850;}
  .rgeral .rg-tsub{font-size:11.5px;color:var(--muted);}
  .rgeral .rg-scroll{overflow-x:auto;}
  .rgeral table.rg-table{border-collapse:collapse;width:100%;min-width:840px;font-variant-numeric:tabular-nums;}
  .rgeral .rg-table th,.rgeral .rg-table td{padding:10px 10px;text-align:center;font-size:12.5px;white-space:nowrap;}
  .rgeral .rg-grp th{font-size:10px;font-weight:850;letter-spacing:.07em;text-transform:uppercase;padding-top:12px;padding-bottom:6px;}
  .rgeral .rg-grp th.g-leads{color:var(--accent-ink);border-bottom:2px solid #DCE3FF;}
  .rgeral .rg-grp th.g-visitas{color:var(--good);border-bottom:2px solid #CFE9DC;}
  .rgeral .rg-grp th.g-negocios{color:var(--warn);border-bottom:2px solid #F0E2C6;}
  .rgeral .rg-sub th{font-size:10.5px;font-weight:700;color:var(--muted);padding-top:6px;padding-bottom:9px;border-bottom:1px solid var(--border);}
  .rgeral .rg-sub th.s-leads{background:#FAFBFF;} .rgeral .rg-sub th.s-visitas{background:#F8FDFA;} .rgeral .rg-sub th.s-negocios{background:#FEFBF6;}
  .rgeral .rg-name-h{text-align:left !important;background:var(--surface-2);font-size:10px;font-weight:850;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);position:sticky;left:0;z-index:2;}
  .rgeral .rg-name{text-align:left !important;font-weight:700;color:var(--ink);position:sticky;left:0;background:var(--surface);z-index:1;}
  .rgeral tbody tr{border-bottom:1px solid var(--surface-3);}
  .rgeral tbody tr:nth-child(even) td{background:#FCFDFF;}
  .rgeral tbody tr:nth-child(even) .rg-name{background:#FCFDFF;}
  .rgeral tbody tr:hover td{background:#F2F5FB;}
  .rgeral tbody tr:hover .rg-name{background:#F2F5FB;}
  .rgeral .rg-link{color:inherit;text-decoration:none;border-bottom:1px dashed var(--border-strong);}
  .rgeral .rg-link:hover{color:var(--accent-ink);border-bottom-color:var(--accent);}
  .rgeral .rg-num{color:var(--ink);}
  .rgeral .rg-num.rg-bad{color:var(--bad);font-weight:800;}
  .rgeral .rg-num.rg-warn{color:var(--warn);font-weight:750;}
  .rgeral .rg-num.rg-good{color:var(--good);font-weight:850;}
  .rgeral tr.rg-total{border-top:2px solid var(--border-strong);}
  .rgeral tr.rg-total td{font-weight:850;background:var(--surface-2) !important;font-size:13px;}
  .rgeral tr.rg-total .rg-name{background:var(--surface-2) !important;}
  .rgeral .rg-geral{background:linear-gradient(120deg,#4969FF,#7C3AED);color:#fff;border-radius:16px;padding:17px 20px;margin-bottom:20px;box-shadow:0 10px 28px rgba(73,105,255,.25);}
  .rgeral .rg-geral .t{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.85;}
  .rgeral .rg-geral .row{display:flex;gap:26px;margin-top:9px;flex-wrap:wrap;}
  .rgeral .rg-geral .kv .n{font-size:23px;font-weight:850;line-height:1;font-variant-numeric:tabular-nums;}
  .rgeral .rg-geral .kv .l{font-size:11px;opacity:.85;margin-top:3px;}
  .rgeral .rg-loading,.rgeral .rg-empty{color:var(--faint);font-size:13px;padding:40px;text-align:center;}
  .rgeral .rg-pdf{font:inherit;font-size:13px;font-weight:750;color:#fff;background:var(--accent);border:0;border-radius:10px;padding:8px 14px;cursor:pointer;}
  .rgeral .rg-pdf:hover{background:var(--accent-ink);}
  .rgeral .rg-secao{font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:26px 2px 12px;}
  @media print{
    .rg-noprint{display:none !important;}
    .rgeral *,.rconv *{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .rgeral .rg-block,.rconv .rc-block{break-inside:avoid;}
  }
`;

/** Parte visual pura (reutilizada pelo preview público com dados de exemplo). */
export function RaioXView({ times, totalGeral, filtro, periodoLabel }: RGData & { filtro?: ReactNode; periodoLabel?: string }) {
  const multi = times.length > 1;
  return (
    <div className="rgeral">
      <style>{RG_STYLE}</style>
      <div className="rg-head">
        <div>
          <h1>Raio-X do Time</h1>
          <p>O caminho completo do corretor, do lead à venda, numa linha só{periodoLabel ? ` · ${periodoLabel}` : ""}.</p>
        </div>
        {filtro && <div className="rg-filter rg-noprint"><label>Período</label>{filtro}</div>}
      </div>
      {times.length === 0 ? (
        <div className="rg-empty">Sem time no seu escopo.</div>
      ) : (
        <>
          {multi && (
            <div className="rg-geral">
              <div className="t">Total geral</div>
              <div className="row">
                <div className="kv"><div className="n">{totalGeral.leads_recebidos}</div><div className="l">Leads recebidos</div></div>
                <div className="kv"><div className="n">{totalGeral.pipeline_ativo}</div><div className="l">Pipeline ativo</div></div>
                <div className="kv"><div className="n">{totalGeral.estagnados}</div><div className="l">Estagnados</div></div>
                <div className="kv"><div className="n">{totalGeral.visitas_realizadas}</div><div className="l">Visitas feitas</div></div>
                <div className="kv"><div className="n">{totalGeral.vendas}</div><div className="l">Vendas</div></div>
              </div>
            </div>
          )}
          {times.map((t) => <Tabela key={t.gerente_id} time={t} />)}
        </>
      )}
    </div>
  );
}

interface RelatorioGeralProps {
  /** Janela vinda do filtro único da página Relatórios (start inclusivo, end exclusivo). */
  janela?: Janela;
  /** Rótulo do período (ex.: "Semana atual"), exibido no cabeçalho e no PDF. */
  periodoLabel?: string;
}

export default function RelatorioGeral({ janela, periodoLabel }: RelatorioGeralProps = {}) {
  const [equipe, setEquipe] = useState<string>("");
  const janelaEfetiva = useMemo(() => janela ?? calcJanela("mes"), [janela]);
  const label = periodoLabel ?? labelOpcao("mes");
  const { data, isLoading } = useRelatorioGeral(janelaEfetiva);
  const controles = (
    <>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#5B6B7F" }}>{label}</span>
      <button className="rg-pdf" onClick={() => window.print()}>⬇ Baixar PDF</button>
    </>
  );

  if (isLoading) return <div className="rgeral"><style>{RG_STYLE}</style><div className="rg-loading">Montando o relatório geral…</div></div>;

  const times = data?.times ?? [];
  const multi = times.length > 1;
  // CEO/Diretora: uma equipe por vez (troca no seletor), nunca todas juntas.
  const equipeSel = multi ? (times.some((t) => t.gerente_id === equipe) ? equipe : times[0].gerente_id) : "";
  const mostrados = multi ? times.filter((t) => t.gerente_id === equipeSel) : times;

  return (
    <div>
      {multi && (
        <div className="rg-noprint" style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 2px 14px", fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,system-ui,sans-serif', flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#5B6B7F" }}>Equipe</span>
          <select value={equipeSel} onChange={(e) => setEquipe(e.target.value)}
            style={{ font: "inherit", fontSize: 13, fontWeight: 650, color: "#0F1B2D", background: "#fff", border: "1px solid #D2DAE6", borderRadius: 10, padding: "8px 12px", cursor: "pointer" }}>
            {times.map((t) => <option key={t.gerente_id} value={t.gerente_id}>{t.gerente_nome}</option>)}
          </select>
          <span style={{ fontSize: 11.5, color: "#93A0B2" }}>uma equipe por vez, troque aqui</span>
        </div>
      )}
      <RaioXView times={mostrados} totalGeral={data?.totalGeral ?? ({} as RGData["totalGeral"])} filtro={controles} periodoLabel={label} />
      {mostrados.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <ConversaoView times={mostrados} periodoLabel={label} />

        </div>
      )}
    </div>
  );
}
