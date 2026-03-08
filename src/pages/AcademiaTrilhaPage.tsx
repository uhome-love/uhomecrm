import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAcademia, NIVEL_CONFIG, TIPO_CONFIG, type Aula, type QuizQuestion } from "@/hooks/useAcademia";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowLeft, Play, CheckCircle2, Lock, Star, Award, ChevronLeft, ChevronRight, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

// ── Helper: type icon for timeline ──
function getAulaTypeIcon(tipo: string): string {
  switch (tipo) {
    case "checklist": return "☑️";
    case "quiz": return "🧠";
    case "pdf": return "📄";
    default: return "▶️";
  }
}

// ── CHECKLIST PLAYER ──
function ChecklistPlayer({ aula, status, onComplete, checklistState, onChecklistToggle }: {
  aula: Aula;
  status: "nao_iniciada" | "em_andamento" | "concluida";
  onComplete: () => void;
  checklistState: Record<string, boolean>;
  onChecklistToggle: (itemId: string) => void;
}) {
  const conteudo = aula.conteudo as any;
  const instrucoes = conteudo?.instrucoes || "";
  const items: { id: string; texto: string }[] = conteudo?.items || [];

  const checkedCount = items.filter(it => checklistState[it.id]).length;
  const allChecked = items.length > 0 && checkedCount === items.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <h2 className="text-lg font-bold text-foreground">{aula.titulo}</h2>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {aula.xp_recompensa && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Star className="h-3 w-3" /> {aula.xp_recompensa} XP
              </Badge>
            )}
            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">☑️ Checklist</Badge>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <Progress value={(checkedCount / items.length) * 100} className="flex-1 h-2.5" />
          <span className="text-xs text-muted-foreground font-semibold">{checkedCount}/{items.length} itens</span>
        </div>
      )}

      {/* Instructions */}
      {instrucoes && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
          <span className="text-base mt-0.5">💡</span>
          <p className="text-sm text-muted-foreground italic">{instrucoes}</p>
        </div>
      )}

      {/* Checklist items */}
      <div className="space-y-0">
        {items.map((item, idx) => {
          const checked = !!checklistState[item.id];
          return (
            <motion.label
              key={item.id}
              className={cn(
                "flex items-center gap-3 py-3 cursor-pointer transition-all",
                idx < items.length - 1 && "border-b border-border/30"
              )}
              whileTap={{ scale: 0.98 }}
            >
              <motion.div
                animate={checked ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => { e.preventDefault(); onChecklistToggle(item.id); }}
                className={cn(
                  "h-6 w-6 rounded border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer",
                  checked
                    ? "bg-emerald-500 border-emerald-500"
                    : "border-muted-foreground/30 hover:border-blue-400"
                )}
              >
                {checked && (
                  <motion.svg
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="h-4 w-4 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </motion.svg>
                )}
              </motion.div>
              <motion.span
                animate={checked ? { x: [0, 2, 0] } : {}}
                transition={{ duration: 0.15 }}
                className={cn(
                  "text-base leading-relaxed transition-colors",
                  checked ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {item.texto}
              </motion.span>
            </motion.label>
          );
        })}
      </div>

      {/* Complete button */}
      {status !== "concluida" && (
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <Button
            onClick={onComplete}
            disabled={!allChecked}
            className={cn(
              "w-full gap-1.5 h-12 text-base transition-all",
              allChecked ? "bg-emerald-600 hover:bg-emerald-700" : "opacity-60"
            )}
            size="lg"
          >
            <CheckCircle2 className="h-5 w-5" /> Concluir Aula — Ganhar {aula.xp_recompensa || 10} XP
          </Button>
          {!allChecked && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Complete todos os itens para liberar a conclusão
            </p>
          )}
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

// ── QUIZ PLAYER ──
function QuizPlayer({ aula, status, onComplete }: {
  aula: Aula;
  status: "nao_iniciada" | "em_andamento" | "concluida";
  onComplete: (quizScore: number) => void;
}) {
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    // Try academia_quiz first, fallback to academia_quiz_perguntas
    supabase.from("academia_quiz").select("*").eq("aula_id", aula.id).order("ordem").then(({ data }) => {
      if (data && data.length > 0) {
        setQuizQuestions((data || []) as QuizQuestion[]);
        setCurrentQ(0); setAnswers({}); setShowResult(false); setSelectedAnswer(null); setConfirmed(false);
      } else {
        // Fallback: academia_quiz_perguntas (opcao_a/b/c/d format)
        supabase.from("academia_quiz_perguntas").select("*").eq("aula_id", aula.id).order("ordem").then(({ data: pergData }) => {
          const mapped: QuizQuestion[] = (pergData || []).map((p: any) => ({
            id: p.id,
            aula_id: p.aula_id,
            pergunta: p.pergunta,
            explicacao: p.explicacao,
            ordem: p.ordem,
            opcoes: [
              { texto: p.opcao_a, correta: p.resposta_correta === "a" },
              { texto: p.opcao_b, correta: p.resposta_correta === "b" },
              { texto: p.opcao_c, correta: p.resposta_correta === "c" },
              { texto: p.opcao_d, correta: p.resposta_correta === "d" },
            ],
          }));
          setQuizQuestions(mapped);
          setCurrentQ(0); setAnswers({}); setShowResult(false); setSelectedAnswer(null); setConfirmed(false);
        });
      }
    });
  }, [aula.id]);

  // Parse opcoes — support both formats: array or { options: [] }
  const getOptions = (q: QuizQuestion): { texto: string; correta: boolean }[] => {
    const raw = q.opcoes as any;
    if (Array.isArray(raw)) {
      // Format: [{ texto, correta }]
      return raw.map((o: any) => ({ texto: o.texto || o.text || "", correta: !!o.correta || !!o.correct }));
    }
    if (raw?.options && Array.isArray(raw.options)) {
      // Format: { options: [{ text, correct }] }
      return raw.options.map((o: any) => ({ texto: o.text || o.texto || "", correta: !!o.correct || !!o.correta }));
    }
    return [];
  };

  const handleSelect = (idx: number) => {
    if (confirmed) return;
    setSelectedAnswer(idx);
  };

  const handleConfirm = () => {
    if (selectedAnswer === null) return;
    setConfirmed(true);
    setAnswers(prev => ({ ...prev, [currentQ]: selectedAnswer }));
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setConfirmed(false);
    if (currentQ < quizQuestions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      // Calculate score
      let correct = 0;
      const finalAnswers = { ...answers, [currentQ]: selectedAnswer! };
      quizQuestions.forEach((q, i) => {
        const opts = getOptions(q);
        if (finalAnswers[i] !== undefined && opts[finalAnswers[i]]?.correta) correct++;
      });
      const score = Math.round((correct / quizQuestions.length) * 100);
      setShowResult(true);
      if (score >= 70) onComplete(score);
    }
  };

  const resetQuiz = () => {
    setCurrentQ(0); setAnswers({}); setShowResult(false); setSelectedAnswer(null); setConfirmed(false);
  };

  if (quizQuestions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧠</span>
          <h2 className="text-lg font-bold text-foreground">{aula.titulo}</h2>
        </div>
        <p className="text-muted-foreground text-sm text-center py-8">Nenhuma pergunta cadastrada para este quiz.</p>
      </div>
    );
  }

  const currentOptions = getOptions(quizQuestions[currentQ]);
  const correctIdx = currentOptions.findIndex(o => o.correta);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🧠</span>
            <h2 className="text-lg font-bold text-foreground">{aula.titulo}</h2>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {aula.xp_recompensa && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Star className="h-3 w-3" /> {aula.xp_recompensa} XP
              </Badge>
            )}
            <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30 text-[10px]">🧠 Quiz</Badge>
            <span className="text-xs text-muted-foreground">Mínimo 70% para aprovação</span>
          </div>
        </div>
      </div>

      {!showResult ? (
        <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-6 space-y-5">
          {/* Progress */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Pergunta {currentQ + 1} de {quizQuestions.length}
            </span>
            <Progress value={((currentQ + 1) / quizQuestions.length) * 100} className="w-32 h-1.5" />
          </div>

          {/* Question */}
          <h3 className="text-foreground font-bold text-base">{quizQuestions[currentQ].pergunta}</h3>

          {/* Options */}
          <div className="space-y-2.5">
            {currentOptions.map((opt, i) => {
              const isSelected = selectedAnswer === i;
              const isCorrect = opt.correta;

              let cardStyle = "bg-card border-border hover:border-blue-400/50";
              if (!confirmed && isSelected) {
                cardStyle = "bg-blue-500/5 border-blue-500 border-2";
              }
              if (confirmed && isSelected && isCorrect) {
                cardStyle = "bg-emerald-500/10 border-emerald-500 border-2";
              }
              if (confirmed && isSelected && !isCorrect) {
                cardStyle = "bg-red-500/10 border-red-500 border-2";
              }
              if (confirmed && !isSelected && isCorrect) {
                cardStyle = "bg-emerald-500/5 border-emerald-500/50 border-2";
              }

              return (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={confirmed}
                  className={cn(
                    "w-full text-left p-4 rounded-xl transition-all border text-sm",
                    cardStyle
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Radio indicator */}
                    <div className={cn(
                      "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      !confirmed && isSelected ? "border-blue-500" :
                      confirmed && isCorrect ? "border-emerald-500 bg-emerald-500" :
                      confirmed && isSelected && !isCorrect ? "border-red-500 bg-red-500" :
                      "border-muted-foreground/30"
                    )}>
                      {!confirmed && isSelected && (
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      )}
                      {confirmed && (isCorrect || (isSelected && !isCorrect)) && (
                        <span className="text-white text-[10px] font-bold">
                          {isCorrect ? "✓" : "✕"}
                        </span>
                      )}
                    </div>
                    <span className="text-foreground">{opt.texto}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Confirm / Feedback */}
          {!confirmed && selectedAnswer !== null && (
            <div className="flex justify-end">
              <Button onClick={handleConfirm} className="gap-1.5">
                Confirmar Resposta
              </Button>
            </div>
          )}

          {confirmed && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {/* Feedback */}
                <div className={cn(
                  "p-3 rounded-lg text-sm font-medium",
                  currentOptions[selectedAnswer!]?.correta
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-red-500/10 text-red-700"
                )}>
                  {currentOptions[selectedAnswer!]?.correta
                    ? "✅ Correto! 🎉"
                    : "❌ Incorreto"}
                </div>

                {/* Explanation */}
                {quizQuestions[currentQ].explicacao && (
                  <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                    💡 {quizQuestions[currentQ].explicacao}
                  </div>
                )}

                {/* Next */}
                <div className="flex justify-end">
                  <Button onClick={handleNext} className="gap-1.5">
                    {currentQ < quizQuestions.length - 1 ? "Próxima Pergunta →" : "Ver Resultado"}
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      ) : (
        /* Result screen */
        <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-6">
          <div className="text-center py-6">
            {(() => {
              let correct = 0;
              quizQuestions.forEach((q, i) => {
                const opts = getOptions(q);
                if (answers[i] !== undefined && opts[answers[i]]?.correta) correct++;
              });
              const pct = Math.round((correct / quizQuestions.length) * 100);
              return (
                <>
                  <div className="text-5xl mb-3">{pct >= 70 ? "🎉" : "😔"}</div>
                  <h3 className="text-foreground font-bold text-xl mb-2">
                    {correct} de {quizQuestions.length} corretas!
                  </h3>
                  <p className="text-muted-foreground mb-1">{pct}% de acerto</p>
                  <p className="text-sm mb-4">
                    {pct >= 70
                      ? "✅ Parabéns! Você passou!"
                      : "Quase lá! Mínimo 70% necessário. Tente novamente!"}
                  </p>
                  {pct === 100 && (
                    <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 mb-4">
                      +50 XP Bônus! 🎯
                    </Badge>
                  )}
                  {pct < 70 && (
                    <Button onClick={resetQuiz} className="gap-1.5">
                      🔄 Refazer Quiz
                    </Button>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {status === "concluida" && (
        <div className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/20 text-center">
          <span className="text-emerald-600 font-medium text-sm">✅ Quiz concluído!</span>
        </div>
      )}
    </div>
  );
}

// ── VIDEO/PDF/TEXT PLAYER ──
function MediaPlayer({ aula, status, onComplete }: {
  aula: Aula;
  status: "nao_iniciada" | "em_andamento" | "concluida";
  onComplete: () => void;
}) {
  const conteudo = aula.conteudo as any;
  const youtubeId = aula.youtube_id || (conteudo?.url ? extractYoutubeId(conteudo.url) : null);
  const vimeoId = conteudo?.url ? extractVimeoId(conteudo.url) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">{aula.titulo}</h2>
          {aula.descricao && <p className="text-sm text-muted-foreground mt-1">{aula.descricao}</p>}
        </div>
        <div className="flex items-center gap-2">
          {aula.xp_recompensa && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Star className="h-3 w-3" /> +{aula.xp_recompensa} XP
            </Badge>
          )}
        </div>
      </div>

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

      {/* Markdown content from conteudo.markdown */}
      {conteudo?.markdown && (
        <div className="prose prose-sm max-w-none dark:prose-invert rounded-xl border border-border p-6 bg-card">
          <ReactMarkdown>{conteudo.markdown}</ReactMarkdown>
        </div>
      )}

      {status !== "concluida" && (
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <Button onClick={onComplete} className="w-full gap-1.5 h-12 text-base" size="lg">
            <CheckCircle2 className="h-5 w-5" /> Concluir Aula — Ganhar {aula.xp_recompensa || 10} XP
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

  // Reset checklist state when switching aulas
  useEffect(() => {
    setChecklistState({});
  }, [selectedAulaId]);

  const handleChecklistToggle = useCallback((itemId: string) => {
    setChecklistState(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  }, []);

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

      {/* ── JOURNEY PATH + PLAYER ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Journey timeline */}
        <div className="lg:col-span-4 space-y-0">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1 mb-3">Jornada de Aprendizado</h3>
          <div className="relative">
            <div className="absolute left-5 top-3 bottom-3 w-0.5 bg-border" />

            {trilhaAulas.map((aula, idx) => {
              const aulaStatus = getAulaStatus(aula.id);
              const isActive = selectedAulaId === aula.id;
              const isQuiz = aula.tipo === "quiz";
              const isChecklist = aula.tipo === "checklist";
              const typeIcon = getAulaTypeIcon(aula.tipo);

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
                      : isChecklist
                      ? "bg-emerald-100 border-emerald-400 text-emerald-600"
                      : "bg-muted border-border text-muted-foreground"
                  )}>
                    {aulaStatus === "concluida" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : isActive ? (
                      <Play className="h-4 w-4 ml-0.5" />
                    ) : (
                      <span className="text-sm">{typeIcon}</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-1">
                    <p className={cn(
                      "text-sm truncate",
                      aulaStatus === "concluida" ? "text-muted-foreground" :
                      isActive ? "text-foreground font-bold" : "text-muted-foreground"
                    )}>
                      {aula.titulo}
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
              {/* Render by type */}
              {selectedAula.tipo === "checklist" ? (
                <ChecklistPlayer
                  aula={selectedAula}
                  status={getAulaStatus(selectedAula.id)}
                  onComplete={() => {
                    if (trilhaId) completeAula(selectedAula.id, trilhaId);
                  }}
                  checklistState={checklistState}
                  onChecklistToggle={handleChecklistToggle}
                />
              ) : selectedAula.tipo === "quiz" ? (
                <QuizPlayer
                  aula={selectedAula}
                  status={getAulaStatus(selectedAula.id)}
                  onComplete={(score) => {
                    if (trilhaId) completeAula(selectedAula.id, trilhaId, score);
                  }}
                />
              ) : (
                <MediaPlayer
                  aula={selectedAula}
                  status={getAulaStatus(selectedAula.id)}
                  onComplete={() => {
                    if (trilhaId) completeAula(selectedAula.id, trilhaId);
                  }}
                />
              )}

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
