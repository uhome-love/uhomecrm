/**
 * Uhome Academy — a casa da formação do corretor.
 *
 * Identidade própria dentro do CRM (Montserrat, papel quente, o Homi como
 * professor), definida no mockup aprovado pelo Lucas em 16/08:
 *   ~/Downloads/uhome-treinamentos/mockup-academia.html
 *
 * Regras de produto que estão codificadas aqui:
 *  - a jornada é em níveis e todo mundo faz o caminho inteiro;
 *  - NENHUM nível fica trancado: o nível marca progresso, não bloqueia acesso;
 *  - o Homi sugere a ORDEM, nunca o escopo;
 *  - quem já sabe pula a aula pela prova e ganha o XP igual;
 *  - o Homi só fala quando tem um número para citar.
 *
 * Ranking, selos e a visão do gerente entram na onda seguinte, junto com as
 * tabelas que ainda não existem. Nada aqui inventa dado.
 */
import { lazy, Suspense, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAcademia } from "@/hooks/useAcademia";
import { FalaHomi, Homi } from "@/components/academia/v2/Homi";
import { NivelCard, AulaLinha, SemanaItem, type EstadoNivel } from "@/components/academia/v2/pecas";
import "@/styles/academia.css";

const AcademiaGerenciarPage = lazy(() => import("@/pages/AcademiaGerenciarPage"));

type Aba = "inicio" | "trilha" | "gerenciar";

export default function AcademiaPage() {
  const navigate = useNavigate();
  const { trilhas, aulas, totalXp, getTrilhaProgress, getAulaStatus, canManage, loading } = useAcademia();
  const [aba, setAba] = useState<Aba>("inicio");
  const [trilhaAberta, setTrilhaAberta] = useState<string | null>(null);

  /** Os níveis da jornada, na ordem. O "agora" é o primeiro não concluído. */
  const niveis = useMemo(() => {
    // a jornada é a formação publicada: trilha despublicada (arquivo) e trilha sem
    // aula não viram nível, nem para quem é gestor. Isso é assunto da aba Gerenciar.
    const comConteudo = trilhas.filter(
      (t) => t.publicada !== false && aulas.some((a) => a.trilha_id === t.id)
    );
    const ordenadas = [...comConteudo].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    let achouAtual = false;
    return ordenadas.map((trilha, i) => {
      const p = getTrilhaProgress(trilha.id);
      let estado: EstadoNivel;
      if (p.total > 0 && p.percent === 100) {
        estado = "feito";
      } else if (!achouAtual) {
        estado = "agora";
        achouAtual = true;
      } else {
        estado = "adiante";
      }
      return { trilha, ordem: i + 1, feitas: p.completed, total: p.total, estado };
    });
  }, [trilhas, aulas, getTrilhaProgress]);

  const nivelAtual = niveis.find((n) => n.estado === "agora") || niveis[0] || null;

  const aulasDoNivel = useMemo(() => {
    const id = trilhaAberta || nivelAtual?.trilha.id;
    if (!id) return [];
    return aulas.filter((a) => a.trilha_id === id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  }, [aulas, trilhaAberta, nivelAtual]);

  const trilhaExibida = useMemo(
    () => niveis.find((n) => n.trilha.id === (trilhaAberta || nivelAtual?.trilha.id)) || null,
    [niveis, trilhaAberta, nivelAtual]
  );

  /** A aula de hoje: a próxima não concluída do nível atual. */
  const aulaDeHoje = useMemo(() => {
    if (!nivelAtual) return null;
    const doNivel = aulas
      .filter((a) => a.trilha_id === nivelAtual.trilha.id)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    return doNivel.find((a) => getAulaStatus(a.id) !== "concluida") || null;
  }, [aulas, nivelAtual, getAulaStatus]);

  /**
   * A semana: até três coisas, uma de cada natureza (ver, treinar, fazer).
   * Se um tipo ainda não existe no conteúdo, o item simplesmente não aparece.
   */
  const semana = useMemo(() => {
    if (!nivelAtual) return [];
    const doNivel = aulas
      .filter((a) => a.trilha_id === nivelAtual.trilha.id)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const pega = (tipos: string[]) =>
      doNivel.find((a) => tipos.includes(a.tipo) && getAulaStatus(a.id) !== "concluida");

    const ver = pega(["apresentacao", "pdf", "texto", "youtube", "vimeo", "video", "video_upload"]);
    const treinar = pega(["simulador", "quiz"]);
    const fazer = pega(["exercicio", "checklist"]);
    return [ver, treinar, fazer].filter(Boolean).slice(0, 3) as typeof doNivel;
  }, [aulas, nivelAtual, getAulaStatus]);

  const abrirTrilha = (id: string) => {
    setTrilhaAberta(id);
    setAba("trilha");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const abrirAula = (aulaId: string, trilhaId: string | null) => {
    navigate(`/academia/trilha/${trilhaId}?aula=${aulaId}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando a Academia...</span>
      </div>
    );
  }

  return (
    <div className="uac">
      <div className="uac-tela">
        <header className="uac-topo">
          <div className="uac-marca">
            <img src="/images/academia/logo-uhome.png" alt="Uhome" />
            <span>Academy</span>
          </div>
          <nav className="uac-abas" role="tablist" aria-label="Seções da Academia">
            <button type="button" role="tab" aria-selected={aba === "inicio"} className="uac-aba" onClick={() => setAba("inicio")}>
              Início
            </button>
            <button type="button" role="tab" aria-selected={aba === "trilha"} className="uac-aba" onClick={() => setAba("trilha")}>
              Minha trilha
            </button>
            {canManage && (
              <button type="button" role="tab" aria-selected={aba === "gerenciar"} className="uac-aba" onClick={() => setAba("gerenciar")}>
                Gerenciar
              </button>
            )}
          </nav>
        </header>

        {/* ------------------------------------------------------------ INÍCIO */}
        {aba === "inicio" && (
          <>
            {aulaDeHoje ? (
              <section className="uac-secao">
                <p className="uac-rotulo">A sua aula de hoje</p>
                <div className="uac-hoje">
                  <article className="uac-destaque">
                    <img
                      src={nivelAtual?.trilha.thumbnail_url || "/images/academia/capa-padrao.jpg"}
                      alt=""
                      loading="lazy"
                    />
                    <div className="dentro">
                      {nivelAtual && (
                        <FalaHomi pose="apontando" escuro className="mb-4">
                          Você está no <b>{nivelAtual.trilha.titulo}</b> e fechou{" "}
                          <b>{nivelAtual.feitas} de {nivelAtual.total} aulas</b>. Essa é a próxima.
                        </FalaHomi>
                      )}
                      <h2>{aulaDeHoje.titulo}</h2>
                      {aulaDeHoje.descricao && <p>{aulaDeHoje.descricao}</p>}
                      <button
                        type="button"
                        className="uac-bt"
                        onClick={() => abrirAula(aulaDeHoje.id, aulaDeHoje.trilha_id)}
                      >
                        Continuar
                      </button>
                    </div>
                  </article>

                  <div className="uac-lado">
                    <div className="uac-nivelcard">
                      <div className="uac-xp">
                        <b>{totalXp}</b>
                        <span>
                          XP{nivelAtual ? ` · ${nivelAtual.trilha.titulo} · ${nivelAtual.feitas} de ${nivelAtual.total} aulas` : ""}
                        </span>
                      </div>
                      <div className="uac-trilho">
                        <span style={{ width: `${nivelAtual && nivelAtual.total ? Math.round((nivelAtual.feitas / nivelAtual.total) * 100) : 0}%` }} />
                      </div>
                      <p className="uac-apoio" style={{ marginTop: 0 }}>
                        Toda ação vale 20 XP: assistir, treinar ou fazer no CRM.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <div className="uac-vazio">
                <Homi pose={trilhas.length === 0 ? "dormindo" : "comemorando"} tamanho={90} />
                <b>{trilhas.length === 0 ? "Ainda não tem conteúdo publicado." : "Você fechou tudo que está no ar."}</b>
                <span>{trilhas.length === 0 ? "Assim que a primeira trilha for publicada, ela aparece aqui." : "Chega material novo toda semana."}</span>
              </div>
            )}

            {semana.length > 0 && (
              <section className="uac-secao">
                <p className="uac-rotulo">A sua semana · {semana.length === 1 ? "uma coisa" : `${semana.length} coisas`}</p>
                <div className="uac-semana">
                  {semana.map((a) => (
                    <SemanaItem
                      key={a.id}
                      aula={a}
                      feito={getAulaStatus(a.id) === "concluida"}
                      onClick={() => abrirAula(a.id, a.trilha_id)}
                    />
                  ))}
                </div>
                <p className="uac-apoio">Fechou as {semana.length === 1 ? "essa" : semana.length}, sua semana está feita.</p>
              </section>
            )}

            {niveis.length > 0 && (
              <section className="uac-secao">
                <p className="uac-rotulo">A sua jornada</p>
                <div className="uac-jornada">
                  {niveis.map((n) => (
                    <NivelCard
                      key={n.trilha.id}
                      ordem={n.ordem}
                      trilha={n.trilha}
                      feitas={n.feitas}
                      total={n.total}
                      estado={n.estado}
                      onClick={() => abrirTrilha(n.trilha.id)}
                    />
                  ))}
                </div>
                <p className="uac-apoio">
                  Os níveis são a formação da casa e todo mundo faz. <b>Nenhum deles fica trancado</b>:
                  se você precisa de uma aula de um nível adiante hoje, ela abre hoje.
                </p>
              </section>
            )}
          </>
        )}

        {/* ------------------------------------------------------------ TRILHA */}
        {aba === "trilha" && (
          <>
            <nav className="uac-seletor" aria-label="Níveis da jornada">
              {niveis.map((n) => (
                <button
                  key={n.trilha.id}
                  type="button"
                  className="uac-chip-nivel"
                  aria-current={n.trilha.id === trilhaExibida?.trilha.id}
                  data-estado={n.estado}
                  onClick={() => setTrilhaAberta(n.trilha.id)}
                >
                  <span className="n">{n.ordem}</span>
                  {n.trilha.titulo}
                  <span className="conta">{n.feitas}/{n.total}</span>
                </button>
              ))}
            </nav>

            {trilhaExibida && (
              <section className="uac-secao">
                <p className="uac-rotulo">{trilhaExibida.trilha.titulo}</p>
                <h2 className="uac-titulao">{trilhaExibida.trilha.descricao || "As aulas deste nível"}</h2>

                {aulasDoNivel.length > 0 ? (
                  <>
                    <FalaHomi pose="apontando" className="mb-4" >
                      Todas as {aulasDoNivel.length} estão abertas, você escolhe a ordem. E se já sabe alguma,{" "}
                      <b>pula a aula e faz a prova</b>, que conta igual.
                    </FalaHomi>
                    <div className="uac-aulas">
                      {aulasDoNivel.map((a) => {
                        const st = getAulaStatus(a.id);
                        const estado = st === "concluida" ? "feito" : st === "em_andamento" ? "agora" : "aberto";
                        return (
                          <AulaLinha
                            key={a.id}
                            aula={a}
                            estado={estado}
                            sugerida={a.id === aulaDeHoje?.id}
                            /* a prova só existe onde existe quiz de verdade */
                            temProva={estado !== "feito" && a.tipo === "quiz"}
                            onAbrir={() => abrirAula(a.id, a.trilha_id)}
                            onProva={() => abrirAula(a.id, a.trilha_id)}
                          />
                        );
                      })}
                    </div>
                    <p className="uac-apoio">
                      Toda ação vale 20 XP. O nível marca o seu progresso, <b>não tranca o conteúdo</b>.
                    </p>
                  </>
                ) : (
                  <div className="uac-vazio">
                    <Homi pose="pensando" tamanho={90} />
                    <b>Este nível ainda não tem aula publicada.</b>
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {/* ------------------------------------------------------------ GERENCIAR */}
        {aba === "gerenciar" && canManage && (
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
            <AcademiaGerenciarPage showHeader={false} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
