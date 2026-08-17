import { useState, type ReactNode } from "react";
import { useVendas, type VendaTime, type RelVendas } from "@/hooks/useVendas";

/**
 * RelatorioVendas — detalhe de VENDAS: VGV assinado (rateado, sem dobrar parceria),
 * ticket médio, por corretor e por time. Fonte v_fato_venda, escopo por RLS.
 */

function moeda(v: number): string {
  if (!v) return "R$ 0";
  if (v >= 1_000_000) return "R$ " + (v / 1_000_000).toFixed(2).replace(".", ",") + "mi";
  if (v >= 1_000) return "R$ " + (v / 1000).toFixed(0) + " mil";
  return "R$ " + Math.round(v);
}

const RV_STYLE = `
  .rvend{--surface:#FFF;--surface-2:#F7F9FC;--surface-3:#EEF2F8;--ink:#0F1B2D;--muted:#5B6B7F;--faint:#93A0B2;--border:#E4E9F1;--border-strong:#D2DAE6;--accent:#4969FF;--accent-ink:#2E44C7;--good:#0B7A50;--warn:#9E680F;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,system-ui,sans-serif;}
  .rvend *{box-sizing:border-box}
  .rvend .rv-head{margin-bottom:18px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;}
  .rvend .rv-head h1{font-size:21px;font-weight:850;margin:0;letter-spacing:-.015em;}
  .rvend .rv-head p{font-size:12.5px;color:var(--muted);margin:5px 0 0;}
  .rvend .rv-filter{display:flex;align-items:center;gap:8px;}
  .rvend .rv-filter label{font-size:11.5px;font-weight:700;color:var(--muted);}
  .rvend .rv-filter select{font:inherit;font-size:13px;font-weight:650;color:var(--ink);background:var(--surface);border:1px solid var(--border-strong);border-radius:10px;padding:8px 12px;cursor:pointer;}
  .rvend .rv-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;}
  @media(max-width:640px){.rvend .rv-kpis{grid-template-columns:1fr;}}
  .rvend .rv-kpi{background:var(--surface);border:1px solid var(--border);border-radius:15px;padding:16px 18px;box-shadow:0 1px 2px rgba(16,27,45,.04),0 8px 24px rgba(16,27,45,.05);}
  .rvend .rv-kpi.hero{background:linear-gradient(120deg,#4969FF,#7C3AED);color:#fff;border:0;}
  .rvend .rv-kpi .l{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;}
  .rvend .rv-kpi.hero .l{color:rgba(255,255,255,.85);}
  .rvend .rv-kpi .n{font-size:27px;font-weight:850;margin-top:5px;font-variant-numeric:tabular-nums;}
  .rvend .rv-block{margin-bottom:18px;border:1px solid var(--border);border-radius:15px;overflow:hidden;background:var(--surface);box-shadow:0 1px 2px rgba(16,27,45,.04),0 8px 24px rgba(16,27,45,.05);}
  .rvend .rv-th{padding:13px 16px;background:var(--surface-2);border-bottom:1px solid var(--border);display:flex;align-items:baseline;justify-content:space-between;gap:10px;}
  .rvend .rv-tname{font-size:15px;font-weight:850;}
  .rvend .rv-ttot{font-size:12.5px;color:var(--good);font-weight:800;}
  .rvend table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;}
  .rvend th,.rvend td{padding:10px 16px;font-size:12.5px;text-align:right;}
  .rvend th:first-child,.rvend td:first-child{text-align:left;}
  .rvend thead th{font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--border);}
  .rvend tbody tr{border-bottom:1px solid var(--surface-3);}
  .rvend tbody tr:last-child{border-bottom:0;}
  .rvend td.nm{font-weight:700;}
  .rvend td.vgv{font-weight:800;color:var(--good);}
  .rvend .rv-empty,.rvend .rv-loading{color:var(--faint);font-size:13px;padding:40px;text-align:center;}
`;

export function VendasView({ data, filtro, periodoLabel }: { data: RelVendas; filtro?: ReactNode; periodoLabel?: string }) {
  return (
    <div className="rvend">
      <style>{RV_STYLE}</style>
      <div className="rv-head">
        <div><h1>Vendas</h1><p>VGV assinado (rateado, sem dobrar parceria){periodoLabel ? ` · ${periodoLabel}` : ""}.</p></div>
        {filtro && <div className="rv-filter"><label>Período</label>{filtro}</div>}
      </div>
      <div className="rv-kpis">
        <div className="rv-kpi hero"><div className="l">VGV assinado</div><div className="n">{moeda(data.total.vgv)}</div></div>
        <div className="rv-kpi"><div className="l">Vendas</div><div className="n">{data.total.vendas}</div></div>
        <div className="rv-kpi"><div className="l">Ticket médio</div><div className="n">{moeda(data.ticketMedio)}</div></div>
      </div>
      {data.times.length === 0 ? (
        <div className="rv-empty">Sem vendas no período.</div>
      ) : (
        data.times.map((t: VendaTime) => (
          <div key={t.equipe} className="rv-block">
            <div className="rv-th"><span className="rv-tname">{t.equipe}</span><span className="rv-ttot">{moeda(t.total.vgv)} · {t.total.vendas} vendas</span></div>
            <table>
              <thead><tr><th>Corretor</th><th>Vendas</th><th>VGV rateado</th></tr></thead>
              <tbody>
                {t.corretores.map((c) => (
                  <tr key={c.user_id}><td className="nm">{c.nome}</td><td>{c.vendas}</td><td className="vgv">{moeda(c.vgv)}</td></tr>
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

export default function RelatorioVendas() {
  const [opt, setOpt] = useState<PeriodoOpt>("mes");
  const { data, isLoading } = useVendas(calcPeriodo(opt));
  const filtro = (
    <select value={opt} onChange={(e) => setOpt(e.target.value as PeriodoOpt)}>
      <option value="mes">Mês atual</option><option value="mes_passado">Mês passado</option><option value="ano">Este ano</option>
    </select>
  );
  if (isLoading) return <div className="rvend"><style>{RV_STYLE}</style><div className="rv-loading">Somando as vendas…</div></div>;
  return <VendasView data={data ?? { times: [], total: { vendas: 0, vgv: 0 }, ticketMedio: 0 }} filtro={filtro} periodoLabel={PERIODO_LABEL[opt]} />;
}
