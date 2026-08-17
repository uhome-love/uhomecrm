import { useState, type ReactNode } from "react";
import { useRelatorioGeral, type RaioXTime, type RaioXCorretor } from "@/hooks/useRelatorioGeral";

/**
 * RelatorioConversao — aba CONVERSÃO dos relatórios: o funil (lead → visita →
 * venda) e os 3 pontos de vazamento (topo, no-show, fechamento). Dados reais,
 * escopo por RLS. ConversaoView é a parte visual (reutilizada pelo preview).
 */

type Totais = Omit<RaioXCorretor, "user_id" | "nome">;

function fmtPct(rate: number): string {
  if (!isFinite(rate) || rate <= 0) return "0%";
  const p = rate * 100;
  return p < 10 ? p.toFixed(1).replace(".", ",") + "%" : Math.round(p) + "%";
}

function Funil({ t }: { t: Totais }) {
  const steps = [
    { label: "Leads recebidos", n: t.leads_recebidos || 0, cls: "f0" },
    { label: "Qualificação + Aquecimento", n: t.qualif_aquec || 0, cls: "f1" },
    { label: "Visitas criadas", n: t.visitas_criadas || 0, cls: "f2" },
    { label: "Visitas realizadas", n: t.visitas_realizadas || 0, cls: "f3" },
    { label: "Negócios", n: t.negocios_zona || 0, cls: "f4" },
    { label: "Vendas", n: t.vendas || 0, cls: "f5" },
  ];
  const topo = steps[0].n;
  const vis = t.visitas_realizadas || 0;
  const convLeadVis = topo ? vis / topo : 0;
  const convVisVenda = vis ? (t.vendas || 0) / vis : 0;
  const noShow = (vis + t.no_show) ? t.no_show / (vis + t.no_show) : 0;

  const leaks = [
    { titulo: "Topo do funil", pct: fmtPct(1 - convLeadVis), sub: `Só ${fmtPct(convLeadVis)} dos leads chegaram à visita.`, foco: "Contato rápido e qualificação: muito lead para antes de visitar.", tone: "bad" },
    { titulo: "No-show", pct: fmtPct(noShow), sub: `${t.no_show} de ${vis + t.no_show} visitas marcadas o cliente não veio.`, foco: "Confirmar a visita no dia anterior derruba o no-show.", tone: "warn" },
    { titulo: "Fechamento", pct: fmtPct(1 - convVisVenda), sub: `${fmtPct(convVisVenda)} das visitas viraram venda.`, foco: "Pós-visita e negociação: a visita acontece mas não fecha.", tone: "accent" },
  ];

  return (
    <>
      <div className="rc-funil">
        {steps.map((s, i) => (
          <div key={s.label} className="rc-step">
            <div className="rc-srow">
              <span className="rc-slabel">{s.label}</span>
              <span className="rc-sn">{s.n}</span>
            </div>
            <div className="rc-track"><div className={`rc-bar ${s.cls}`} style={{ width: `${Math.max(3, topo ? (s.n / topo) * 100 : 0)}%` }} /></div>
            {i < steps.length - 1 && (
              <div className="rc-conv">↓ {fmtPct(steps[i + 1].n / (s.n || 1))} <span>passam</span></div>
            )}
          </div>
        ))}
      </div>
      <div className="rc-leaks">
        {leaks.map((l) => (
          <div key={l.titulo} className={`rc-leak t-${l.tone}`}>
            <div className="rc-lt">{l.titulo}</div>
            <div className="rc-lp">{l.pct}</div>
            <div className="rc-lsub">{l.sub}</div>
            <div className="rc-lfoco">✦ {l.foco}</div>
          </div>
        ))}
      </div>
    </>
  );
}

const RC_STYLE = `
  .rconv{
    --surface:#FFFFFF; --surface-2:#F7F9FC; --ink:#0F1B2D; --muted:#5B6B7F; --faint:#93A0B2;
    --border:#E4E9F1; --border-strong:#D2DAE6; --accent:#4969FF; --accent-ink:#2E44C7;
    --good:#0B7A50; --warn:#9E680F; --bad:#C2410C;
    color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,system-ui,sans-serif;
  }
  .rconv *{box-sizing:border-box}
  .rconv .rc-head{margin-bottom:18px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;}
  .rconv .rc-head h1{font-size:21px;font-weight:850;margin:0;letter-spacing:-.015em;}
  .rconv .rc-head p{font-size:12.5px;color:var(--muted);margin:5px 0 0;}
  .rconv .rc-filter{display:flex;align-items:center;gap:8px;}
  .rconv .rc-filter label{font-size:11.5px;font-weight:700;color:var(--muted);}
  .rconv .rc-filter select{font:inherit;font-size:13px;font-weight:650;color:var(--ink);background:var(--surface);border:1px solid var(--border-strong);border-radius:10px;padding:8px 12px;cursor:pointer;}
  .rconv .rc-block{margin-bottom:20px;border:1px solid var(--border);border-radius:16px;background:var(--surface);box-shadow:0 1px 2px rgba(16,27,45,.04),0 10px 28px rgba(16,27,45,.06);overflow:hidden;}
  .rconv .rc-th{padding:14px 18px;background:var(--surface-2);border-bottom:1px solid var(--border);display:flex;align-items:baseline;gap:10px;}
  .rconv .rc-tname{font-size:15px;font-weight:850;}
  .rconv .rc-tsub{font-size:11.5px;color:var(--muted);}
  .rconv .rc-body{padding:18px;}
  .rconv .rc-funil{display:flex;flex-direction:column;gap:4px;margin-bottom:20px;}
  .rconv .rc-step{}
  .rconv .rc-srow{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:5px;}
  .rconv .rc-slabel{font-size:12.5px;font-weight:700;color:var(--ink);}
  .rconv .rc-sn{font-size:16px;font-weight:850;font-variant-numeric:tabular-nums;}
  .rconv .rc-track{height:16px;border-radius:8px;background:var(--surface-2);overflow:hidden;}
  .rconv .rc-bar{height:100%;border-radius:8px;min-width:14px;transition:width .3s ease;}
  .rconv .rc-bar.f0{background:linear-gradient(90deg,#3A54E8,#5B72FF);}
  .rconv .rc-bar.f1{background:linear-gradient(90deg,#5B72FF,#7B93F5);}
  .rconv .rc-bar.f2{background:linear-gradient(90deg,#12A0A9,#3BC0C3);}
  .rconv .rc-bar.f3{background:linear-gradient(90deg,#12A970,#3BC38C);}
  .rconv .rc-bar.f4{background:linear-gradient(90deg,#E0982A,#EDB24F);}
  .rconv .rc-bar.f5{background:linear-gradient(90deg,#E0533A,#EE7A62);}
  .rconv .rc-conv{font-size:11px;font-weight:750;color:var(--muted);margin:5px 0 9px 2px;}
  .rconv .rc-conv span{font-weight:600;color:var(--faint);}
  .rconv .rc-leaks{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
  .rconv .rc-leak{border:1px solid var(--border);border-radius:13px;padding:14px 15px;background:var(--surface-2);border-top:3px solid var(--border-strong);}
  .rconv .rc-leak.t-bad{border-top-color:var(--bad);} .rconv .rc-leak.t-warn{border-top-color:var(--warn);} .rconv .rc-leak.t-accent{border-top-color:var(--accent);}
  .rconv .rc-lt{font-size:10.5px;font-weight:850;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);}
  .rconv .rc-lp{font-size:30px;font-weight:850;line-height:1.1;margin:4px 0 2px;font-variant-numeric:tabular-nums;}
  .rconv .rc-leak.t-bad .rc-lp{color:var(--bad);} .rconv .rc-leak.t-warn .rc-lp{color:var(--warn);} .rconv .rc-leak.t-accent .rc-lp{color:var(--accent-ink);}
  .rconv .rc-lsub{font-size:11.5px;color:var(--muted);line-height:1.45;}
  .rconv .rc-lfoco{font-size:11.5px;color:var(--accent-ink);font-weight:600;line-height:1.4;margin-top:8px;border-top:1px solid var(--border);padding-top:8px;}
  @media(max-width:680px){.rconv .rc-leaks{grid-template-columns:1fr;}}
  .rconv .rc-empty,.rconv .rc-loading{color:var(--faint);font-size:13px;padding:40px;text-align:center;}
`;

function somaTotais(times: RaioXTime[]): Totais {
  const z = { leads_recebidos: 0, pipeline_ativo: 0, descartes: 0, estagnados: 0, qualif_aquec: 0, negocios_zona: 0, visitas_criadas: 0, visitas_realizadas: 0, no_show: 0, negocios_criados: 0, negocios_ativos: 0, vendas: 0 };
  for (const t of times) for (const k of Object.keys(z) as (keyof Totais)[]) z[k] += t.total[k];
  return z;
}

export function ConversaoView({ times, filtro, periodoLabel }: { times: RaioXTime[]; filtro?: ReactNode; periodoLabel?: string }) {
  const multi = times.length > 1;
  return (
    <div className="rconv">
      <style>{RC_STYLE}</style>
      <div className="rc-head">
        <div>
          <h1>Conversão do funil</h1>
          <p>Onde o funil vaza, do lead à venda{periodoLabel ? ` · ${periodoLabel}` : ""}.</p>
        </div>
        {filtro && <div className="rc-filter"><label>Período</label>{filtro}</div>}
      </div>
      {times.length === 0 ? (
        <div className="rc-empty">Sem time no seu escopo.</div>
      ) : (
        <>
          {multi && (
            <div className="rc-block">
              <div className="rc-th"><span className="rc-tname">Total geral</span><span className="rc-tsub">todos os times</span></div>
              <div className="rc-body"><Funil t={somaTotais(times)} /></div>
            </div>
          )}
          {times.map((t) => (
            <div key={t.gerente_id} className="rc-block">
              <div className="rc-th"><span className="rc-tname">{t.gerente_nome}</span><span className="rc-tsub">Equipe · {t.corretores.length} corretores</span></div>
              <div className="rc-body"><Funil t={t.total} /></div>
            </div>
          ))}
        </>
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

export default function RelatorioConversao() {
  const [opt, setOpt] = useState<PeriodoOpt>("mes");
  const { data, isLoading } = useRelatorioGeral(calcPeriodo(opt));
  const filtro = (
    <select value={opt} onChange={(e) => setOpt(e.target.value as PeriodoOpt)}>
      <option value="mes">Mês atual</option>
      <option value="mes_passado">Mês passado</option>
      <option value="ano">Este ano</option>
    </select>
  );
  if (isLoading) return <div className="rconv"><style>{RC_STYLE}</style><div className="rc-loading">Montando o funil de conversão…</div></div>;
  return <ConversaoView times={data?.times ?? []} filtro={filtro} periodoLabel={PERIODO_LABEL[opt]} />;
}
