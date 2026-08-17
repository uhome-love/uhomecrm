import { useState, type ReactNode } from "react";
import { useRelatorioGeral, type RaioXTime, type RelatorioGeral as RGData } from "@/hooks/useRelatorioGeral";

/**
 * RelatorioVisitas — detalhe de VISITAS: marcadas/realizadas/no-show e a taxa de
 * comparecimento por corretor e time. Reaproveita useRelatorioGeral (dado dedup).
 */

function pct(realizadas: number, noShow: number): string {
  const base = realizadas + noShow;
  return base ? Math.round((realizadas / base) * 100) + "%" : "—";
}

const RVI_STYLE = `
  .rvis{--surface:#FFF;--surface-2:#F7F9FC;--surface-3:#EEF2F8;--ink:#0F1B2D;--muted:#5B6B7F;--faint:#93A0B2;--border:#E4E9F1;--border-strong:#D2DAE6;--accent:#4969FF;--good:#0B7A50;--warn:#9E680F;--bad:#C2410C;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,system-ui,sans-serif;}
  .rvis *{box-sizing:border-box}
  .rvis .rv-head{margin-bottom:18px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;}
  .rvis .rv-head h1{font-size:21px;font-weight:850;margin:0;letter-spacing:-.015em;}
  .rvis .rv-head p{font-size:12.5px;color:var(--muted);margin:5px 0 0;}
  .rvis .rv-filter{display:flex;align-items:center;gap:8px;}
  .rvis .rv-filter label{font-size:11.5px;font-weight:700;color:var(--muted);}
  .rvis .rv-filter select{font:inherit;font-size:13px;font-weight:650;color:var(--ink);background:var(--surface);border:1px solid var(--border-strong);border-radius:10px;padding:8px 12px;cursor:pointer;}
  .rvis .rv-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;}
  @media(max-width:640px){.rvis .rv-kpis{grid-template-columns:1fr;}}
  .rvis .rv-kpi{background:var(--surface);border:1px solid var(--border);border-radius:15px;padding:16px 18px;box-shadow:0 1px 2px rgba(16,27,45,.04),0 8px 24px rgba(16,27,45,.05);}
  .rvis .rv-kpi.hero{background:linear-gradient(120deg,#12A970,#0B7A50);color:#fff;border:0;}
  .rvis .rv-kpi .l{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;}
  .rvis .rv-kpi.hero .l{color:rgba(255,255,255,.85);}
  .rvis .rv-kpi .n{font-size:27px;font-weight:850;margin-top:5px;font-variant-numeric:tabular-nums;}
  .rvis .rv-block{margin-bottom:18px;border:1px solid var(--border);border-radius:15px;overflow:hidden;background:var(--surface);box-shadow:0 1px 2px rgba(16,27,45,.04),0 8px 24px rgba(16,27,45,.05);}
  .rvis .rv-th{padding:13px 16px;background:var(--surface-2);border-bottom:1px solid var(--border);display:flex;align-items:baseline;justify-content:space-between;gap:10px;}
  .rvis .rv-tname{font-size:15px;font-weight:850;}
  .rvis .rv-ttot{font-size:12.5px;color:var(--good);font-weight:800;}
  .rvis table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;}
  .rvis th,.rvis td{padding:10px 16px;font-size:12.5px;text-align:right;}
  .rvis th:first-child,.rvis td:first-child{text-align:left;}
  .rvis thead th{font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--border);}
  .rvis tbody tr{border-bottom:1px solid var(--surface-3);} .rvis tbody tr:last-child{border-bottom:0;}
  .rvis td.nm{font-weight:700;} .rvis td.noshow{color:var(--warn);font-weight:750;} .rvis td.comp{font-weight:850;} .rvis td.real{color:var(--good);font-weight:800;}
  .rvis .rv-empty,.rvis .rv-loading{color:var(--faint);font-size:13px;padding:40px;text-align:center;}
`;

export function VisitasView({ times, filtro, periodoLabel }: { times: RaioXTime[]; filtro?: ReactNode; periodoLabel?: string }) {
  const tot = times.reduce((a, t) => ({ c: a.c + t.total.visitas_criadas, r: a.r + t.total.visitas_realizadas, n: a.n + t.total.no_show }), { c: 0, r: 0, n: 0 });
  return (
    <div className="rvis">
      <style>{RVI_STYLE}</style>
      <div className="rv-head">
        <div><h1>Visitas</h1><p>Marcadas, realizadas, no-show e a taxa de comparecimento{periodoLabel ? ` · ${periodoLabel}` : ""}.</p></div>
        {filtro && <div className="rv-filter"><label>Período</label>{filtro}</div>}
      </div>
      <div className="rv-kpis">
        <div className="rv-kpi hero"><div className="l">Comparecimento</div><div className="n">{pct(tot.r, tot.n)}</div></div>
        <div className="rv-kpi"><div className="l">Realizadas</div><div className="n">{tot.r}</div></div>
        <div className="rv-kpi"><div className="l">No-show</div><div className="n">{tot.n}</div></div>
      </div>
      {times.length === 0 ? (
        <div className="rv-empty">Sem time no seu escopo.</div>
      ) : (
        times.map((t) => (
          <div key={t.gerente_id} className="rv-block">
            <div className="rv-th"><span className="rv-tname">{t.gerente_nome}</span><span className="rv-ttot">{pct(t.total.visitas_realizadas, t.total.no_show)} comparecimento</span></div>
            <table>
              <thead><tr><th>Corretor</th><th>Criadas</th><th>Realizadas</th><th>No-show</th><th>Comparecimento</th></tr></thead>
              <tbody>
                {t.corretores.map((c) => (
                  <tr key={c.user_id}>
                    <td className="nm">{c.nome}</td><td>{c.visitas_criadas}</td>
                    <td className="real">{c.visitas_realizadas}</td>
                    <td className="noshow">{c.no_show || ""}</td>
                    <td className="comp">{pct(c.visitas_realizadas, c.no_show)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

type PeriodoOpt = "mes" | "mes_passado" | "ano";
const PERIODO_LABEL: Record<PeriodoOpt, string> = { mes: "Mês atual", mes_passado: "Mês passado", ano: "Este ano" };
function calcPeriodo(opt: PeriodoOpt): { start: string; end: string } {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [y, m] = hoje.split("-").map(Number);
  const iso = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}-01`;
  if (opt === "ano") return { start: `${y}-01-01`, end: `${y + 1}-01-01` };
  if (opt === "mes_passado") { const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y; return { start: iso(py, pm), end: iso(y, m) }; }
  const nm = m === 12 ? 1 : m + 1, ny = m === 12 ? y + 1 : y;
  return { start: iso(y, m), end: iso(ny, nm) };
}

export default function RelatorioVisitas() {
  const [opt, setOpt] = useState<PeriodoOpt>("mes");
  const { data, isLoading } = useRelatorioGeral(calcPeriodo(opt));
  const filtro = (
    <select value={opt} onChange={(e) => setOpt(e.target.value as PeriodoOpt)}>
      <option value="mes">Mês atual</option><option value="mes_passado">Mês passado</option><option value="ano">Este ano</option>
    </select>
  );
  if (isLoading) return <div className="rvis"><style>{RVI_STYLE}</style><div className="rv-loading">Somando as visitas…</div></div>;
  return <VisitasView times={(data as RGData)?.times ?? []} filtro={filtro} periodoLabel={PERIODO_LABEL[opt]} />;
}
