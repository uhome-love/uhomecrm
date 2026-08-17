/**
 * As peças da Academia nova: nível da jornada, linha de aula, item da semana.
 * Visual definido no mockup aprovado (mockup-academia.html).
 */
import { FileText, MessageSquare, Target, CheckSquare, Play, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Aula, Trilha } from "@/hooks/useAcademia";

/* ---------------------------------------------------------------- tipos de aula */
export const ICONE_TIPO: Record<string, React.ComponentType<{ className?: string }>> = {
  apresentacao: FileText,
  pdf: FileText,
  texto: BookOpen,
  simulador: MessageSquare,
  quiz: Target,
  checklist: CheckSquare,
  youtube: Play,
  vimeo: Play,
  video: Play,
  video_upload: Play,
};

export const ROTULO_TIPO: Record<string, string> = {
  apresentacao: "Apresentação",
  pdf: "Apresentação",
  texto: "Leitura",
  simulador: "Simulador",
  quiz: "Quiz",
  checklist: "Faça no CRM",
  youtube: "Vídeo",
  vimeo: "Vídeo",
  video: "Vídeo",
  video_upload: "Vídeo",
};

export type EstadoNivel = "feito" | "agora" | "adiante";

/* ---------------------------------------------------------------- nível */
interface NivelProps {
  ordem: number;
  trilha: Trilha;
  feitas: number;
  total: number;
  estado: EstadoNivel;
  onClick: () => void;
}

const TAG: Record<EstadoNivel, string> = {
  feito: "concluído",
  agora: "você está aqui",
  // nada fica trancado: o nível marca o progresso, não bloqueia o conteúdo.
  // rótulo curto de propósito: em duas palavras ele não quebra a linha do card.
  adiante: "mais adiante",
};

export function NivelCard({ ordem, trilha, feitas, total, estado, onClick }: NivelProps) {
  const pct = total > 0 ? Math.round((feitas / total) * 100) : 0;
  return (
    <button type="button" className={cn("uac-nivel", estado)} onClick={onClick}>
      <span className="uac-nivel-n">{ordem}</span>
      <span className="uac-nivel-txt">
        <b>{trilha.titulo}</b>
        {trilha.descricao && <small>{trilha.descricao}</small>}
        <span className="uac-trilho">
          <span style={{ width: `${pct}%` }} />
        </span>
        <span className="uac-nivel-conta">
          {total > 0 ? `${feitas} de ${total} aulas` : "sem aulas ainda"}
        </span>
      </span>
      <span className="uac-nivel-tag">{TAG[estado]}</span>
    </button>
  );
}

/* ---------------------------------------------------------------- aula */
interface AulaProps {
  aula: Aula;
  estado: "feito" | "agora" | "aberto";
  sugerida?: boolean;
  /** só aparece quando a aula tem prova de verdade */
  temProva?: boolean;
  onAbrir: () => void;
  onProva?: () => void;
}

export function AulaLinha({ aula, estado, sugerida, temProva, onAbrir, onProva }: AulaProps) {
  const Icone = ICONE_TIPO[aula.tipo] || BookOpen;
  const rotulo = ROTULO_TIPO[aula.tipo] || "Aula";
  const dur = aula.duracao_minutos ? `${aula.duracao_minutos} min` : null;

  return (
    <div className={cn("uac-aula", estado)}>
      <button type="button" className="uac-aula-abrir" onClick={onAbrir}>
        <span className="uac-aula-ic">
          <Icone className="h-4 w-4" />
        </span>
        <span className="uac-aula-txt">
          <b>
            {aula.titulo}
            {sugerida && <span className="uac-sugerida">sugerida pelo Homi</span>}
          </b>
          <small>{[rotulo, dur].filter(Boolean).join(" · ")}</small>
        </span>
        {!temProva && <span />}
        <span className="uac-aula-xp">+{aula.xp_recompensa || 20} XP</span>
        <span className="uac-aula-estado">
          {estado === "feito" ? "✓" : estado === "agora" ? "continuar" : "começar"}
        </span>
      </button>
      {temProva && (
        <button
          type="button"
          className="uac-aula-prova"
          onClick={(e) => {
            e.stopPropagation();
            onProva?.();
          }}
        >
          já sei · ir pra prova
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- a semana */
interface SemanaProps {
  aula: Aula;
  feito: boolean;
  onClick: () => void;
}

export function SemanaItem({ aula, feito, onClick }: SemanaProps) {
  const Icone = ICONE_TIPO[aula.tipo] || BookOpen;
  const verbo =
    aula.tipo === "simulador" ? "Treinar" :
    aula.tipo === "quiz" ? "Responder" : "Assistir";

  return (
    <button type="button" className={cn("uac-semana-item", feito ? "feito" : "agora")} onClick={onClick}>
      <span className="uac-semana-ic">
        <Icone className="h-4 w-4" />
      </span>
      <span>
        <b>{verbo}: {aula.titulo}</b>
        <small>{aula.duracao_minutos ? `${aula.duracao_minutos} minutos` : ROTULO_TIPO[aula.tipo] || "aula"}</small>
      </span>
      <span className="uac-semana-tag">{feito ? "feito" : "começar"}</span>
    </button>
  );
}
