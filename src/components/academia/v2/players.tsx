/**
 * Os palcos da aula, na identidade da Academy.
 * Um por tipo de conteúdo. Todos recebem a aula e avisam quando ela terminou.
 *
 * O tipo `apresentacao` é o que destrava os treinos que a gente já produziu:
 * o deck é um HTML de arquivo único e roda dentro de um palco 16:9 com botão
 * de tela cheia, como player de curso.
 */
import { useEffect, useRef, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import ReactMarkdown from "react-markdown";
import { Loader2, Maximize2, Download, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { readMediaRef, signMedia } from "@/lib/academiaMedia";
import type { Aula, QuizQuestion } from "@/hooks/useAcademia";
import { Homi } from "./Homi";

type Status = "nao_iniciada" | "em_andamento" | "concluida";

function idYoutube(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
function idVimeo(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

/* ---------------------------------------------------------------- palco 16:9 */
function Palco({ children, cheia }: { children: React.ReactNode; cheia?: () => void }) {
  return (
    <div className="uac-palco">
      {children}
      {cheia && (
        <button type="button" className="uac-cheia" onClick={cheia} title="Tela cheia">
          <Maximize2 className="h-4 w-4" /> tela cheia
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- apresentação */
function Apresentacao({ url }: { url: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  return (
    <div ref={caixa} className="uac-palco-wrap">
      <Palco cheia={() => caixa.current?.requestFullscreen?.()}>
        <iframe
          src={url}
          title="Apresentação"
          className="uac-quadro"
          allow="fullscreen"
          loading="lazy"
        />
      </Palco>
    </div>
  );
}

/* ---------------------------------------------------------------- quiz */
function Quiz({ aula, status, onConcluir }: { aula: Aula; status: Status; onConcluir: (nota: number) => void }) {
  const [perguntas, setPerguntas] = useState<QuizQuestion[]>([]);
  const [i, setI] = useState(0);
  const [escolha, setEscolha] = useState<number | null>(null);
  const [confirmada, setConfirmada] = useState(false);
  const [acertos, setAcertos] = useState(0);
  const [fim, setFim] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.from("academia_quiz").select("*").eq("aula_id", aula.id).order("ordem");
      let lista = (data || []) as QuizQuestion[];
      if (lista.length === 0) {
        const alt = await supabase.from("academia_quiz_perguntas").select("*").eq("aula_id", aula.id).order("ordem");
        lista = (alt.data || []) as QuizQuestion[];
      }
      if (vivo) { setPerguntas(lista); setCarregando(false); }
    })();
    return () => { vivo = false; };
  }, [aula.id]);

  if (carregando) return <div className="uac-carregando"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (perguntas.length === 0) {
    return <p className="uac-apoio">Este quiz ainda não tem pergunta cadastrada.</p>;
  }

  const q = perguntas[i];
  const opcoes: { texto: string; correta: boolean }[] = Array.isArray(q.opcoes) ? q.opcoes : [];

  if (fim) {
    const nota = Math.round((acertos / perguntas.length) * 100);
    const gabaritou = acertos === perguntas.length;
    return (
      <div className="uac-quiz-fim">
        <Homi pose={gabaritou ? "comemorando" : "pensando"} tamanho={80} pula={gabaritou} />
        <b>{acertos} de {perguntas.length} certas.</b>
        <p>{gabaritou ? "Gabaritou. A aula está fechada." : "Vale refazer: você só leva o XP acertando tudo."}</p>
        <div className="uac-acoes">
          {status !== "concluida" && gabaritou && (
            <button type="button" className="uac-bt" onClick={() => onConcluir(nota)}>
              Concluir e ganhar {aula.xp_recompensa || 20} XP
            </button>
          )}
          <button
            type="button"
            className="uac-bt claro"
            onClick={() => { setI(0); setAcertos(0); setEscolha(null); setConfirmada(false); setFim(false); }}
          >
            Refazer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="uac-quiz">
      <p className="uac-apoio" style={{ marginTop: 0 }}>PERGUNTA {i + 1} DE {perguntas.length}</p>
      <h3 className="uac-quiz-p">{q.pergunta}</h3>
      <div className="uac-escolhas">
        {opcoes.map((o, n) => {
          const marcada = escolha === n;
          const classe = !confirmada ? (marcada ? "marcada" : "") : o.correta ? "certa" : marcada ? "errada" : "";
          return (
            <button
              key={n}
              type="button"
              className={`uac-escolha ${classe}`}
              disabled={confirmada}
              onClick={() => setEscolha(n)}
            >
              {o.texto}
            </button>
          );
        })}
      </div>

      {confirmada && (
        <div className={`uac-nota ${opcoes[escolha!]?.correta ? "ok" : "nao"}`}>
          <Homi pose={opcoes[escolha!]?.correta ? "aprovando" : "pensando"} tamanho={34} />
          <span>{q.explicacao || (opcoes[escolha!]?.correta ? "Isso mesmo." : "Não é essa. Veja a resposta certa acima.")}</span>
        </div>
      )}

      <div className="uac-acoes">
        {!confirmada ? (
          <button
            type="button"
            className="uac-bt"
            disabled={escolha === null}
            onClick={() => { setConfirmada(true); if (opcoes[escolha!]?.correta) setAcertos((a) => a + 1); }}
          >
            Responder
          </button>
        ) : (
          <button
            type="button"
            className="uac-bt"
            onClick={() => {
              if (i + 1 >= perguntas.length) setFim(true);
              else { setI(i + 1); setEscolha(null); setConfirmada(false); }
            }}
          >
            {i + 1 >= perguntas.length ? "Ver resultado" : "Próxima"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- checklist */
function Checklist({ aula, status, onConcluir }: { aula: Aula; status: Status; onConcluir: () => void }) {
  const conteudo = aula.conteudo as any;
  const itens: { id: string; texto: string }[] = conteudo?.items || [];
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const feitos = itens.filter((it) => marcados[it.id]).length;
  const tudo = itens.length > 0 && feitos === itens.length;

  return (
    <div className="uac-checklist">
      {conteudo?.instrucoes && <p className="uac-instrucoes">{conteudo.instrucoes}</p>}
      {itens.map((it) => (
        <label key={it.id} className={`uac-item ${marcados[it.id] ? "ok" : ""}`}>
          <input
            type="checkbox"
            checked={!!marcados[it.id]}
            onChange={() => setMarcados((m) => ({ ...m, [it.id]: !m[it.id] }))}
          />
          <span className="uac-cx"><CheckCircle2 className="h-3.5 w-3.5" /></span>
          <span>{it.texto}</span>
        </label>
      ))}
      <div className="uac-acoes">
        <span className="uac-apoio" style={{ marginTop: 0 }}>{feitos} de {itens.length}</span>
        {status !== "concluida" && (
          <button type="button" className="uac-bt" disabled={!tudo} onClick={onConcluir}>
            Concluir e ganhar {aula.xp_recompensa || 20} XP
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- o palco certo */
export function PalcoAula({
  aula,
  status,
  onConcluir,
}: {
  aula: Aula;
  status: Status;
  onConcluir: (nota?: number) => void;
}) {
  const conteudo = (aula.conteudo || {}) as any;
  const [midia, setMidia] = useState<string | null>(null);
  const ref = readMediaRef(conteudo, aula.conteudo_url);
  const precisaAssinar = aula.tipo === "pdf" || aula.tipo === "video_upload";

  useEffect(() => {
    let vivo = true;
    if (!precisaAssinar) return;
    signMedia(ref).then((u) => { if (vivo) setMidia(u); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aula.id]);

  const urlVideo = conteudo?.url || aula.conteudo_url || "";

  /* apresentação: o deck do treino, em palco de curso */
  if (aula.tipo === "apresentacao") {
    const url = conteudo?.url || aula.conteudo_url;
    if (!url) return <p className="uac-apoio">Esta apresentação ainda não tem arquivo.</p>;
    return <Apresentacao url={url} />;
  }

  if ((aula.tipo === "youtube" || aula.tipo === "video") && idYoutube(urlVideo)) {
    return (
      <Palco>
        <iframe
          className="uac-quadro"
          src={`https://www.youtube.com/embed/${idYoutube(urlVideo)}`}
          title={aula.titulo}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </Palco>
    );
  }

  if (aula.tipo === "vimeo" && idVimeo(urlVideo)) {
    return (
      <Palco>
        <iframe
          className="uac-quadro"
          src={`https://player.vimeo.com/video/${idVimeo(urlVideo)}`}
          title={aula.titulo}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </Palco>
    );
  }

  if (aula.tipo === "video_upload") {
    return (
      <Palco>
        {midia ? <video src={midia} controls className="uac-quadro" /> : <div className="uac-carregando"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      </Palco>
    );
  }

  if (aula.tipo === "pdf") {
    return (
      <>
        <Palco>
          {midia ? <iframe src={midia} title={aula.titulo} className="uac-quadro branco" /> : <div className="uac-carregando"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        </Palco>
        {midia && (
          <a className="uac-bt claro uac-baixar" href={midia} target="_blank" rel="noopener noreferrer">
            <Download className="h-3.5 w-3.5" /> baixar o PDF
          </a>
        )}
      </>
    );
  }

  if (aula.tipo === "quiz") return <Quiz aula={aula} status={status} onConcluir={(n) => onConcluir(n)} />;
  if (aula.tipo === "checklist") return <Checklist aula={aula} status={status} onConcluir={() => onConcluir()} />;

  /* texto e o resto */
  return (
    <div className="uac-texto">
      {conteudo?.html && <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(conteudo.html) }} />}
      {conteudo?.markdown && <ReactMarkdown>{conteudo.markdown}</ReactMarkdown>}
      {!conteudo?.html && !conteudo?.markdown && <p className="uac-apoio">Esta aula ainda não tem conteúdo.</p>}
    </div>
  );
}
