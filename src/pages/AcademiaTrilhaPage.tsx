import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAcademia, NIVEL_CONFIG, TIPO_CONFIG, CATEGORIAS, type Aula, type QuizQuestion } from "@/hooks/useAcademia";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Play, CheckCircle2, Lock, Clock, Star, Award, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Extract YouTube ID from URL
function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return match ? match[1] : null;
}

function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

// ─── AULA PLAYER ───
function AulaPlayer({ aula, status, onComplete, trilhaId }: {
  aula: Aula;
  status: "nao_iniciada" | "em_andamento" | "concluida";
  onComplete: (quizScore?: number) => void;
  trilhaId: string;
}) {
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Load quiz questions
  useEffect(() => {
    if (aula.tipo === "quiz") {
      supabase.from("academia_quiz").select("*").eq("aula_id", aula.id).order("ordem").then(({ data }) => {
        setQuizQuestions((data || []) as QuizQuestion[]);
        setCurrentQ(0); setAnswers({}); setShowResult(false); setSelectedAnswer(null); setShowFeedback(false);
      });
    }
  }, [aula.id, aula.tipo]);

  const conteudo = aula.conteudo as any;

  // YouTube / Vimeo
  const youtubeId = aula.youtube_id || (conteudo?.url ? extractYoutubeId(conteudo.url) : null);
  const vimeoId = conteudo?.url ? extractVimeoId(conteudo.url) : null;

  const handleQuizAnswer = (idx: number) => {
    setSelectedAnswer(idx);
    setShowFeedback(true);
    setAnswers(prev => ({ ...prev, [currentQ]: idx }));
  };

  const handleQuizNext = () => {
    setSelectedAnswer(null);
    setShowFeedback(false);
    if (currentQ < quizQuestions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      // Calculate score
      let correct = 0;
      quizQuestions.forEach((q, i) => {
        const opts = (q.opcoes as any)?.options || [];
        if (answers[i] !== undefined && opts[answers[i]]?.correct) correct++;
      });
      const score = Math.round((correct / quizQuestions.length) * 100);
      setShowResult(true);
      if (score >= 70) {
        onComplete(score);
      }
    }
  };

  const resetQuiz = () => {
    setCurrentQ(0); setAnswers({}); setShowResult(false); setSelectedAnswer(null); setShowFeedback(false);
  };

  return (
    <div className="space-y-4">
      {/* VIDEO (YouTube) */}
      {(aula.tipo === "youtube" || aula.tipo === "video") && youtubeId && (
        <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* VIDEO (Vimeo) */}
      {aula.tipo === "vimeo" && vimeoId && (
        <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}`}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* VIDEO (upload) */}
      {aula.tipo === "video_upload" && (conteudo?.storage_path || aula.conteudo_url) && (
        <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
          <video src={conteudo?.storage_path || aula.conteudo_url!} controls className="w-full h-full" />
        </div>
      )}

      {/* PDF */}
      {aula.tipo === "pdf" && (
        <div className="space-y-2">
          <div className="rounded-xl overflow-hidden border border-border" style={{ height: "65vh" }}>
            <iframe src={conteudo?.storage_path || aula.conteudo_url || ""} className="w-full h-full bg-white" />
          </div>
          {(conteudo?.storage_path || aula.conteudo_url) && (
            <a href={conteudo?.storage_path || aula.conteudo_url!} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download PDF
              </Button>
            </a>
          )}
        </div>
      )}

      {/* TEXTO */}
      {aula.tipo === "texto" && conteudo?.html && (
        <div
          className="prose prose-sm max-w-none dark:prose-invert rounded-xl border border-border p-6 bg-card"
          dangerouslySetInnerHTML={{ __html: conteudo.html }}
        />
      )}

      {/* QUIZ */}
      {aula.tipo === "quiz" && (
        <div className="rounded-xl border border-border bg-card p-6">
          {!showResult ? (
            quizQuestions.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-muted-foreground">Pergunta {currentQ + 1} de {quizQuestions.length}</span>
                  <Progress value={((currentQ + 1) / quizQuestions.length) * 100} className="w-32 h-1.5" />
                </div>
                <h3 className="text-foreground font-bold text-base mb-5">{quizQuestions[currentQ].pergunta}</h3>
                <div className="space-y-2.5">
                  {((quizQuestions[currentQ].opcoes as any)?.options || []).map((opt: any, i: number) => {
                    const isSelected = selectedAnswer === i;
                    const isCorrect = opt.correct;
                    let borderClass = "border-border hover:border-primary/50";
                    if (showFeedback && isSelected) {
                      borderClass = isCorrect ? "border-emerald-500 bg-emerald-500/10" : "border-red-500 bg-red-500/10";
                    } else if (showFeedback && isCorrect) {
                      borderClass = "border-emerald-500/50";
                    }
                    return (
                      <button
                        key={i}
                        onClick={() => !showFeedback && handleQuizAnswer(i)}
                        disabled={showFeedback}
                        className={cn("w-full text-left p-3.5 rounded-xl transition-all border text-sm", borderClass)}
                      >
                        <div className="flex items-center gap-2">
                          {showFeedback && isSelected && (isCorrect ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <span className="text-red-500 shrink-0">❌</span>)}
                          {showFeedback && !isSelected && isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-500/50 shrink-0" />}
                          <span className="text-foreground">{opt.text}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {showFeedback && quizQuestions[currentQ].explicacao && (
                  <div className="mt-3 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                    💡 {quizQuestions[currentQ].explicacao}
                  </div>
                )}
                <div className="flex justify-end mt-5">
                  <Button onClick={handleQuizNext} disabled={!showFeedback} className="gap-1.5">
                    {currentQ < quizQuestions.length - 1 ? "Próxima →" : "Finalizar Quiz"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhuma pergunta cadastrada para este quiz.</p>
            )
          ) : (
            <div className="text-center py-8">
              {(() => {
                let correct = 0;
                quizQuestions.forEach((q, i) => {
                  const opts = (q.opcoes as any)?.options || [];
                  if (answers[i] !== undefined && opts[answers[i]]?.correct) correct++;
                });
                const pct = quizQuestions.length > 0 ? Math.round((correct / quizQuestions.length) * 100) : 0;
                return (
                  <>
                    <div className="text-5xl mb-3">{pct >= 70 ? "🎉" : "😔"}</div>
                    <h3 className="text-foreground font-bold text-xl mb-2">{correct} de {quizQuestions.length} corretas!</h3>
                    <p className="text-muted-foreground mb-1">{pct}% de acerto</p>
                    <p className="text-sm mb-4">{pct >= 70 ? "✅ Quiz aprovado!" : "Mínimo 70% necessário. Tente novamente!"}</p>
                    {pct >= 100 && <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 mb-4">+50 XP Bônus! 🎯</Badge>}
                    {pct < 70 && <Button onClick={resetQuiz}>🔄 Tentar novamente</Button>}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Title + Meta */}
      <div>
        <h2 className="text-lg font-bold text-foreground">{aula.titulo}</h2>
        {aula.descricao && <p className="text-sm text-muted-foreground mt-1">{aula.descricao}</p>}
        <div className="flex items-center gap-2 mt-2">
          {aula.xp_recompensa && <Badge variant="outline" className="text-[10px]">+{aula.xp_recompensa} XP</Badge>}
          {aula.duracao_minutos && <Badge variant="outline" className="text-[10px]">{aula.duracao_minutos}min</Badge>}
        </div>
      </div>

      {/* Complete button */}
      {status !== "concluida" && aula.tipo !== "quiz" && (
        <Button onClick={() => onComplete()} className="w-full gap-1.5" size="lg">
          <CheckCircle2 className="h-4 w-4" /> ✅ Marcar como concluída
        </Button>
      )}
      {status === "concluida" && (
        <div className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/20 text-center">
          <span className="text-emerald-600 font-medium text-sm">✅ Aula concluída!</span>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ───
export default function AcademiaTrilhaPage() {
  const { trilhaId } = useParams<{ trilhaId: string }>();
  const navigate = useNavigate();
  const { trilhas, aulas, getTrilhaProgress, getAulaStatus, getTrilhaDuration, completeAula, startAula, certificados, loading } = useAcademia();

  const trilha = trilhas.find(t => t.id === trilhaId);
  const trilhaAulas = useMemo(() =>
    aulas.filter(a => a.trilha_id === trilhaId).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)),
    [aulas, trilhaId]
  );
  const progress = trilhaId ? getTrilhaProgress(trilhaId) : null;
  const duration = trilhaId ? getTrilhaDuration(trilhaId) : 0;
  const hasCertificate = certificados.some(c => c.trilha_id === trilhaId);
  const nivel = NIVEL_CONFIG[trilha?.nivel || "iniciante"];
  const cat = CATEGORIAS.find(c => c.key === trilha?.categoria);

  // Selected aula state
  const [selectedAulaId, setSelectedAulaId] = useState<string | null>(null);

  // Auto-select first incomplete aula
  useEffect(() => {
    if (trilhaAulas.length > 0 && !selectedAulaId) {
      const next = trilhaAulas.find(a => getAulaStatus(a.id) !== "concluida");
      setSelectedAulaId(next?.id || trilhaAulas[0].id);
    }
  }, [trilhaAulas, selectedAulaId, getAulaStatus]);

  const selectedAula = trilhaAulas.find(a => a.id === selectedAulaId);
  const selectedIdx = trilhaAulas.findIndex(a => a.id === selectedAulaId);
  const prevAula = selectedIdx > 0 ? trilhaAulas[selectedIdx - 1] : null;
  const nextAula = selectedIdx < trilhaAulas.length - 1 ? trilhaAulas[selectedIdx + 1] : null;

  // Mark as started when selecting
  useEffect(() => {
    if (selectedAula && trilhaId && getAulaStatus(selectedAula.id) === "nao_iniciada") {
      startAula(selectedAula.id, trilhaId);
    }
  }, [selectedAula, trilhaId, getAulaStatus, startAula]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!trilha) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-muted-foreground">Trilha não encontrada</p>
        <Button variant="outline" onClick={() => navigate("/academia")}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button onClick={() => navigate("/academia")} className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Academia
        </button>
        <span>›</span>
        <span className="text-foreground font-medium truncate">{trilha.titulo}</span>
      </div>

      {/* Header */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-black text-foreground">{trilha.titulo}</h1>
            {trilha.descricao && <p className="text-sm text-muted-foreground mt-1">{trilha.descricao}</p>}
          </div>
          {hasCertificate && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1 shrink-0"><Award className="h-3 w-3" /> Certificado</Badge>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {cat && <Badge className={cn("text-[10px] border", cat.color)}>{cat.label}</Badge>}
          {nivel && <Badge className={cn("text-[10px] border", nivel.color)}>{nivel.label}</Badge>}
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="h-3 w-3" />{duration}min</span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Star className="h-3 w-3" />{trilha.xp_total || 0} XP</span>
        </div>
        {progress && (
          <div className="flex items-center gap-3">
            <Progress value={progress.percent} className="flex-1 h-2" />
            <span className="text-xs font-bold text-primary">{progress.percent}%</span>
            <span className="text-[10px] text-muted-foreground">{progress.completed}/{progress.total}</span>
          </div>
        )}
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT: Aula list (35%) */}
        <div className="lg:col-span-4 space-y-1.5">
          <h3 className="text-xs font-bold text-muted-foreground px-1 mb-2">AULAS ({trilhaAulas.length})</h3>
          {trilhaAulas.map((aula, idx) => {
            const aulaStatus = getAulaStatus(aula.id);
            const isActive = selectedAulaId === aula.id;
            const tipoInfo = TIPO_CONFIG[aula.tipo] || TIPO_CONFIG.youtube;

            return (
              <button
                key={aula.id}
                onClick={() => setSelectedAulaId(aula.id)}
                className={cn(
                  "w-full text-left p-3 rounded-xl transition-all border flex items-center gap-3",
                  isActive ? "border-primary bg-primary/5 shadow-sm" : "border-border/50 bg-card hover:bg-accent/30"
                )}
              >
                {/* Number/Status */}
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                  aulaStatus === "concluida" ? "bg-emerald-500/15 text-emerald-600"
                    : isActive ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                )}>
                  {aulaStatus === "concluida" ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-medium truncate", isActive ? "text-foreground" : "text-foreground/80")}>
                    {aula.titulo}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{tipoInfo.emoji} {tipoInfo.label}</span>
                    {aula.duracao_minutos && <span className="text-[10px] text-muted-foreground">{aula.duracao_minutos}min</span>}
                  </div>
                </div>

                {aulaStatus === "concluida" && <span className="text-[10px] text-emerald-600">✅</span>}
              </button>
            );
          })}
        </div>

        {/* RIGHT: Player (65%) */}
        <div className="lg:col-span-8">
          {selectedAula ? (
            <div className="space-y-4">
              <AulaPlayer
                aula={selectedAula}
                status={getAulaStatus(selectedAula.id)}
                onComplete={(quizScore) => {
                  if (trilhaId) completeAula(selectedAula.id, trilhaId, quizScore);
                }}
                trilhaId={trilhaId!}
              />

              {/* Navigation */}
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                {prevAula ? (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedAulaId(prevAula.id)} className="gap-1 text-xs">
                    <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                  </Button>
                ) : <div />}
                {nextAula ? (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedAulaId(nextAula.id)} className="gap-1 text-xs">
                    Próxima <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                ) : <div />}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Selecione uma aula para começar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
