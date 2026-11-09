/** Bloco do placar da TV: ranking de ligações da semana (Oferta Ativa + Mutirão). Público, só nome curto e contagens. */
import { useRankingLigacoes } from "@/hooks/useArenaLigacoes";
import { cn } from "@/lib/utils";

const MEDALHA = ["🥇", "🥈", "🥉"];

export function TvRankingLigacoes({ faixa = false }: { faixa?: boolean }) {
  const { data = [] } = useRankingLigacoes("semana");
  const top = data.slice(0, 10);
  if (top.length === 0) return null;

  if (faixa) {
    return (
      <div className="arena-hero flex items-center gap-6 overflow-hidden whitespace-nowrap px-6 py-2 text-lg font-bold">
        <span className="arena-ouro shrink-0">📞 LIGAÇÕES DA SEMANA</span>
        {top.slice(0, 8).map((l) => (
          <span key={l.user_id} className="shrink-0 opacity-90">{MEDALHA[l.posicao - 1] ?? `${l.posicao}º`} {l.nome} <span className="arena-ouro">{l.ligacoes}</span></span>
        ))}
      </div>
    );
  }

  return (
    <section className="arena-vidro w-full max-w-3xl rounded-3xl p-6 text-left">
      <h2 className="mb-4 text-3xl font-black">📞 Ranking de ligações da semana</h2>
      <ol className="space-y-2">
        {top.map((l) => (
          <li key={l.user_id} className={cn("flex items-center gap-4 rounded-2xl px-4 py-2 text-2xl", l.posicao <= 3 && `arena-podio-${l.posicao}`)}>
            <span className="w-10 text-center font-black">{MEDALHA[l.posicao - 1] ?? l.posicao}</span>
            <span className="min-w-0 flex-1 truncate font-bold">{l.nome}</span>
            <span className="text-lg opacity-70">{l.aproveitados} aprov · {l.visitas} vis</span>
            <span className="arena-ouro w-20 text-right font-black tabular-nums">{l.ligacoes}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm opacity-60">Atualiza sozinho · ligações das listas, Bolsão e Mutirão</p>
    </section>
  );
}
