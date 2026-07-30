import { CATEGORIAS, TIPO_CONFIG, type Trilha, type Aula } from "@/hooks/useAcademia";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Edit, Eye, EyeOff, Trash2, ArrowUp, ArrowDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { AulaDropzone } from "./AulaDropzone";

interface Props {
  modulo: Trilha;
  index: number;
  aulas: Aula[];
  expanded: boolean;
  engagement?: { iniciaram: number; concluiram: number; mediaProgresso: number };
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublicar: () => void;
  onNovaAula: () => void;
  onEditAula: (a: Aula) => void;
  onDeleteAula: (a: Aula) => void;
  onMoveAula: (a: Aula, dir: -1 | 1) => void;
  onQuiz: (aulaId: string) => void;
  onCreateAula: (payload: any) => Promise<any>;
}

export function ModuloRow({
  modulo, index, aulas, expanded, engagement,
  onToggle, onEdit, onDelete, onTogglePublicar, onNovaAula,
  onEditAula, onDeleteAula, onMoveAula, onQuiz, onCreateAula,
}: Props) {
  const cat = CATEGORIAS.find(c => c.key === modulo.categoria);
  const totalMin = aulas.reduce((s, a) => s + (a.duracao_minutos || 0), 0);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Cabeçalho do módulo */}
      <div className="flex items-center gap-3 p-3">
        <button onClick={onToggle} className="text-muted-foreground hover:text-foreground shrink-0">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="w-8 h-11 rounded overflow-hidden bg-muted shrink-0 flex items-center justify-center">
          {modulo.thumbnail_url
            ? <img src={modulo.thumbnail_url} alt={`Capa do módulo ${modulo.titulo}`} className="h-full w-full object-cover" />
            : <span className="text-[9px] text-muted-foreground">{index + 1}</span>}
        </div>

        <button onClick={onToggle} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{modulo.titulo}</span>
            {cat && <Badge className={cn("text-[9px]", cat.color)}>{cat.label.split(" ")[0]}</Badge>}
            <Badge variant={modulo.publicada ? "secondary" : "destructive"} className="text-[9px]">
              {modulo.publicada ? "publicado" : "rascunho"}
            </Badge>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{aulas.length} aula{aulas.length === 1 ? "" : "s"} · {totalMin} min · {modulo.xp_total || 0} XP</span>
            {engagement && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {engagement.concluiram} concluíram · {engagement.mediaProgresso}% média
              </span>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onTogglePublicar} title={modulo.publicada ? "Despublicar" : "Publicar"}>
            {modulo.publicada ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onEdit} title="Editar módulo">
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={onDelete} title="Excluir módulo">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Aulas */}
      {expanded && (
        <div className="border-t border-border bg-muted/20 p-3 space-y-2">
          {aulas.map((a, idx) => {
            const tipo = TIPO_CONFIG[a.tipo] || TIPO_CONFIG.youtube;
            return (
              <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card">
                <span className="text-[11px] text-muted-foreground font-bold w-5 text-center">{idx + 1}</span>
                <div className="flex flex-col">
                  <button disabled={idx === 0} onClick={() => onMoveAula(a, -1)} className="text-muted-foreground disabled:opacity-25 hover:text-foreground" title="Subir">
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button disabled={idx === aulas.length - 1} onClick={() => onMoveAula(a, 1)} className="text-muted-foreground disabled:opacity-25 hover:text-foreground" title="Descer">
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm truncate">{a.titulo}</span>
                    <Badge variant="secondary" className="text-[9px]">{tipo.emoji} {tipo.label}</Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{a.duracao_minutos || 0} min · {a.xp_recompensa || 0} XP</span>
                </div>
                {a.tipo === "quiz" && (
                  <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => onQuiz(a.id)}>❓ Quiz</Button>
                )}
                <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => onEditAula(a)}>
                  <Edit className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-destructive" onClick={() => onDeleteAula(a)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}

          <AulaDropzone moduloId={modulo.id} ordemInicial={aulas.length + 1} onCreateAula={onCreateAula} />

          <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={onNovaAula}>
            + Aula de YouTube, PDF, texto ou quiz
          </Button>
        </div>
      )}
    </div>
  );
}
