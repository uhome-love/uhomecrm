import { Volume2 } from "lucide-react";
import UhomeSalesLogo from "@/components/brand/UhomeSalesLogo";
import { SYMBOL, SYMBOL_BOX } from "@/components/brand/brandPaths";
import { loginNatal } from "@/natal/loginNatal";

const HOMI = "/images/homi-3d-full.png";

/** Recado fixo desta fase (troca semanal pelo CRM fica para fase separada). */
export const RECADO = {
  titulo: "Quanto mais visitas, mais vendas.",
  texto: "Nesta semana, o foco é marcar visita presencial com cada lead novo. Venda a visita, não o empreendimento.",
  curto: "Foco em marcar visita presencial com cada lead novo.",
  autor: "Lucas Sarmento",
  cargo: "CEO da Uhome",
};

function saudacao() {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false })) % 24;
  return h < 12 ? "Bom dia!" : h < 18 ? "Boa tarde!" : "Boa noite!";
}

function dataHoje() {
  return new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit" });
}

function Marca({ className }: { className?: string }) {
  const b = SYMBOL_BOX;
  return (
    <svg viewBox={`${b.x + 60} ${b.y + 40} ${b.w - 120} ${b.h - 40}`} className={className} aria-hidden="true">
      <path className="auth-soft-mark" d={SYMBOL.house} fillRule="evenodd" />
    </svg>
  );
}

/** Logo + "com Homi IA". */
export function AuthLogo({ height = 44 }: { height?: number }) {
  return (
    <div>
      <UhomeSalesLogo height={height} natal={loginNatal() !== null} />
      <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
        com <img src="/images/homi-48.png" alt="" className="h-4 w-4" /> <b className="font-semibold text-foreground">Homi IA</b>
      </p>
    </div>
  );
}

export function AuthBrandPanel() {
  const natal = loginNatal();
  return (
    <aside className="auth-soft-bg relative m-4 hidden flex-[1.15] flex-col justify-between overflow-hidden rounded-3xl p-14 lg:flex">
      <Marca className="pointer-events-none absolute -bottom-10 -right-6 h-[90%]" />

      <article className="relative max-w-[440px] rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs">
          {natal
            ? <span className="flex items-center gap-2 font-semibold text-foreground"><i className="h-2 w-2 rounded-full bg-destructive" />{natal.selo}</span>
            : <span className="flex items-center gap-2 font-semibold text-primary"><Volume2 className="h-3.5 w-3.5" />Recado da semana</span>}
          <span className="text-muted-foreground">{dataHoje()}</span>
        </div>
        <h2 className="font-display text-[22px] font-extrabold leading-tight text-foreground">{RECADO.titulo}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{RECADO.texto}</p>
        <div className="mt-4 flex items-center gap-2.5 border-t border-border pt-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">LS</span>
          <span><b className="block text-sm font-semibold text-foreground">{RECADO.autor}</b><span className="text-xs text-muted-foreground">{RECADO.cargo}</span></span>
        </div>
      </article>

      <div className="absolute bottom-24 right-14 flex flex-col items-end">
        <div className="mb-2 max-w-[260px] rounded-2xl rounded-br-sm border border-homi-cyan/40 bg-card px-4 py-3 text-sm text-foreground shadow-lg">
          <b className="text-homi-text">{saudacao()}</b> {natal ? natal.balao : "Entre que eu te ajudo a organizar o dia."}
        </div>
        <img src={natal ? natal.homi : HOMI} alt={natal ? natal.homiAlt : "Homi, o assistente do UhomeSales"} className="w-[170px] drop-shadow-2xl" />
      </div>

      <h1 className="relative font-display text-[58px] font-extrabold leading-[1.02] tracking-tight text-foreground">
        Cada lead,<br /><span className="text-primary">uma chave.</span>
      </h1>
    </aside>
  );
}

/** Faixa do topo no celular. */
export function AuthMobileHeader() {
  const natal = loginNatal();
  return (
    <header className="auth-soft-bg relative h-[184px] overflow-hidden rounded-b-[28px] px-6 pt-7 lg:hidden">
      <Marca className="pointer-events-none absolute -right-4 top-2 h-[200px]" />
      <div className="relative"><AuthLogo height={32} /></div>
      <img src={natal ? natal.homi : HOMI} alt="" className="absolute bottom-0 right-5 h-[165px]" />
    </header>
  );
}

/** Recado compacto (celular). */
export function AuthRecadoCurto() {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-4 lg:hidden">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary"><Volume2 className="h-3.5 w-3.5" />Recado da semana · Lucas</p>
      <p className="mt-1 font-display text-[15px] font-extrabold text-foreground">{RECADO.titulo}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{RECADO.curto}</p>
    </div>
  );
}
