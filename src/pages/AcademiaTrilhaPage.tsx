/**
 * A aula, no formato de player de curso (tipo Hotmart): palco à esquerda,
 * conteúdo do módulo à direita, e o próximo passo sempre visível embaixo.
 *
 * Identidade da Academy (Montserrat, papel quente, Homi), a mesma do hub, para
 * a experiência não quebrar no meio do caminho.
 *
 * ATENÇÃO ao roteamento: o CRM monta as páginas pelo sistema de abas, FORA de
 * <Routes>, e a rota real é o curinga "/*". Por isso useParams() não entrega
 * :trilhaId aqui, e o id tem que sair da própria URL. Era esse o motivo de
 * nenhuma aula abrir ("Trilha não encontrada").
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useTabContext } from "@/contexts/TabContext";
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, Loader2, Award } from "lucide-react";
import { useAcademia, type Aula } from "@/hooks/useAcademia";
import { PalcoAula } from "@/components/academia/v2/players";
import { Homi, FalaHomi } from "@/components/academia/v2/Homi";
import { ICONE_TIPO, ROTULO_TIPO } from "@/components/academia/v2/pecas";
import { cn } from "@/lib/utils";
import "@/styles/academia.css";

export default function AcademiaTrilhaPage() {
  const { pathname, search } = useLocation();
  const trilhaId = decodeURIComponent(pathname.split("/academia/trilha/")[1]?.split("/")[0] || "");
  const { openTab } = useTabContext();
  const {
    trilhas, aulas, getTrilhaProgress, getAulaStatus, completeAula, startAula, certificados, loading,
  } = useAcademia();

  const trilha = trilhas.find((t) => t.id === trilhaId);
  const trilhaAulas = useMemo(
    () => aulas.filter((a) => a.trilha_id === trilhaId).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)),
    [aulas, trilhaId]
  );
  const progresso = trilhaId ? getTrilhaProgress(trilhaId) : null;
  const temCertificado = certificados.some((c) => c.trilha_id === trilhaId);

  const [aulaId, setAulaId] = useState<string | null>(null);

  useEffect(() => {
    if (trilhaAulas.length > 0 && !aulaId) {
      // a Academia abre uma aula específica com ?aula=<id>; sem isso, cai na próxima pendente
      const pedida = new URLSearchParams(search).get("aula");
      const alvo = pedida && trilhaAulas.some((a) => a.id === pedida) ? pedida : null;
      const proxima = trilhaAulas.find((a) => getAulaStatus(a.id) !== "concluida");
      setAulaId(alvo || proxima?.id || trilhaAulas[0].id);
    }
  }, [trilhaAulas, aulaId, getAulaStatus, search]);

  const aula = trilhaAulas.find((a) => a.id === aulaId) || null;
  const idx = trilhaAulas.findIndex((a) => a.id === aulaId);
  const anterior = idx > 0 ? trilhaAulas[idx - 1] : null;
  const proxima = idx >= 0 && idx < trilhaAulas.length - 1 ? trilhaAulas[idx + 1] : null;
  const status = aula ? getAulaStatus(aula.id) : "nao_iniciada";

  /* marca como iniciada assim que o corretor abre */
  useEffect(() => {
    if (aula && trilhaId && getAulaStatus(aula.id) === "nao_iniciada") startAula(aula.id, trilhaId);
  }, [aula, trilhaId, getAulaStatus, startAula]);

  const concluir = useCallback(
    async (nota?: number) => {
      if (!aula || !trilhaId) return;
      await completeAula(aula.id, trilhaId, nota);
      if (proxima) setAulaId(proxima.id);
    },
    [aula, trilhaId, completeAula, proxima]
  );

  const trocarAula = (id: string) => {
    setAulaId(id);
    document.querySelector(".uac-palco-area")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return (
      <div className="uac">
        <div className="uac-tela uac-esqueleto">
          <span className="bloco alto" />
          <span className="bloco" />
          <span className="bloco curto" />
        </div>
      </div>
    );
  }

  if (!trilha) {
    return (
      <div className="uac">
        <div className="uac-tela uac-vazio">
          <Homi pose="pensando" tamanho={90} />
          <b>Não encontrei esse módulo.</b>
          <span>Ele pode ter sido despublicado.</span>
          <button type="button" className="uac-bt" onClick={() => openTab("/academia")}>
            Voltar para a Academia
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="uac">
      <div className="uac-tela">
        {/* ------------------------------------------------------ cabeçalho */}
        <header className="uac-topo">
          <button type="button" className="uac-voltar" onClick={() => openTab("/academia")}>
            <ArrowLeft className="h-3.5 w-3.5" /> Academia
          </button>
          <div className="uac-topo-trilha">
            <b>{trilha.titulo}</b>
            <span>
              {progresso?.completed} de {progresso?.total} aulas
            </span>
          </div>
          <div className="uac-topo-progresso">
            <div className="uac-trilho">
              <span style={{ width: `${progresso?.percent || 0}%` }} />
            </div>
            <span className="uac-apoio" style={{ marginTop: 0 }}>{progresso?.percent || 0}%</span>
          </div>
        </header>

        <div className="uac-player">
          {/* ---------------------------------------------------- palco */}
          <main className="uac-palco-area">
            {aula ? (
              <>
                <p className="uac-rotulo">
                  Aula {idx + 1} de {trilhaAulas.length} · {ROTULO_TIPO[aula.tipo] || "Aula"}
                </p>
                <h1 className="uac-aula-titulo">{aula.titulo}</h1>
                {aula.descricao && <p className="uac-aula-desc">{aula.descricao}</p>}

                <PalcoAula aula={aula} status={status} onConcluir={concluir} />

                {/* barra do próximo passo: sempre visível, nunca deixa a aula sem saída */}
                <div className="uac-barra">
                  <button
                    type="button"
                    className="uac-bt claro"
                    disabled={!anterior}
                    onClick={() => anterior && trocarAula(anterior.id)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> anterior
                  </button>

                  {status === "concluida" ? (
                    <span className="uac-feita">
                      <CheckCircle2 className="h-4 w-4" /> aula concluída
                    </span>
                  ) : (
                    aula.tipo !== "quiz" &&
                    aula.tipo !== "checklist" && (
                      <button type="button" className="uac-bt" onClick={() => concluir()}>
                        Concluir e ganhar {aula.xp_recompensa || 20} XP
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    className="uac-bt claro"
                    disabled={!proxima}
                    onClick={() => proxima && trocarAula(proxima.id)}
                  >
                    próxima <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {progresso?.percent === 100 && (
                  <FalaHomi pose="comemorando" className="uac-fim-modulo">
                    Você fechou o módulo inteiro.{" "}
                    {temCertificado ? "Seu certificado já está na Academia." : "O certificado sai em instantes."}
                  </FalaHomi>
                )}
              </>
            ) : (
              <div className="uac-vazio">
                <Homi pose="dormindo" tamanho={90} />
                <b>Este módulo ainda não tem aula publicada.</b>
              </div>
            )}
          </main>

          {/* ---------------------------------------------------- conteúdo do módulo */}
          <aside className="uac-sumario" aria-label="Conteúdo do módulo">
            <p className="uac-rotulo">Conteúdo do módulo</p>
            <ol className="uac-lista-aulas">
              {trilhaAulas.map((a, n) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className={cn("uac-sumario-item", a.id === aulaId && "atual", getAulaStatus(a.id) === "concluida" && "feita")}
                    onClick={() => trocarAula(a.id)}
                    aria-current={a.id === aulaId}
                  >
                    <span className="uac-sumario-n">
                      {getAulaStatus(a.id) === "concluida" ? <CheckCircle2 className="h-3.5 w-3.5" /> : n + 1}
                    </span>
                    <span className="uac-sumario-txt">
                      <b>{a.titulo}</b>
                      <small>
                        {[ROTULO_TIPO[a.tipo] || "Aula", a.duracao_minutos ? `${a.duracao_minutos} min` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {temCertificado && (
              <p className="uac-certificado">
                <Award className="h-3.5 w-3.5" /> certificado emitido
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
