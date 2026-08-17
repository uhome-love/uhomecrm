/**
 * A visão do gerente na Academia: quem anda, quem travou, quem sumiu.
 *
 * Existe por um motivo específico: em março de 2026 a Academia teve 11 pessoas
 * e morreu em uma semana. Conteúdo bom sem ninguém acompanhando esvazia. Esta
 * tela é o que dá ao gestor o gancho da conversa.
 *
 * Os dados vêm da RPC get_academia_time(), que é SECURITY DEFINER porque o
 * progresso é privado por RLS. A função devolve só o agregado, nunca a linha.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FalaHomi, Homi } from "./Homi";
import { cn } from "@/lib/utils";

interface LinhaTime {
  corretor_id: string;
  nome: string | null;
  avatar_url: string | null;
  aulas_feitas: number;
  xp: number;
  ultima_atividade: string | null;
  nivel_atual: string | null;
}

const DIA = 86_400_000;

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / DIA);
}

function quando(dias: number | null): string {
  if (dias === null) return "nunca entrou";
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

export function MeuTime({ totalAulas }: { totalAulas: number }) {
  const { data: time = [], isLoading } = useQuery({
    queryKey: ["academia-time"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_academia_time");
      if (error) throw error;
      return (data || []) as LinhaTime[];
    },
    staleTime: 60_000,
  });

  /**
   * Quem NUNCA começou é um problema diferente de quem PAROU no meio, e o
   * gestor age diferente nos dois casos. Tratar os dois como alarme deixa a
   * tela vermelha no dia do lançamento e ensina o gestor a ignorar o alarme.
   */
  const linhas = useMemo(
    () =>
      time.map((c) => {
        const dias = diasDesde(c.ultima_atividade);
        const estado =
          c.aulas_feitas === 0 && dias === null ? "novo"
          : dias !== null && dias > 10 ? "sumiu"
          : totalAulas > 0 && c.aulas_feitas >= totalAulas ? "voando"
          : "ok";
        return { ...c, dias, estado };
      }),
    [time, totalAulas]
  );

  /** ordem que serve ao gestor: quem precisa de conversa primeiro, quem voa por último */
  const PESO: Record<string, number> = { sumiu: 0, ok: 1, voando: 2, novo: 3 };
  const ordenadas = useMemo(
    () => [...linhas].sort((a, b) => PESO[a.estado] - PESO[b.estado] || b.aulas_feitas - a.aulas_feitas),
    [linhas]
  );

  const semana = linhas.filter((c) => c.dias !== null && c.dias <= 7).length;
  const sumidos = linhas.filter((c) => c.estado === "sumiu");
  const nunca = linhas.filter((c) => c.estado === "novo").length;
  const comecaram = linhas.filter((c) => c.aulas_feitas > 0).length;
  /** ninguém tocou na Academia: nem entrou. Um só que abriu já muda a leitura da tela. */
  const ninguemComecou = linhas.every((c) => c.estado === "novo");
  const maisUrgente = sumidos[0] || null;
  const ativos = ordenadas.filter((c) => c.estado !== "novo");
  const novos = ordenadas.filter((c) => c.estado === "novo");

  if (isLoading) {
    return (
      <div className="uac-esqueleto">
        <span className="bloco" />
        <span className="bloco" />
      </div>
    );
  }

  if (linhas.length === 0) {
    return (
      <div className="uac-vazio">
        <Homi pose="pensando" tamanho={90} />
        <b>Não consegui ler o time.</b>
        <span>Essa tela é para gerente, diretoria e admin.</span>
      </div>
    );
  }

  return (
    <>
      <section className="uac-secao">
        <p className="uac-rotulo">Meu time na formação</p>
        <h2 className="uac-titulao">Quem está andando,<br />quem travou, quem sumiu.</h2>

        <div className="uac-numeros">
          <div className="uac-numero">
            <b>{semana}</b>
            <small>de {linhas.length} entraram nos últimos 7 dias</small>
          </div>
          <div className="uac-numero">
            <b>{linhas.filter((c) => c.aulas_feitas > 0).length}</b>
            <small>já fizeram pelo menos uma aula</small>
          </div>
          <div className="uac-numero dorme">
            <b>{sumidos.length > 0 ? sumidos.length : nunca}</b>
            <small>
              {sumidos.length > 0
                ? "começaram e pararam há mais de 10 dias"
                : "ainda não abriram a Academia"}
            </small>
            <Homi pose="dormindo" tamanho={52} />
          </div>
        </div>

        {ninguemComecou ? (
          <FalaHomi pose="apontando" quem="Homi para o gestor" className="mb-4">
            A Academia ainda não foi aberta pro time: <b>ninguém começou</b>. Assim que o primeiro
            corretor entrar, essa tela vira o seu acompanhamento de quem anda e quem parou.
          </FalaHomi>
        ) : (
          maisUrgente && (
            <FalaHomi pose="preocupado" quem="Homi para o gestor" className="mb-4">
              <b>{maisUrgente.nome || "Um corretor"}</b> começou e não entra {quando(maisUrgente.dias)}.
              Antes de cobrar a aula, vale entender o que está acontecendo.
            </FalaHomi>
          )
        )}

        {/* Quem já mexeu na Academia merece a linha inteira. Quem nunca abriu
            dizia a mesma coisa três vezes ("não começou", "ainda não abriu",
            "nunca entrou") em 28 linhas iguais — vira uma lista de nomes. */}
        {ativos.length > 0 && (
          <div>
            {ativos.map((c) => (
              <div key={c.corretor_id} className={cn("uac-corretor", c.estado)}>
                <b>{c.nome || "Sem nome"}</b>
                <span className="uac-chip-nivel">
                  {c.nivel_atual ? c.nivel_atual.replace(" · ", " ") : "começando"}
                </span>
                <p>
                  {c.aulas_feitas > 0
                    ? `${c.aulas_feitas} de ${totalAulas} aulas · ${c.xp} XP`
                    : "entrou, ainda não concluiu nenhuma aula"}
                </p>
                <span className="uac-corretor-ultima">{quando(c.dias)}</span>
              </div>
            ))}
          </div>
        )}

        {novos.length > 0 && (
          <div className="uac-naoabriram">
            <p className="uac-rotulo">Ainda não abriram · {novos.length}</p>
            <div className="uac-nomes">
              {novos.map((c) => (
                <span key={c.corretor_id}>{c.nome || "Sem nome"}</span>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
