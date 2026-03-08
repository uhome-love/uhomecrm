import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAcademia, NIVEL_CONFIG, TIPO_CONFIG, CATEGORIAS, type Aula, type QuizQuestion } from "@/hooks/useAcademia";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowLeft, Play, CheckCircle2, Lock, Clock, Star, Award, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return match ? match[1] : null;
}

function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

// ── AULA PLAYER (Checklist-style) ──
function AulaPlayer({ aula, status, onComplete, trilhaId, checklistState, onChecklistToggle }: {
  aula: Aula;
  status: "nao_iniciada" | "em_andamento" | "concluida";
  onComplete: (quizScore?: number) => void;
  trilhaId: string;
  checklistState: Record<string, boolean>;
  onChecklistToggle: (itemId: string) => void;
}) {
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [checklistItems, setChecklistItems] = useState<{ id: string; item: string; ordem: number }[]>([]);

  useEffect(() => {
    if (aula.tipo === "quiz") {
      supabase.from("academia_quiz").select("*").eq("aula_id", aula.id).order("ordem").then(({ data }) => {
        setQuizQuestions((data || []) as QuizQuestion[]);
        setCurrentQ(0); setAnswers({}); setShowResult(false); setSelectedAnswer(null); setShowFeedback(false);
      });
    }
    // Load checklist items
    supabase.from("academia_checklist").select("*").eq("aula_id", aula.id).order("ordem").then(({ data }) => {
      setChecklistItems((data || []) as any[]);
    });
  }, [aula.id, aula.tipo]);

  const conteudo = aula.conteudo as any;
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
      let correct = 0;
      quizQuestions.forEach((q, i) => {
        const opts = (q.opcoes as any)?.options || [];
        if (answers[i] !== undefined && opts[answers[i]]?.correct) correct++;
      });
      const score = Math.round((correct / quizQuestions.length) * 100);
      setShowResult(true);
      if (score >= 70) onComplete(score);
    }
  };

  const resetQuiz = () => {
    setCurrentQ(0); setAnswers({}); setShowResult(false); setSelectedAnswer(null); setShowFeedback(false);
  };

  const checkedCount = checklistItems.filter(ci => checklistState[ci.id]).length;
  const allChecked = checklistItems.length > 0 && checkedCount === checklistItems.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">{aula.titulo}</h2>
          {aula.descricao && <p className="text-sm text-muted-foreground mt-1">{aula.descricao}</p>}
        </div>
        <div className="flex items-center gap-2">
          {aula.xp_recompensa && <Badge variant="outline" className="text-[10px] gap-1"><Star className="h-3 w-3" /> +{aula.xp_recompensa} XP</Badge>}
        </div>
      </div>

      {/* Progress bar for checklist */}
      {checklistItems.length > 0 && (
        <div className="flex items-center gap-3">
          <Progress value={(checkedCount / checklistItems.length) * 100} className="flex-1 h-2" />
          <span className="text-xs text-muted-foreground font-medium">{checkedCount}/{checklistItems.length} itens</span>
        </div>
      )}

      {/* VIDEO */}
      {(aula.tipo === "youtube" || aula.tipo === "video") && youtubeId && (
        <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
          <iframe src={`https://www.youtube.com/embed/${youtubeId}`} className="absolute inset-0 w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      )}
      {aula.tipo === "vimeo" && vimeoId && (
        <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
          <iframe src={`https://player.vimeo.com/video/${vimeoId}`} className="absolute inset-0 w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      )}
      {aula.tipo === "video_upload" && (conteudo?.storage_path || aula.conteudo_url) && (
        <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
          <video src={conteudo?.storage_path || aula.conteudo_url!} controls className="w-full h-full" />
        </div>
      )}
      {aula.tipo === "pdf" && (
        <div className="space-y-2">
          <div className="rounded-xl overflow-hidden border border-border" style={{ height: "65vh" }}>
            <iframe src={conteudo?.storage_path || aula.conteudo_url || ""} className="w-full h-full bg-white" />
          </div>
          {(conteudo?.storage_path || aula.conteudo_url) && (
            <a href={conteudo?.storage_path || aula.conteudo_url!} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" /> Download PDF</Button>
            </a>
          )}
        </div>
      )}
      {aula.tipo === "texto" && conteudo?.html && (
        <div className="prose prose-sm max-w-none dark:prose-invert rounded-xl border border-border p-6 bg-card" dangerouslySetInnerHTML={{ __html: conteudo.html }} />
      )}

      {/* QUIZ */}
      {aula.tipo === "quiz" && (
        <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-6">
          {!showResult ? (
            quizQuestions.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">🧠 Pergunta {currentQ + 1} de {quizQuestions.length}</span>
                  <Progress value={((currentQ + 1) / quizQuestions.length) * 100} className="w-32 h-1.5" />
                </div>
                <h3 className="text-foreground font-bold text-base mb-5">{quizQuestions[currentQ].pergunta}</h3>
                <div className="space-y-2.5">
                  {((quizQuestions[currentQ].opcoes as any)?.options || []).map((opt: any, i: number) => {
                    const isSelected = selectedAnswer === i;
                    const isCorrect = opt.correct;
                    let borderClass = "border-border hover:border-primary/50";
                    if (showFeedback && isSelected) borderClass = isCorrect ? "border-emerald-500 bg-emerald-500/10" : "border-red-500 bg-red-500/10";
                    else if (showFeedback && isCorrect) borderClass = "border-emerald-500/50";
                    return (
                      <button key={i} onClick={() => !showFeedback && handleQuizAnswer(i)} disabled={showFeedback}
                        className={cn("w-full text-left p-3.5 rounded-xl transition-all border text-sm", borderClass)}>
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
                  <div className="mt-3 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">💡 {quizQuestions[currentQ].explicacao}</div>
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

      {/* CHECKLIST */}
      {checklistItems.length > 0 && (
        <div className="space-y-2">
          {checklistItems.map(ci => {
            const checked = !!checklistState[ci.id];
            return (
              <motion.label
                key={ci.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  checked ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card border-border/50 hover:border-primary/30"
                )}
                whileTap={{ scale: 0.98 }}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onChecklistToggle(ci.id)}
                  className={cn("transition-all", checked && "border-emerald-500 bg-emerald-500 text-white")}
                />
                <span className={cn("text-sm", checked ? "text-muted-foreground line-through" : "text-foreground")}>
                  {ci.item}
                </span>
              </motion.label>
            );
          })}
        </div>
      )}

      {/* Complete button */}
      {status !== "concluida" && aula.tipo !== "quiz" && (
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <Button onClick={() => onComplete()} className="w-full gap-1.5 h-12 text-base" size="lg">
            <CheckCircle2 className="h-5 w-5" /> ✅ Concluir Aula — Ganhar {aula.xp_recompensa || 10} XP
          </Button>
        </motion.div>
      )}
      {status === "concluida" && (
        <div className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/20 text-center">
          <span className="text-emerald-600 font-medium text-sm">✅ Aula concluída!</span>
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ──
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

  const [selectedAulaId, setSelectedAulaId] = useState<string | null>(null);
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    if (selectedAula && trilhaId && getAulaStatus(selectedAula.id) === "nao_iniciada") {
      startAula(selectedAula.id, trilhaId);
    }
  }, [selectedAula, trilhaId, getAulaStatus, startAula]);

  const handleChecklistToggle = (itemId: string) => {
    setChecklistState(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
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
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => navigate("/academia")} className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <span>│</span>
        <span className="text-foreground font-medium truncate">{trilha.titulo}</span>
      </div>

      {/* Header card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-black text-foreground">{trilha.titulo}</h1>
            {trilha.descricao && <p className="text-sm text-muted-foreground mt-1">{trilha.descricao}</p>}
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span>{trilhaAulas.length} aulas</span>
              <span>⭐ {trilha.xp_total || 0} XP</span>
              {nivel && <Badge className={cn("text-[10px] border", nivel.color)}>{nivel.label}</Badge>}
            </div>
          </div>
          {hasCertificate && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1 shrink-0"><Award className="h-3 w-3" /> Certificado</Badge>}
        </div>
        {progress && (
          <div className="flex items-center gap-3">
            <Progress value={progress.percent} className="flex-1 h-2.5" />
            <span className="text-sm font-bold text-primary">{progress.percent}%</span>
          </div>
        )}
      </motion.div>

      {/* ── JOURNEY PATH (aula list) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Journey timeline */}
        <div className="lg:col-span-4 space-y-0">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1 mb-3">Jornada de Aprendizado</h3>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-3 bottom-3 w-0.5 bg-border" />

            {trilhaAulas.map((aula, idx) => {
              const aulaStatus = getAulaStatus(aula.id);
              const isActive = selectedAulaId === aula.id;
              const isQuiz = aula.tipo === "quiz";

              return (
                <motion.button
                  key={aula.id}
                  onClick={() => setSelectedAulaId(aula.id)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={cn(
                    "w-full text-left relative flex items-start gap-3 py-3 px-2 rounded-lg transition-all",
                    isActive ? "bg-primary/5" : "hover:bg-accent/30",
                    aulaStatus === "concluida" ? "" : aulaStatus !== "nao_iniciada" ? "" : "opacity-70"
                  )}
                >
                  {/* Node */}
                  <div className={cn(
                    "relative z-10 h-10 w-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-all",
                    aulaStatus === "concluida"
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : isActive
                      ? "bg-blue-500 border-blue-500 text-white animate-pulse"
                      : isQuiz
                      ? "bg-amber-100 border-amber-400 text-amber-600"
                      : "bg-muted border-border text-muted-foreground"
                  )}>
                    {aulaStatus === "concluida" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : isActive ? (
                      <Play className="h-4 w-4 ml-0.5" />
                    ) : isQuiz ? (
                      <span className="text-sm">🧠</span>
                    ) : (
                      <Lock className="h-3.5 w-3.5" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-1">
                    <p className={cn(
                      "text-sm truncate",
                      aulaStatus === "concluida" ? "text-muted-foreground" :
                      isActive ? "text-foreground font-bold" : "text-muted-foreground"
                    )}>
                      {isQuiz ? "🧠 " : ""}{aula.titulo}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{aula.xp_recompensa || 10} XP</span>
                      {aulaStatus === "concluida" && <span className="text-[10px] text-emerald-600">✓</span>}
                      {isActive && aulaStatus !== "concluida" && (
                        <span className="text-[10px] font-semibold text-blue-500">→ Atual</span>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Right: Player */}
        <div className="lg:col-span-8">
          {selectedAula ? (
            <motion.div
              key={selectedAula.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border bg-card p-5 space-y-4"
            >
              <AulaPlayer
                aula={selectedAula}
                status={getAulaStatus(selectedAula.id)}
                onComplete={(quizScore) => {
                  if (trilhaId) completeAula(selectedAula.id, trilhaId, quizScore);
                }}
                trilhaId={trilhaId!}
                checklistState={checklistState}
                onChecklistToggle={handleChecklistToggle}
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
            </motion.div>
          ) : (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm rounded-xl border bg-card">
              Selecione uma aula para começar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
