import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useNatal } from "./useNatal";
import { useMuralVendas, type VendaMural } from "./useMuralVendas";
import { vendasNovas } from "./mural";

const CHAVE = "natal-vendas-vistas";

/** Tela dourada quando entra uma venda nova na campanha. Sem valores. Respeita o botão de efeitos. */
export function ComemoracaoVenda() {
  const { efeitos, movimento } = useNatal();
  const { data } = useMuralVendas();
  const [fila, setFila] = useState<VendaMural[]>([]);

  useEffect(() => {
    if (!data) return;
    let vistas: string[] | null = null;
    try { const s = localStorage.getItem(CHAVE); vistas = s ? JSON.parse(s) : null; } catch { /* ok */ }
    const r = vendasNovas(data.map((v) => v.negocio_id), vistas);
    try { localStorage.setItem(CHAVE, JSON.stringify(r.vistas)); } catch { /* ok */ }
    if (efeitos && r.novas.length) setFila((f) => [...f, ...data.filter((v) => r.novas.includes(v.negocio_id)).slice(0, 3)]);
  }, [data, efeitos]);

  const atual = fila[0];
  useEffect(() => {
    if (!atual) return;
    const t = setTimeout(() => setFila((f) => f.slice(1)), 7000);
    return () => clearTimeout(t);
  }, [atual]);

  if (!atual) return null;
  const nomes = atual.corretores.map((c) => c.nome.split(" ")[0]).join(" & ") || "O time";
  const foto = atual.corretores[0]?.foto;
  return (
    <div role="status" className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm" onClick={() => setFila((f) => f.slice(1))}>
      <div className="natal-venda-card relative w-full max-w-sm overflow-hidden rounded-3xl p-6 text-center shadow-2xl">
        {movimento && Array.from({ length: 30 }).map((_, i) => (
          <span key={i} aria-hidden className="natal-confete" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.15}s` }} />
        ))}
        <button aria-label="Fechar" className="absolute right-3 top-3 rounded-full p-1 opacity-70 hover:opacity-100"><X className="h-5 w-5" /></button>
        <img src="/natal/sino_3d.png" alt="" aria-hidden className={`absolute right-4 top-16 h-16 w-16 ${movimento ? "natal-balanca" : ""}`} />
        <div className="relative mx-auto h-28 w-28">
          {foto ? <img src={foto} alt="" className="h-full w-full rounded-full border-4 border-background object-cover" />
            : <div className="flex h-full w-full items-center justify-center rounded-full border-4 border-background bg-muted text-4xl">🎁</div>}
          <img src="/natal/gorro_3d.png" alt="" aria-hidden className="absolute -right-4 -top-6 w-[60%] rotate-12" />
        </div>
        <p className="mt-5 text-2xl font-extrabold leading-tight">🎁 {nomes} {atual.corretores.length > 1 ? "fecharam" : "fechou"} venda no {atual.empreendimento}</p>
        <div className="mt-4 flex items-center justify-center gap-2 text-2xl font-extrabold">
          <img src="/natal/chave_de_ouro_com_laco.svg" alt="" aria-hidden className="h-10 w-10" />+1 chave
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-widest opacity-70">Mais um sonho realizado</p>
      </div>
    </div>
  );
}
