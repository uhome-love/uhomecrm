import UhomeSalesLogo from "@/components/brand/UhomeSalesLogo";

const homi = "/images/homi-3d-bust.png";

type Card = { nome: string; info: string; pill?: { label: string; cls: string } };
const COLUNAS: { titulo: string; total: number; offset: string; cards: Card[] }[] = [
  { titulo: "🆕 Novo Lead", total: 12, offset: "", cards: [
    { nome: "Mariana S.", info: "Casa Tua · Meta", pill: { label: "agora", cls: "bg-success/15 text-success" } },
    { nome: "Rafael T.", info: "Essence Canoas" },
  ] },
  { titulo: "🏠 Visita", total: 5, offset: "translate-y-7", cards: [
    { nome: "Juliana P.", info: "Sáb 10h · decorado", pill: { label: "Morno", cls: "bg-warning/15 text-warning" } },
  ] },
  { titulo: "🤝 Negociação", total: 3, offset: "-translate-y-2", cards: [
    { nome: "Carlos M.", info: "Proposta enviada", pill: { label: "Quente", cls: "bg-destructive/10 text-destructive" } },
  ] },
];

/** Painel decorativo do login (só visual; nomes fictícios). */
export function AuthBrandPanel() {
  return (
    <aside className="auth-panel-bg relative hidden lg:flex flex-[1.15] m-4 rounded-3xl overflow-hidden p-14 flex-col justify-end text-primary-foreground" aria-hidden="true">
      <div className="auth-panel-grid absolute inset-0" />

      <div className="absolute top-24 left-14 right-14 flex gap-3.5">
        {COLUNAS.map((c) => (
          <div key={c.titulo} className={`flex-1 rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-3 backdrop-blur ${c.offset}`}>
            <div className="mb-2.5 flex justify-between text-[11px] font-semibold opacity-70">
              <span>{c.titulo}</span><span>{c.total}</span>
            </div>
            {c.cards.map((card) => (
              <div key={card.nome} className="mb-2 rounded-xl bg-card px-3 py-2.5 text-card-foreground shadow-lg">
                <div className="text-[12.5px] font-semibold">{card.nome}</div>
                <div className="text-[11px] text-muted-foreground">{card.info}</div>
                {card.pill && <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${card.pill.cls}`}>{card.pill.label}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="absolute right-[200px] bottom-[290px] rounded-2xl rounded-br-sm bg-card px-3.5 py-2.5 text-[13px] text-card-foreground shadow-xl">
        Bom dia! Você tem <b className="text-homi-text">3 visitas</b> hoje 🔑
      </div>
      <img src={homi} alt="" className="absolute right-8 bottom-36 w-[190px] drop-shadow-2xl" />

      <div className="relative">
        <h1 className="font-display text-[46px] font-extrabold leading-[1.05] tracking-tight">
          Cada lead,<br /><span className="text-homi-cyan">uma chave.</span>
        </h1>
        <p className="mt-3.5 max-w-[440px] text-base opacity-75">O CRM da Uhome para vender mais, com foco e método.</p>
        <div className="mt-7 flex gap-7 text-xs">
          {[["Roleta", "leads na hora"], ["Pipeline", "do lead ao contrato"], ["Homi", "seu copiloto"]].map(([t, s]) => (
            <div key={t}><strong className="block font-display text-[22px]">{t}</strong><span className="opacity-70">{s}</span></div>
          ))}
        </div>
      </div>
    </aside>
  );
}

/** Faixa do topo no celular. */
export function AuthMobileHeader() {
  return (
    <header className="auth-panel-bg relative overflow-hidden rounded-b-[28px] px-6 pb-8 pt-10 text-primary-foreground lg:hidden">
      <div className="auth-panel-grid absolute inset-0" />
      <div className="relative">
        <UhomeSalesLogo theme="white" height={34} />
        <h1 className="mt-5 font-display text-[28px] font-extrabold leading-[1.05] tracking-tight">
          Cada lead,<br /><span className="text-homi-cyan">uma chave.</span>
        </h1>
      </div>
    </header>
  );
}
