import { useMuralVendas, type CorretorMural } from "./useMuralVendas";
import { hojeBRT } from "./mural";

function Rosto({ c, tam = 64 }: { c: CorretorMural; tam?: number }) {
  const ini = c.nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="relative shrink-0" style={{ width: tam, height: tam }}>
      {c.foto ? (
        <img src={c.foto} alt={c.nome} loading="lazy" className="h-full w-full rounded-full border-2 border-background object-cover shadow" />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-background bg-muted text-lg font-bold shadow">{ini}</div>
      )}
      <img src="/natal/gorro_3d.png" alt="" aria-hidden className="absolute -right-2 -top-3 w-[55%] rotate-12" />
    </div>
  );
}

const dataCurta = (d: string) => { const [, m, dia] = d.split("-"); return `${dia}/${m}`; };

export function MuralVendas({ limite }: { limite?: number }) {
  const { data = [], isLoading } = useMuralVendas();
  const hoje = hojeBRT();
  const lista = limite ? data.slice(0, limite) : data;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <img src="/natal/presente_3d.png" alt="" aria-hidden className="h-8 w-8" />
        <h2 className="natal-secao-titulo text-lg font-extrabold">Mural das Vendas</h2>
        {data.length > 0 && <span className="natal-chip-ouro rounded-full px-2 py-0.5 text-xs font-bold">{data.length} {data.length === 1 ? "venda" : "vendas"}</span>}
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <img src="/natal/estrela_3d.png" alt="" aria-hidden className="mx-auto mb-2 h-10 w-10" />
          A primeira venda da campanha vai aparecer aqui. Quem vai ser? 🎄
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {lista.map((v) => {
            const doDia = v.data_assinatura === hoje;
            const parceria = v.corretores.length > 1;
            return (
              <article key={v.negocio_id} className={`relative flex flex-col items-center rounded-2xl border p-3 pt-5 text-center shadow-sm ${doDia ? "natal-card-ouro" : "bg-card"}`}>
                {(doDia || parceria) && (
                  <span className="natal-chip-ouro absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold">{doDia ? "Venda do dia" : "Parceria"}</span>
                )}
                <div className="mt-2 flex -space-x-3">{v.corretores.map((c, i) => <Rosto key={i} c={c} />)}</div>
                <p className="mt-3 line-clamp-2 text-sm font-bold">{v.corretores.map((c) => c.nome.split(" ")[0]).join(" & ") || "Corretor"}</p>
                {v.equipe && <p className="text-xs text-muted-foreground">{v.equipe}</p>}
                <p className="mt-1 line-clamp-2 text-xs font-semibold">{v.empreendimento}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">📅 {dataCurta(v.data_assinatura)}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
