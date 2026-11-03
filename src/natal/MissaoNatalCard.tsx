import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNatal } from "./useNatal";
import { useMetaNatal, useMissaoNatal, useSalvarMetaNatal } from "./useMissaoNatal";
import { MetaNatalDialog } from "./MetaNatalDialog";
import { brlCurto, META_EQUIPE, META_UHOME, ritmo } from "./missao";
import { CAMPANHA_FIM, diasAte18 } from "./config";

const CHAVE_ABRIU = "natal-meta-abriu";

export function BarraOuro({ pct, chave = false, fina = false }: { pct: number; chave?: boolean; fina?: boolean }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className={`relative w-full rounded-full bg-muted ${fina ? "h-1.5" : "h-3"}`}>
      <div className="h-full rounded-full" style={{ width: `${p}%`, background: "var(--natal-gold-grad)" }} />
      {chave && <img src="/natal/chave_de_ouro_com_laco.svg" alt="" aria-hidden className="absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 drop-shadow" style={{ left: `${Math.max(3, p)}%` }} />}
    </div>
  );
}

function Confete() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 28 }).map((_, i) => (
        <span key={i} className="natal-confete" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.15}s` }} />
      ))}
    </div>
  );
}

export function MissaoNatalCard({ userId }: { userId?: string }) {
  const { efeitos, ativo, movimento } = useNatal();
  const { data: meta } = useMetaNatal(userId);
  const { data } = useMissaoNatal(ativo ? userId : undefined);
  const salvar = useSalvarMetaNatal(userId);
  const [aberto, setAberto] = useState(false);
  const [confete, setConfete] = useState(false);

  useEffect(() => {
    if (!ativo || !meta || meta.definida || (data && data.hoje > CAMPANHA_FIM)) return;
    try { if (!localStorage.getItem(CHAVE_ABRIU)) { localStorage.setItem(CHAVE_ABRIU, "1"); setAberto(true); } } catch { /* sem storage */ }
  }, [ativo, meta, data]);

  const vgv = data?.campanha.vgv_assinado ?? 0;
  const metaVgv = meta?.meta_vgv ?? 1_000_000;
  const cumpriu = vgv >= metaVgv;

  useEffect(() => {
    if (!cumpriu || !movimento || !data) return;
    const k = `natal-confete-${data.hoje}`;
    try { if (!localStorage.getItem(k)) { localStorage.setItem(k, "1"); setConfete(true); setTimeout(() => setConfete(false), 4000); } } catch { /* ok */ }
  }, [cumpriu, movimento, data]);

  if (!ativo || !meta || !data) return null;
  const encerrada = data.hoje > CAMPANHA_FIM;
  const pct = (vgv / metaVgv) * 100;
  const r = ritmo(metaVgv, vgv, data.hoje);
  const metaSem = meta.meta_visitas_semana;
  const anel = Math.min(1, data.semanaRealizadas / metaSem);
  const c = data.campanha;
  const numeros: [string, string | number][] = [
    ["Leads recebidos", c.leads_recebidos], ["Visitas agendadas", c.visitas_agendadas], ["Visitas realizadas", c.visitas_realizadas],
    ["Negócios", data.negocios], ["Vendas", c.vendas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })], ["VGV assinado", brlCurto(vgv)],
  ];

  return (
    <section className={`relative overflow-hidden rounded-2xl border bg-card p-4 md:p-5 ${efeitos ? "natal-borda-ouro" : ""}`}>
      {confete && <Confete />}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/natal/chave_de_ouro_com_laco.svg" alt="" aria-hidden className="h-10 w-10" />
          <div>
            <h2 className="flex flex-wrap items-center gap-2 text-base font-bold text-foreground">
              Minha Missão de Natal
              {cumpriu && <span className="natal-chip-ouro rounded-full px-2 py-0.5 text-[11px] font-bold">Missão cumprida 🔑</span>}
            </h2>
            <p className="text-xs text-muted-foreground">Campanha de 02/11 a 18/12 · atualiza sozinho a cada visita e venda</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!encerrada && <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">🎄 Faltam {diasAte18(data.hoje)} dias</span>}
          {!encerrada && <Button size="sm" variant="outline" onClick={() => setAberto(true)}>Minha meta</Button>}
        </div>
      </header>

      {encerrada ? (
        <p className="mt-4 text-lg font-bold">Campanha encerrada: você fez {brlCurto(vgv)} {cumpriu ? "e bateu a meta! 🔑" : `de ${brlCurto(metaVgv)}.`}</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">VGV assinado na campanha</p>
            <p className="mt-1 text-2xl font-extrabold">{brlCurto(vgv)}</p>
            <p className="text-xs text-muted-foreground">de {brlCurto(metaVgv)} · sua meta</p>
            <div className="mt-4"><BarraOuro pct={pct} chave /></div>
            <p className="mt-3 text-xs"><b>{Math.floor(pct)}%</b> da meta · {r.faltamVgv > 0 ? `Faltam ${brlCurto(r.faltamVgv)}` : "Meta batida!"}</p>
          </div>
          <div className="flex items-center gap-4 rounded-xl bg-muted/40 p-4">
            <svg viewBox="0 0 36 36" className="h-20 w-20 shrink-0 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-muted" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--natal-gold, 46 65% 52%))" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${anel * 100} 100`} />
            </svg>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Visitas realizadas</p>
              <p className="text-2xl font-extrabold">{data.semanaRealizadas}<span className="text-base text-muted-foreground">/{metaSem}</span></p>
              <p className="text-xs text-muted-foreground">nesta semana</p>
              <p className="mt-1 text-xs">Na campanha: {c.visitas_realizadas} de {metaSem * 7} realizadas</p>
            </div>
          </div>
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Seu ritmo até 18/12</p>
            <p className="mt-1 text-2xl font-extrabold">{r.visitas} <span className="text-sm font-semibold text-muted-foreground">visitas faltam</span></p>
            <p className="text-sm">≈ <b>{r.porSemana}</b> por semana</p>
            <p className="mt-2 text-[11px] text-muted-foreground">Média Uhome: 1 venda a cada 13 visitas realizadas.</p>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 md:grid-cols-6">
        {numeros.map(([rot, v]) => (
          <div key={rot} className="rounded-lg border bg-background p-2 text-center">
            <p className="text-lg font-bold">{v}</p>
            <p className="text-[10.5px] leading-tight text-muted-foreground">{rot}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 flex justify-between text-xs"><span>{data.equipeNome ? `Equipe ${data.equipeNome}` : "Sua equipe"} · meta R$ 10 mi</span><b>{brlCurto(data.equipeVgv)}</b></div>
          <BarraOuro pct={(data.equipeVgv / META_EQUIPE) * 100} fina />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs"><span>Missão 100 milhões · Uhome</span><b>{brlCurto(data.uhomeVgv)}</b></div>
          <BarraOuro pct={(data.uhomeVgv / META_UHOME) * 100} fina />
        </div>
      </div>

      <MetaNatalDialog open={aberto} onOpenChange={setAberto} metaInicial={metaVgv} visitasInicial={metaSem} onSalvar={salvar} />
    </section>
  );
}
