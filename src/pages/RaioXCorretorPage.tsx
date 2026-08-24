import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { fmtMoney } from "@/lib/fmtMoney";
import {
  PERIODO_OPCOES, calcJanela, hojeBRT, labelJanela, labelOpcao,
  type PeriodoOpt,
} from "@/lib/periodoFiltro";
import {
  useCorretoresDoEscopo, useRaioXCorretor,
  type LinhaEmpreendimento, type MesEvolucao, type RaioXCorretorFull,
} from "@/hooks/useRaioXCorretor";

/**
 * Raio-X do Corretor — uma tela SÓ do corretor: leads (com custo), visitas,
 * negócios, presença/roleta e uso do CRM, no período escolhido, comparados com
 * o período anterior equivalente, mais a evolução de 12 meses.
 *
 * A página já nasce formatada em A4. O botão "Baixar PDF" abre /raio-x-corretor/imprimir
 * numa aba limpa (fora do menu lateral e das abas do CRM) e dispara a impressão
 * do navegador, então o PDF sai só com o relatório.
 *
 * RaioXCorretorView é a parte visual pura, reutilizada pelo preview público.
 */

// ── formatação ───────────────────────────────────────────────────────────────

const n0 = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v || 0));
const p1 = (v: number) => `${String(v ?? 0).replace(".", ",")}%`;
const d1 = (v: number) => String(v ?? 0).replace(".", ",");

function delta(atual: number, anterior: number): { txt: string; dir: "up" | "down" | "flat" } {
  if (!anterior && !atual) return { txt: "sem base", dir: "flat" };
  if (!anterior) return { txt: "novo", dir: "up" };
  const d = ((atual - anterior) / anterior) * 100;
  const r = Math.round(d);
  if (r === 0) return { txt: "igual", dir: "flat" };
  return { txt: `${r > 0 ? "+" : ""}${r}%`, dir: r > 0 ? "up" : "down" };
}

// ── peças visuais ────────────────────────────────────────────────────────────

interface CardProps {
  label: string;
  valor: string;
  hint?: string;
  atual?: number;
  anterior?: number;
  /** true quando cair é bom (descartes, no-show, estagnados, atrasados). */
  inverso?: boolean;
  tom?: "neutro" | "bom" | "alerta" | "ruim";
}

function Card({ label, valor, hint, atual, anterior, inverso, tom = "neutro" }: CardProps) {
  const cmp = atual !== undefined && anterior !== undefined ? delta(atual, anterior) : null;
  const bom = cmp ? (inverso ? cmp.dir === "down" : cmp.dir === "up") : false;
  const ruim = cmp ? (inverso ? cmp.dir === "up" : cmp.dir === "down") : false;
  return (
    <div className={`rx-card t-${tom}`}>
      <div className="rx-card-l">{label}</div>
      <div className="rx-card-v">{valor}</div>
      <div className="rx-card-f">
        {hint && <span className="rx-hint">{hint}</span>}
        {cmp && (
          <span className={`rx-delta ${bom ? "d-up" : ruim ? "d-down" : "d-flat"}`}>
            {cmp.dir === "up" ? "▲" : cmp.dir === "down" ? "▼" : "•"} {cmp.txt}
          </span>
        )}
      </div>
    </div>
  );
}

function Bloco({ titulo, sub, children }: { titulo: string; sub?: string; children: ReactNode }) {
  return (
    <section className="rx-bloco">
      <header className="rx-bloco-h">
        <h2>{titulo}</h2>
        {sub && <p>{sub}</p>}
      </header>
      {children}
    </section>
  );
}

/**
 * Grade de cards com número de colunas escolhido pela QUANTIDADE de cards, para
 * a linha fechar certinho numa tela de 13 polegadas em vez de sobrar um card
 * órfão embaixo. Até 6 cards vão numa linha só; 7 ou 8 viram duas linhas iguais.
 * Em tela média cai para 4 colunas e no celular para 2.
 */
function Grade({ children }: { children: ReactNode[] }) {
  const n = children.filter(Boolean).length;
  const cols = n <= 6 ? n : Math.ceil(n / 2);
  const colsMedio = Math.min(cols, 4);
  return (
    <div
      className="rx-grid"
      style={{ ["--c" as string]: cols, ["--cm" as string]: colsMedio }}
    >
      {children}
    </div>
  );
}

/**
 * Evolução do ano, mês a mês, em PEQUENOS MÚLTIPLOS: uma faixa por métrica,
 * cada uma com a própria escala e o número escrito em cima da barra.
 *
 * A versão anterior empilhava leads (dezenas) e vendas (unidades) no mesmo eixo
 * e a barra menor sumia. Separando em faixas, cada linha é legível sozinha e a
 * leitura vertical mostra o mês inteiro: quantos leads entraram, quantas visitas
 * saíram disso, quantas vendas fecharam e quanto isso deu de VGV.
 */
const SERIES: {
  chave: keyof Pick<MesEvolucao, "leads" | "visitas_realizadas" | "vendas" | "vgv">;
  titulo: string;
  cor: string;
  dinheiro?: boolean;
}[] = [
  { chave: "leads", titulo: "Leads recebidos", cor: "#4969FF" },
  { chave: "visitas_realizadas", titulo: "Visitas realizadas", cor: "#0B7A50" },
  { chave: "vendas", titulo: "Vendas", cor: "#9E680F" },
  { chave: "vgv", titulo: "VGV", cor: "#7C3AED", dinheiro: true },
];

function Evolucao({ dados }: { dados: MesEvolucao[] }) {
  if (dados.length === 0) return <p className="rx-vazio">Sem histórico no ano.</p>;
  const ultimo = dados[dados.length - 1]?.mes;
  const cols = `132px repeat(${dados.length}, minmax(0, 1fr))`;

  return (
    <div className="rx-evo">
      {SERIES.map((s) => {
        const max = Math.max(1, ...dados.map((d) => Number(d[s.chave]) || 0));
        const total = dados.reduce((a, d) => a + (Number(d[s.chave]) || 0), 0);
        return (
          <div className="rx-serie" key={s.chave} style={{ gridTemplateColumns: cols }}>
            <div className="rx-serie-h">
              <span className="rx-serie-t"><i style={{ background: s.cor }} />{s.titulo}</span>
              <span className="rx-serie-s">
                {s.dinheiro ? fmtMoney(total, "short") : n0(total)} no ano
              </span>
            </div>
            {dados.map((d) => {
              const v = Number(d[s.chave]) || 0;
              const h = v > 0 ? Math.max(4, Math.round((v / max) * 44)) : 0;
              return (
                <div className={`rx-col ${d.mes === ultimo ? "rx-col-atual" : ""}`} key={d.mes}>
                  <span className="rx-col-v">{v === 0 ? "" : s.dinheiro ? fmtMoney(v, "short") : n0(v)}</span>
                  <span className="rx-col-b" style={{ height: h, background: s.cor }} />
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="rx-serie rx-serie-eixo" style={{ gridTemplateColumns: cols }}>
        <div />
        {dados.map((d) => (
          <div className={`rx-mes ${d.mes === ultimo ? "rx-mes-atual" : ""}`} key={d.mes}>{d.label}</div>
        ))}
      </div>
    </div>
  );
}

function TabelaEmpreendimentos({ linhas }: { linhas: LinhaEmpreendimento[] }) {
  if (linhas.length === 0) return <p className="rx-vazio">Nenhuma visita ou venda com empreendimento no período.</p>;
  // Só coroa "melhor conversão" entre empreendimentos CANÔNICOS e com volume
  // mínimo: 100% em duas visitas é ruído, e o balde "Não identificado" não é
  // um empreendimento.
  const melhor = [...linhas]
    .filter((l) => l.resolvido && l.realizadas + l.no_show >= 3)
    .sort((a, b) => b.comparecimento - a.comparecimento || b.realizadas - a.realizadas)[0];
  const naoIdent = linhas.find((l) => !l.resolvido);
  return (
    <>
      {melhor && (
        <p className="rx-destaque">
          Melhor conversão de visita: <b>{melhor.nome}</b> com {p1(melhor.comparecimento)} de comparecimento
          ({melhor.realizadas} de {melhor.realizadas + melhor.no_show} visitas marcadas).
        </p>
      )}
      <div className="rx-scroll">
        <table className="rx-table">
          <thead>
            <tr>
              <th className="l">Empreendimento</th>
              <th>Visitas</th><th>Realizadas</th><th>No-show</th>
              <th>Comparecimento</th><th>Vendas</th><th>VGV</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.nome}
                  className={[melhor && l.nome === melhor.nome ? "rx-tr-top" : "", l.resolvido ? "" : "rx-tr-fraca"].join(" ").trim()}>
                <td className="l">{l.nome}</td>
                <td>{l.visitas}</td>
                <td>{l.realizadas}</td>
                <td className={l.no_show > 0 ? "rx-warn" : ""}>{l.no_show}</td>
                <td>{l.realizadas + l.no_show > 0 ? p1(l.comparecimento) : "—"}</td>
                <td className={l.vendas > 0 ? "rx-good" : ""}>{l.vendas}</td>
                <td>{l.vgv > 0 ? fmtMoney(l.vgv, "short") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rx-nota">
        Cada linha é um empreendimento canônico do CRM. Nome de campanha não vira linha aqui: ele é traduzido
        para o empreendimento certo pela tabela de apelidos.
        {naoIdent
          ? ` "Não identificado" reúne ${naoIdent.visitas} visita(s) e ${naoIdent.vendas} venda(s) cujo texto não bate com nenhum empreendimento nem apelido cadastrado. Cadastrar o apelido resolve.`
          : ""}
      </p>
    </>
  );
}

// ── estilo ───────────────────────────────────────────────────────────────────

const RX_STYLE = `
.rxc{
  --surface:#FFFFFF; --surface-2:#F7F9FC; --surface-3:#EEF2F8;
  --ink:#0F1B2D; --muted:#5B6B7F; --faint:#93A0B2;
  --border:#E4E9F1; --border-strong:#D2DAE6; --accent:#4969FF; --accent-ink:#2E44C7;
  --good:#0B7A50; --warn:#9E680F; --bad:#C2410C;
  color:var(--ink);background:#fff;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,system-ui,sans-serif;
  max-width:1060px;margin:0 auto;
}
.rxc *{box-sizing:border-box}
.rxc .rx-bar{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px;margin-bottom:16px;}
.rxc .rx-bar .f{display:flex;flex-direction:column;gap:4px;}
.rxc .rx-bar label{font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);}
.rxc .rx-bar select,.rxc .rx-bar input{font:inherit;font-size:13px;font-weight:600;color:var(--ink);background:#fff;
  border:1px solid var(--border-strong);border-radius:10px;padding:8px 11px;cursor:pointer;}
.rxc .rx-print{margin-left:auto;font:inherit;font-size:13px;font-weight:750;color:#fff;background:var(--accent);
  border:0;border-radius:10px;padding:10px 18px;cursor:pointer;box-shadow:0 6px 18px rgba(73,105,255,.28);}
.rxc .rx-print:hover{background:var(--accent-ink);}

.rxc .rx-topo{display:flex;align-items:center;gap:18px;padding:20px 22px;border:1px solid var(--border);
  border-radius:18px;background:linear-gradient(120deg,#F7F9FF,#FFFFFF);margin-bottom:16px;}
.rxc .rx-av{width:74px;height:74px;border-radius:50%;object-fit:cover;border:3px solid #fff;
  box-shadow:0 4px 14px rgba(16,27,45,.18);background:#DCE3FF;flex:0 0 auto;}
.rxc .rx-av-fb{display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:850;color:var(--accent-ink);}
.rxc .rx-topo h1{margin:0;font-size:24px;font-weight:850;letter-spacing:-.02em;}
.rxc .rx-topo .sub{margin:5px 0 0;font-size:12.5px;color:var(--muted);}
.rxc .rx-topo .per{margin-left:auto;text-align:right;}
.rxc .rx-topo .per .k{font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);}
.rxc .rx-topo .per .v{font-size:15px;font-weight:800;margin-top:3px;}
.rxc .rx-topo .per .d{font-size:11.5px;color:var(--faint);margin-top:2px;}

.rxc .rx-faixa{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--border);
  border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-bottom:20px;}
.rxc .rx-faixa .fx{background:linear-gradient(140deg,#4969FF,#6D5CF0);color:#fff;padding:16px 14px;}
.rxc .rx-faixa .fx .l{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;opacity:.86;}
.rxc .rx-faixa .fx .v{font-size:23px;font-weight:850;line-height:1.1;margin-top:6px;
  font-variant-numeric:tabular-nums;white-space:nowrap;}
.rxc .rx-faixa .fx .d{font-size:11px;opacity:.9;margin-top:4px;}

.rxc .rx-bloco{border:1px solid var(--border);border-radius:16px;background:#fff;margin-bottom:16px;overflow:hidden;
  box-shadow:0 1px 2px rgba(16,27,45,.04),0 8px 24px rgba(16,27,45,.05);}
.rxc .rx-bloco-h{padding:14px 18px;background:var(--surface-2);border-bottom:1px solid var(--border);}
.rxc .rx-bloco-h h2{margin:0;font-size:14px;font-weight:850;letter-spacing:.01em;}
.rxc .rx-bloco-h p{margin:4px 0 0;font-size:11.5px;color:var(--muted);}

.rxc .rx-grid{display:grid;grid-template-columns:repeat(var(--c,4),minmax(0,1fr));background:#fff;}
.rxc .rx-card{background:#fff;padding:13px 14px;border-right:1px solid var(--border);border-top:1px solid var(--border);
  min-width:0;overflow:hidden;}
.rxc .rx-grid .rx-card:first-child{border-top:0;}
.rxc .rx-card-l{font-size:10.5px;font-weight:750;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);}
.rxc .rx-card-v{font-size:23px;font-weight:850;margin-top:6px;line-height:1.1;font-variant-numeric:tabular-nums;white-space:nowrap;}
.rxc .rx-card-f{display:flex;align-items:center;gap:8px;margin-top:5px;flex-wrap:wrap;}
.rxc .rx-hint{font-size:11px;color:var(--faint);}
.rxc .rx-delta{font-size:11px;font-weight:800;}
.rxc .rx-delta.d-up{color:var(--good);} .rxc .rx-delta.d-down{color:var(--bad);} .rxc .rx-delta.d-flat{color:var(--faint);}
.rxc .rx-card.t-bom .rx-card-v{color:var(--good);}
.rxc .rx-card.t-alerta .rx-card-v{color:var(--warn);}
.rxc .rx-card.t-ruim .rx-card-v{color:var(--bad);}

.rxc .rx-scroll{overflow-x:auto;}
.rxc table.rx-table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;}
.rxc .rx-table th,.rxc .rx-table td{padding:9px 12px;text-align:center;font-size:12.5px;white-space:nowrap;
  border-bottom:1px solid var(--surface-3);}
.rxc .rx-table th{font-size:10px;font-weight:850;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);
  background:var(--surface-2);border-bottom:1px solid var(--border);}
.rxc .rx-table th.l,.rxc .rx-table td.l{text-align:left;}
.rxc .rx-table td.l{font-weight:700;}
.rxc .rx-table tr.rx-tr-top td{background:#F4F8FF;}
.rxc .rx-table tr.rx-tr-fraca td{color:var(--faint);font-style:italic;}
.rxc .rx-table tr.rx-tr-fraca td.l{font-weight:600;}
.rxc .rx-good{color:var(--good);font-weight:800;}
.rxc .rx-warn{color:var(--warn);font-weight:750;}
.rxc .rx-destaque{margin:0;padding:12px 18px;font-size:12.5px;color:var(--ink);background:#F4F8FF;
  border-bottom:1px solid var(--border);}
.rxc .rx-vazio{margin:0;padding:22px 18px;font-size:12.5px;color:var(--faint);text-align:center;}
.rxc .rx-nota{padding:11px 18px;font-size:11.5px;color:var(--muted);background:var(--surface-2);
  border-top:1px solid var(--border);}

.rxc .rx-evo{padding:6px 18px 14px;}
.rxc .rx-serie{display:grid;align-items:end;column-gap:3px;padding:10px 0;border-bottom:1px solid var(--surface-3);}
.rxc .rx-serie-h{align-self:center;padding-right:12px;}
.rxc .rx-serie-t{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;color:var(--ink);}
.rxc .rx-serie-t i{width:9px;height:9px;border-radius:2px;flex:0 0 auto;}
.rxc .rx-serie-s{display:block;font-size:10.5px;color:var(--faint);margin-top:2px;padding-left:16px;}
.rxc .rx-col{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;min-width:0;}
.rxc .rx-col-v{font-size:10px;font-weight:750;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap;}
.rxc .rx-col-b{display:block;width:100%;max-width:26px;border-radius:3px 3px 0 0;opacity:.88;}
.rxc .rx-col-atual .rx-col-v{color:var(--ink);}
.rxc .rx-col-atual .rx-col-b{opacity:1;}
.rxc .rx-serie-eixo{border-bottom:0;padding-top:7px;padding-bottom:0;}
.rxc .rx-mes{text-align:center;font-size:10.5px;color:var(--muted);text-transform:capitalize;}
.rxc .rx-mes-atual{font-weight:850;color:var(--ink);}

.rxc .rx-rodape{margin:22px 0 8px;padding-top:12px;border-top:1px solid var(--border);
  font-size:10.5px;color:var(--faint);line-height:1.6;}
.rxc .rx-load{padding:60px;text-align:center;color:var(--faint);font-size:13px;}

/* Tela média (notebook com menu aberto, tablet): no máximo 4 por linha. */
@media (max-width:1120px){
  .rxc .rx-grid{grid-template-columns:repeat(var(--cm,4),minmax(0,1fr));}
  .rxc .rx-card-v{font-size:21px;}
}
@media (max-width:860px){
  .rxc .rx-grid{grid-template-columns:repeat(3,minmax(0,1fr));}
  /* 5 destaques em 3 colunas: o último ocupa as duas sobrando, sem buraco cinza. */
  .rxc .rx-faixa{grid-template-columns:repeat(3,1fr);}
  .rxc .rx-faixa .fx:last-child{grid-column:span 2;}
}
@media (max-width:620px){
  .rxc .rx-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
  .rxc .rx-faixa{grid-template-columns:repeat(2,1fr);}
  .rxc .rx-faixa .fx:last-child{grid-column:span 2;}
  .rxc .rx-topo{flex-wrap:wrap;gap:12px;}
  .rxc .rx-topo h1{font-size:20px;}
  .rxc .rx-topo .per{margin-left:0;text-align:left;width:100%;}
  .rxc .rx-card-v{font-size:19px;}
  .rxc .rx-faixa .fx .v{font-size:20px;}
  .rxc .rx-bar{gap:8px;}
  .rxc .rx-print{margin-left:0;width:100%;}
}

@media print{
  @page{size:A4 portrait;margin:11mm;}
  .rx-noprint{display:none !important;}
  .rxc{max-width:none;box-shadow:none;}
  .rxc .rx-bloco{break-inside:avoid;page-break-inside:avoid;box-shadow:none;}
  .rxc .rx-topo,.rxc .rx-faixa{break-inside:avoid;page-break-inside:avoid;}
  .rxc .rx-faixa .fx{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .rxc .rx-scroll{overflow:visible;}
  /* A4 retrato é estreito: no máximo 4 cards por linha. */
  .rxc .rx-grid{grid-template-columns:repeat(var(--cm,4),minmax(0,1fr));}
  .rxc .rx-card-v{font-size:19px;}
  .rxc .rx-card{padding:11px 12px;}
}
`;

// ── view pura ────────────────────────────────────────────────────────────────

export function RaioXCorretorView({
  data, filtros, periodoLabel,
}: { data: RaioXCorretorFull; filtros?: ReactNode; periodoLabel?: string }) {
  const { corretor, leads, visitas, negocios, presenca, crm, anterior, janela, janelaAnterior } = data;
  const iniciais = corretor.nome.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  // Sem investimento sincronizado no período, "R$ 0" mentiria (leria como "não custou nada").
  const temCusto = leads.cpl_medio > 0;
  const cplEstimado = leads.cpl_fonte === "referencia";
  const cplNota = cplEstimado ? `CPL médio de ${leads.cpl_referencia_label}` : `CPL médio ${fmtMoney(leads.cpl_medio, "exact")}`;

  return (
    <div className="rxc">
      <style>{RX_STYLE}</style>

      {filtros && <div className="rx-bar rx-noprint">{filtros}</div>}

      <div className="rx-topo">
        {corretor.avatar_url
          ? <img className="rx-av" src={corretor.avatar_url} alt={corretor.nome} />
          : <div className="rx-av rx-av-fb">{iniciais || "?"}</div>}
        <div>
          <h1>{corretor.nome}</h1>
          <p className="sub">
            {[corretor.cargo ? corretor.cargo[0].toUpperCase() + corretor.cargo.slice(1) : null,
              corretor.gerente_nome ? `Equipe ${corretor.gerente_nome}` : null]
              .filter(Boolean).join(" · ") || "Corretor"}
          </p>
        </div>
        <div className="per">
          <div className="k">Período</div>
          <div className="v">{periodoLabel ?? "Período"}</div>
          <div className="d">{labelJanela(janela)}</div>
        </div>
      </div>

      <div className="rx-faixa">
        <div className="fx"><div className="l">Leads recebidos</div><div className="v">{n0(leads.recebidos)}</div>
          <div className="d">{delta(leads.recebidos, anterior.leads.recebidos).txt} vs anterior</div></div>
        <div className="fx"><div className="l">Custo em leads</div>
          <div className="v">{temCusto ? fmtMoney(leads.custo_total, "exact") : "sem dado"}</div>
          <div className="d">{temCusto ? cplNota : "investimento não sincronizado"}</div></div>
        <div className="fx"><div className="l">Visitas realizadas</div><div className="v">{n0(visitas.realizadas)}</div>
          <div className="d">{delta(visitas.realizadas, anterior.visitas.realizadas).txt} vs anterior</div></div>
        <div className="fx"><div className="l">Vendas</div><div className="v">{n0(negocios.vendas)}</div>
          <div className="d">{delta(negocios.vendas, anterior.negocios.vendas).txt} vs anterior</div></div>
        <div className="fx"><div className="l">VGV</div><div className="v">{fmtMoney(negocios.vgv, "short")}</div>
          <div className="d">ticket {negocios.vendas > 0 ? fmtMoney(negocios.ticket_medio, "short") : "—"}</div></div>
      </div>

      <Bloco titulo="Leads" sub={`Recebidos no período e o que ele fez com eles · comparação com ${labelJanela(janelaAnterior)}`}>
        <Grade>
          <Card label="Recebidos" valor={n0(leads.recebidos)} atual={leads.recebidos} anterior={anterior.leads.recebidos} />
          <Card label={cplEstimado ? "Custo em leads (estimado)" : "Custo em leads"}
                valor={temCusto ? fmtMoney(leads.custo_total, "exact") : "sem dado"}
                hint={temCusto
                  ? `CPL ${fmtMoney(leads.cpl_medio, "exact")}${cplEstimado ? ` · base ${leads.cpl_referencia_label}` : ""}`
                  : "sem investimento sincronizado"}
                atual={temCusto ? Math.round(leads.custo_total) : undefined}
                anterior={temCusto ? Math.round(anterior.leads.custo_total) : undefined} inverso />
          <Card label="Ativos no pipeline" valor={n0(leads.ativos)} hint="agora, em prospecção" />
          <Card label="Descartados" valor={n0(leads.descartados)} tom={leads.descartados > 0 ? "alerta" : "neutro"}
                hint={leads.recebidos > 0 ? `${p1(Math.round((leads.descartados / leads.recebidos) * 1000) / 10)} dos recebidos` : undefined}
                atual={leads.descartados} anterior={anterior.leads.descartados} inverso />
          <Card label="Descartados do período" valor={n0(leads.descartados_do_periodo)}
                hint="chegou e caiu dentro do período" tom={leads.descartados_do_periodo > 0 ? "alerta" : "neutro"}
                atual={leads.descartados_do_periodo} anterior={anterior.leads.descartados_do_periodo} inverso />
          <Card label="Descartados antigos" valor={n0(leads.descartados_antigos)}
                hint="lead de antes, limpeza de carteira"
                atual={leads.descartados_antigos} anterior={anterior.leads.descartados_antigos} />
          <Card label="Estagnados" valor={n0(leads.estagnados)} tom={leads.estagnados > 0 ? "ruim" : "bom"}
                hint={`${p1(crm.pct_estagnados)} do pipeline`} />
        </Grade>
        <p className="rx-nota">
          {!temCusto
            ? "Custo em leads aparece vazio porque não há nenhum investimento do Meta sincronizado no CRM. Assim que o sync voltar, o número preenche sozinho."
            : cplEstimado
              ? `Custo em leads ESTIMADO: não há investimento sincronizado dentro deste período, então usamos o CPL médio das campanhas de ${leads.cpl_referencia_label} (o último mês com dado) × leads que ele recebeu. Serve para ordem de grandeza, não para fechar caixa.`
              : "Custo em leads = CPL médio do período (investimento do Meta ÷ leads gerados) × leads que ele recebeu. É rateio médio, não o gasto exato de cada lead."}
          {" "}Ativos e estagnados são a foto de hoje, não do período.
        </p>
      </Bloco>

      <Bloco titulo="Visitas" sub="Cada visita conta. Canceladas ficam fora. Total = a realizar + realizadas + no-show.">
        <Grade>
          <Card label="Criadas" valor={n0(visitas.criadas)} atual={visitas.criadas} anterior={anterior.visitas.criadas} />
          <Card label="Realizadas" valor={n0(visitas.realizadas)} tom="bom"
                atual={visitas.realizadas} anterior={anterior.visitas.realizadas} />
          <Card label="No-show" valor={n0(visitas.no_show)} tom={visitas.no_show > 0 ? "alerta" : "neutro"}
                atual={visitas.no_show} anterior={anterior.visitas.no_show} inverso />
          <Card label="A realizar" valor={n0(visitas.a_realizar)} hint="ainda na agenda" />
          <Card label="Comparecimento" valor={p1(visitas.taxa_comparecimento)}
                hint="realizadas ÷ (realizadas + no-show)"
                atual={visitas.taxa_comparecimento} anterior={anterior.visitas.taxa_comparecimento} />
          <Card label="Lead vira visita" valor={p1(visitas.taxa_lead_visita)} hint="visitas ÷ leads recebidos"
                atual={visitas.taxa_lead_visita} anterior={anterior.visitas.taxa_lead_visita} />
        </Grade>
      </Bloco>

      <Bloco titulo="Negócios e vendas"
             sub="Negócio em aberto é a etapa do pipeline. Venda e VGV vêm da view oficial (v_fato_venda), já com parceria rateada.">
        <Grade>
          <Card label="Viraram negócio" valor={n0(negocios.criados)} hint="entraram na zona comercial"
                atual={negocios.criados} anterior={anterior.negocios.criados} />
          <Card label="Em aberto agora" valor={n0(negocios.ativos)} hint="documentação + negociação + contrato" />
          <Card label="Em documentação" valor={n0(negocios.em_documentacao)} />
          <Card label="Em negociação" valor={n0(negocios.em_negociacao)} />
          <Card label="Em contrato" valor={n0(negocios.em_contrato)} />
          <Card label="Vendas" valor={n0(negocios.vendas)} tom={negocios.vendas > 0 ? "bom" : "neutro"}
                hint={negocios.vendas_em_parceria > 0 ? `${negocios.vendas_em_parceria} em parceria` : undefined}
                atual={negocios.vendas} anterior={anterior.negocios.vendas} />
          <Card label="VGV" valor={fmtMoney(negocios.vgv, "short")} hint={fmtMoney(negocios.vgv, "exact")}
                tom={negocios.vgv > 0 ? "bom" : "neutro"}
                atual={Math.round(negocios.vgv)} anterior={Math.round(anterior.negocios.vgv)} />
          <Card label="Ticket médio" valor={negocios.vendas > 0 ? fmtMoney(negocios.ticket_medio, "short") : "—"}
                hint={negocios.vendas > 0 ? fmtMoney(negocios.ticket_medio, "exact") : undefined} />
          <Card label="Visita vira venda" valor={p1(negocios.taxa_visita_venda)} hint="vendas ÷ visitas realizadas"
                atual={negocios.taxa_visita_venda} anterior={anterior.negocios.taxa_visita_venda} />
          <Card label="Lead vira venda" valor={p1(negocios.taxa_lead_venda)} hint="vendas ÷ leads recebidos"
                atual={negocios.taxa_lead_venda} anterior={anterior.negocios.taxa_lead_venda} />
          <Card label="Custo por venda" valor={temCusto && negocios.vendas > 0 ? fmtMoney(negocios.custo_por_venda, "exact") : "—"}
                hint="custo em leads ÷ vendas" inverso />
        </Grade>
        {data.origensVenda.length > 0 && (
          <div className="rx-scroll">
            <table className="rx-table">
              <thead><tr><th className="l">Origem das vendas</th><th>Vendas</th><th>VGV</th><th>Participação</th></tr></thead>
              <tbody>
                {data.origensVenda.map((o) => (
                  <tr key={o.origem}>
                    <td className="l">{o.origem}</td>
                    <td className="rx-good">{o.vendas}</td>
                    <td>{fmtMoney(o.vgv, "short")}</td>
                    <td>{negocios.vendas > 0 ? p1(Math.round((o.vendas / negocios.vendas) * 1000) / 10) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloco>

      <Bloco titulo="Por empreendimento" sub="Onde ele converte melhor: visita marcada que virou visita feita, e o que virou venda.">
        <TabelaEmpreendimentos linhas={data.empreendimentos} />
      </Bloco>

      <Bloco titulo="Presença e roleta" sub="Turnos validados pelo gestor e credenciamentos na roleta.">
        <Grade>
          <Card label="Presenças manhã" valor={n0(presenca.manha)} atual={presenca.manha} anterior={anterior.presenca.manha} />
          <Card label="Presenças tarde" valor={n0(presenca.tarde)} atual={presenca.tarde} anterior={anterior.presenca.tarde} />
          <Card label="Presenças noturnas" valor={n0(presenca.noturna)} atual={presenca.noturna} anterior={anterior.presenca.noturna} />
          <Card label="Total de presenças" valor={n0(presenca.total)} hint={`${presenca.dias_com_presenca} dias na empresa`}
                atual={presenca.total} anterior={anterior.presenca.total} />
          <Card label="Faltas registradas" valor={n0(presenca.faltas)} tom={presenca.faltas > 0 ? "ruim" : "bom"}
                atual={presenca.faltas} anterior={anterior.presenca.faltas} inverso />
          <Card label="Dias na empresa" valor={n0(presenca.dias_com_presenca)} hint="dias com pelo menos um turno" />
          <Card label="Roleta manhã" valor={n0(presenca.roleta_manha)}
                atual={presenca.roleta_manha} anterior={anterior.presenca.roleta_manha} />
          <Card label="Roleta tarde" valor={n0(presenca.roleta_tarde)}
                atual={presenca.roleta_tarde} anterior={anterior.presenca.roleta_tarde} />
          <Card label="Roleta noturna" valor={n0(presenca.roleta_noturna)}
                atual={presenca.roleta_noturna} anterior={anterior.presenca.roleta_noturna} />
        </Grade>
        <p className="rx-nota">
          Presença é o turno validado pelo gestor. Roleta é o credenciamento para receber lead naquela janela:
          quem se credencia para o dia todo conta em manhã e em tarde; madrugada entra na noturna.
        </p>
      </Bloco>

      <Bloco titulo="Uso do CRM" sub="Se ele registra o que faz, cumpre o que marcou e mantém a carteira viva.">
        <Grade>
          <Card label="Atividades registradas" valor={n0(crm.atividades)}
                atual={crm.atividades} anterior={anterior.crm.atividades} />
          <Card label="Leads tocados" valor={n0(crm.leads_tocados)} hint={`${d1(crm.atividades_por_lead)} atividades por lead`}
                atual={crm.leads_tocados} anterior={anterior.crm.leads_tocados} />
          <Card label="Lembretes criados" valor={n0(crm.lembretes_criados)}
                atual={crm.lembretes_criados} anterior={anterior.crm.lembretes_criados} />
          <Card label="Lembretes cumpridos" valor={n0(crm.lembretes_concluidos)}
                hint={`${p1(crm.pct_lembretes_cumpridos)} dos criados`} tom={crm.pct_lembretes_cumpridos >= 70 ? "bom" : "alerta"}
                atual={crm.lembretes_concluidos} anterior={anterior.crm.lembretes_concluidos} />
          <Card label="Lembretes atrasados" valor={n0(crm.lembretes_atrasados)} hint={`${p1(crm.pct_atrasados)} dos pendentes`}
                tom={crm.lembretes_atrasados > 0 ? "ruim" : "bom"} />
          <Card label="Adiamentos" valor={n0(crm.adiamentos)} tom={crm.adiamentos > 0 ? "alerta" : "neutro"}
                atual={crm.adiamentos} anterior={anterior.crm.adiamentos} inverso />
          <Card label="Pipeline estagnado" valor={p1(crm.pct_estagnados)} hint={`${leads.estagnados} de ${leads.ativos} leads`}
                tom={crm.pct_estagnados > 20 ? "ruim" : crm.pct_estagnados > 0 ? "alerta" : "bom"} />
          <Card label="Leads sem nenhum registro" valor={n0(crm.leads_sem_atividade)}
                tom={crm.leads_sem_atividade > 0 ? "ruim" : "bom"} hint="ativos, sem atividade lançada" />
        </Grade>
        <p className="rx-nota">
          Lembretes atrasados, pipeline estagnado e leads sem registro são a foto de hoje: mostram a dívida que
          está aberta agora, não o que aconteceu dentro do período.
        </p>
      </Bloco>

      <Bloco titulo={`Evolução em ${janela.start.slice(0, 4)}`}
             sub="Mês a mês, do começo do ano até agora. Cada faixa tem a própria escala; leia de cima para baixo para ver o mês inteiro.">
        <Evolucao dados={data.evolucao} />
      </Bloco>

      <div className="rx-rodape">
        Raio-X do Corretor · Uhome Sales · gerado em {hojeBRT().split("-").reverse().join("/")}.<br />
        Fontes: pipeline_leads, pipeline_historico, visitas, negocios, roleta_presencas, roleta_credenciamentos,
        pipeline_atividades, pipeline_tarefas e marketing_entries_ad (investimento do Meta).
        Estagnação pela régua única do CRM (lead_saude_status). Comparação: {labelJanela(janelaAnterior)}.
      </div>
    </div>
  );
}

// ── página ───────────────────────────────────────────────────────────────────

/**
 * Corretor e período vivem na URL: o link é compartilhável e a versão de
 * impressão abre exatamente o mesmo recorte numa aba limpa.
 */
function useEstadoDaUrl() {
  const [params, setParams] = useSearchParams();
  const hoje = hojeBRT();
  const bruto = params.get("periodo");
  const opt: PeriodoOpt = PERIODO_OPCOES.some((o) => o.value === bruto)
    ? (bruto as PeriodoOpt) : "mes";
  const custom = {
    inicio: params.get("de") || `${hoje.slice(0, 8)}01`,
    fim: params.get("ate") || hoje,
  };
  const corretor = params.get("corretor");
  const set = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => p.set(k, v));
    setParams(p, { replace: true });
  };
  return { params, opt, custom, corretor, set };
}

function ConteudoRaioX({ modoImpressao, esconderPeriodo }: { modoImpressao?: boolean; esconderPeriodo?: boolean }) {
  const { params, opt, custom, corretor, set } = useEstadoDaUrl();

  const { data: corretores } = useCorretoresDoEscopo();
  const { user } = useAuth();
  const { isCorretor, isGestor } = useUserRole();
  // Corretor puro vê SÓ a si mesmo (sem seletor de corretor).
  const travado = isCorretor && !isGestor;

  const selecionado = travado ? (user?.id ?? corretor ?? null) : (corretor ?? corretores?.[0]?.user_id ?? null);
  const { data, isLoading, error } = useRaioXCorretor(selecionado, opt, custom);
  const janela = useMemo(() => calcJanela(opt, custom), [opt, custom]);

  // Na aba de impressão, dispara o diálogo do navegador assim que os números chegam.
  const jaImprimiu = useRef(false);
  useEffect(() => {
    if (!modoImpressao || !data || jaImprimiu.current) return;
    jaImprimiu.current = true;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [modoImpressao, data]);

  const abrirImpressao = () => {
    const p = new URLSearchParams(params);
    if (selecionado) p.set("corretor", selecionado);
    p.set("periodo", opt);
    if (opt === "custom") { p.set("de", custom.inicio); p.set("ate", custom.fim); }
    window.open(`/raio-x-corretor/imprimir?${p.toString()}`, "_blank", "noopener");
  };

  const filtros = modoImpressao ? null : (
    <>
      {!travado && (
        <div className="f">
          <label>Corretor</label>
          <select value={selecionado ?? ""} onChange={(e) => set({ corretor: e.target.value })}>
            {(corretores ?? []).map((c) => <option key={c.user_id} value={c.user_id}>{c.nome}</option>)}
          </select>
        </div>
      )}
      {!esconderPeriodo && (
        <div className="f">
          <label>Período</label>
          <select value={opt} onChange={(e) => set({ periodo: e.target.value })}>
            {PERIODO_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}
      {!esconderPeriodo && opt === "custom" && (
        <>
          <div className="f">
            <label>De</label>
            <input type="date" value={custom.inicio} max={custom.fim}
                   onChange={(e) => set({ de: e.target.value })} />
          </div>
          <div className="f">
            <label>Até</label>
            <input type="date" value={custom.fim} min={custom.inicio}
                   onChange={(e) => set({ ate: e.target.value })} />
          </div>
        </>
      )}

      <button className="rx-print" onClick={abrirImpressao}>Baixar PDF</button>
    </>
  );

  if (isLoading || !data) {
    return (
      <div className="rxc">
        <style>{RX_STYLE}</style>
        {filtros && <div className="rx-bar rx-noprint">{filtros}</div>}
        <div className="rx-load">
          {error ? "Não consegui carregar o raio-x desse corretor." : "Montando a vida completa do corretor…"}
        </div>
      </div>
    );
  }

  const label = opt === "custom" ? labelJanela(janela) : labelOpcao(opt);
  return <RaioXCorretorView data={data} filtros={filtros} periodoLabel={label} />;
}

export default function RaioXCorretorPage({ esconderPeriodo }: { esconderPeriodo?: boolean } = {}) {
  return <ConteudoRaioX esconderPeriodo={esconderPeriodo} />;
}


/**
 * Versão de impressão: mesma página, fora do shell do CRM (sem menu lateral nem
 * abas), então o PDF sai só com o relatório. Abre em aba nova e já chama a
 * impressão sozinha.
 */
export function RaioXCorretorImpressao() {
  return (
    <div style={{ padding: "18px 16px", background: "#fff", minHeight: "100vh" }}>
      <ConteudoRaioX modoImpressao />
    </div>
  );
}
