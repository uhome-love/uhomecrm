import "./natal.css";

/** Carregamento natalino: Homi de Noel com a chave. */
export function CarregandoNatal() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20" role="status" aria-label="Carregando">
      <div className="relative">
        <img src="/natal/homi_noel.png" alt="" className="natal-flutua h-28 w-28 object-contain" />
        <img src="/natal/chave_de_ouro_com_laco.svg" alt="" aria-hidden className="absolute -right-6 bottom-2 h-12 w-12 -rotate-12" />
      </div>
      <p className="natal-texto-ouro text-xl font-extrabold">Carregando…</p>
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
        <div className="natal-carregando h-full w-1/3 rounded-full" style={{ background: "var(--natal-gold-grad)" }} />
      </div>
    </div>
  );
}
