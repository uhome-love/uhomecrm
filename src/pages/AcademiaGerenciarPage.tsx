import { useState, useCallback } from "react";
import { useAcademia, CATEGORIAS, NIVEL_CONFIG, TIPO_CONFIG, type Trilha, type Aula } from "@/hooks/useAcademia";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Edit, Trash2, Eye, EyeOff, ArrowLeft, GripVertical, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function AcademiaGerenciarPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { trilhas, aulas, createTrilha, updateTrilha, deleteTrilha, createAula, updateAula, deleteAula, loading } = useAcademia();

  const [trilhaDialogOpen, setTrilhaDialogOpen] = useState(false);
  const [aulaDialogOpen, setAulaDialogOpen] = useState(false);
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);
  const [editTrilha, setEditTrilha] = useState<Trilha | null>(null);
  const [editAula, setEditAula] = useState<Aula | null>(null);
  const [selectedTrilhaId, setSelectedTrilhaId] = useState<string | null>(null);

  // Trilha form
  const [trilhaForm, setTrilhaForm] = useState({
    titulo: "", descricao: "", categoria: "tecnicas_vendas", nivel: "iniciante",
    publicada: false, visibilidade: "todos", thumbnail_url: "",
  });

  // Aula form
  const [aulaForm, setAulaForm] = useState({
    titulo: "", descricao: "", tipo: "youtube", duracao_minutos: 10, xp_recompensa: 10, ordem: 1,
    youtube_url: "", vimeo_url: "", conteudo_html: "",
  });

  // Quiz questions for quiz type
  const [quizQuestions, setQuizQuestions] = useState<{ pergunta: string; opcoes: { text: string; correct: boolean }[]; explicacao: string }[]>([]);
  const [editQuizAulaId, setEditQuizAulaId] = useState<string | null>(null);

  // File upload states
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);

  const selectedTrilhaAulas = aulas.filter(a => a.trilha_id === selectedTrilhaId).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  // Save trilha
  const handleSaveTrilha = useCallback(async () => {
    if (!trilhaForm.titulo.trim()) { toast.error("Título obrigatório"); return; }
    if (editTrilha) {
      await updateTrilha(editTrilha.id, {
        titulo: trilhaForm.titulo, descricao: trilhaForm.descricao || null,
        categoria: trilhaForm.categoria, nivel: trilhaForm.nivel,
        publicada: trilhaForm.publicada, thumbnail_url: trilhaForm.thumbnail_url || null,
      } as any);
    } else {
      const created = await createTrilha({
        titulo: trilhaForm.titulo, descricao: trilhaForm.descricao || null,
        categoria: trilhaForm.categoria, nivel: trilhaForm.nivel,
        publicada: trilhaForm.publicada, thumbnail_url: trilhaForm.thumbnail_url || null,
      } as any);
      if (created) setSelectedTrilhaId(created.id);
    }
    setTrilhaDialogOpen(false);
    setEditTrilha(null);
  }, [trilhaForm, editTrilha, createTrilha, updateTrilha]);

  // Save aula
  const handleSaveAula = useCallback(async () => {
    if (!aulaForm.titulo.trim() || !selectedTrilhaId) { toast.error("Título e trilha obrigatórios"); return; }

    let conteudo: any = null;
    let youtubeId: string | null = null;
    let conteudoUrl: string | null = null;

    if (aulaForm.tipo === "youtube" && aulaForm.youtube_url) {
      const match = aulaForm.youtube_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
      youtubeId = match ? match[1] : aulaForm.youtube_url;
      conteudo = { url: aulaForm.youtube_url };
    } else if (aulaForm.tipo === "vimeo" && aulaForm.vimeo_url) {
      conteudo = { url: aulaForm.vimeo_url };
    } else if (aulaForm.tipo === "video_upload" && uploadedPath) {
      conteudo = { storage_path: uploadedPath };
    } else if (aulaForm.tipo === "pdf" && uploadedPath) {
      conteudo = { storage_path: uploadedPath };
    } else if (aulaForm.tipo === "texto") {
      conteudo = { html: aulaForm.conteudo_html };
    }

    const payload: any = {
      trilha_id: selectedTrilhaId,
      titulo: aulaForm.titulo, descricao: aulaForm.descricao || null,
      tipo: aulaForm.tipo, conteudo, youtube_id: youtubeId, conteudo_url: conteudoUrl,
      duracao_minutos: aulaForm.duracao_minutos, xp_recompensa: aulaForm.xp_recompensa,
      ordem: aulaForm.ordem,
    };

    if (editAula) {
      await updateAula(editAula.id, payload);
    } else {
      const created = await createAula(payload);
      // If quiz type, open quiz editor
      if (created && aulaForm.tipo === "quiz") {
        setEditQuizAulaId(created.id);
        setQuizQuestions([]);
        setQuizDialogOpen(true);
      }
    }
    setAulaDialogOpen(false);
    setEditAula(null);
    setUploadedPath(null);
  }, [aulaForm, editAula, selectedTrilhaId, uploadedPath, createAula, updateAula]);

  // File upload handler
  const handleFileUpload = async (file: File, bucket: string) => {
    const isVideo = bucket === "academia-videos";
    if (isVideo) setUploadingVideo(true); else setUploadingPdf(true);

    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) {
      toast.error("Erro no upload: " + error.message);
    } else {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      setUploadedPath(urlData.publicUrl);
      toast.success("Upload concluído!");
    }
    if (isVideo) setUploadingVideo(false); else setUploadingPdf(false);
  };

  // Save quiz questions
  const handleSaveQuiz = useCallback(async () => {
    if (!editQuizAulaId) return;
    // Delete existing questions
    await supabase.from("academia_quiz").delete().eq("aula_id", editQuizAulaId);
    // Insert new ones
    for (let i = 0; i < quizQuestions.length; i++) {
      const q = quizQuestions[i];
      await supabase.from("academia_quiz").insert({
        aula_id: editQuizAulaId,
        pergunta: q.pergunta,
        opcoes: { options: q.opcoes },
        explicacao: q.explicacao || null,
        ordem: i + 1,
      });
    }
    toast.success("Quiz salvo!");
    setQuizDialogOpen(false);
    setEditQuizAulaId(null);
  }, [quizQuestions, editQuizAulaId]);

  const addQuizQuestion = () => {
    setQuizQuestions(prev => [...prev, {
      pergunta: "",
      opcoes: [{ text: "", correct: true }, { text: "", correct: false }, { text: "", correct: false }, { text: "", correct: false }],
      explicacao: "",
    }]);
  };

  const openEditTrilha = (t: Trilha) => {
    setEditTrilha(t);
    setTrilhaForm({
      titulo: t.titulo, descricao: t.descricao || "", categoria: t.categoria || "tecnicas_vendas",
      nivel: t.nivel || "iniciante", publicada: t.publicada ?? false,
      visibilidade: (t as any).visibilidade || "todos", thumbnail_url: t.thumbnail_url || "",
    });
    setTrilhaDialogOpen(true);
  };

  const openNewTrilha = () => {
    setEditTrilha(null);
    setTrilhaForm({ titulo: "", descricao: "", categoria: "tecnicas_vendas", nivel: "iniciante", publicada: false, visibilidade: "todos", thumbnail_url: "" });
    setTrilhaDialogOpen(true);
  };

  const openEditAula = (a: Aula) => {
    setEditAula(a);
    const conteudo = a.conteudo as any;
    setAulaForm({
      titulo: a.titulo, descricao: a.descricao || "", tipo: a.tipo,
      duracao_minutos: a.duracao_minutos || 10, xp_recompensa: a.xp_recompensa || 10, ordem: a.ordem || 1,
      youtube_url: conteudo?.url || "", vimeo_url: conteudo?.url || "",
      conteudo_html: conteudo?.html || "",
    });
    setUploadedPath(conteudo?.storage_path || null);
    setAulaDialogOpen(true);
  };

  const openNewAula = () => {
    setEditAula(null);
    setAulaForm({ titulo: "", descricao: "", tipo: "youtube", duracao_minutos: 10, xp_recompensa: 10, ordem: selectedTrilhaAulas.length + 1, youtube_url: "", vimeo_url: "", conteudo_html: "" });
    setUploadedPath(null);
    setAulaDialogOpen(true);
  };

  const openQuizEditor = async (aulaId: string) => {
    setEditQuizAulaId(aulaId);
    const { data } = await supabase.from("academia_quiz").select("*").eq("aula_id", aulaId).order("ordem");
    setQuizQuestions((data || []).map((q: any) => ({
      pergunta: q.pergunta,
      opcoes: (q.opcoes as any)?.options || [],
      explicacao: q.explicacao || "",
    })));
    setQuizDialogOpen(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/academia")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">🎓 Gerenciar Academia</h1>
        <div className="ml-auto">
          <Button onClick={openNewTrilha} className="gap-1.5"><Plus className="h-4 w-4" /> Nova Trilha</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Trilhas list */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">Trilhas ({trilhas.length})</h3>
          {trilhas.map(t => {
            const cat = CATEGORIAS.find(c => c.key === t.categoria);
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTrilhaId(t.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all",
                  selectedTrilhaId === t.id ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent/40"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium truncate flex-1">{t.titulo}</span>
                  {!t.publicada && <EyeOff className="h-3 w-3 text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-2">
                  {cat && <Badge className={cn("text-[9px]", cat.color)}>{cat.label.split(" ")[0]}</Badge>}
                  <Badge variant="secondary" className="text-[9px]">{t.nivel || "iniciante"}</Badge>
                  <span className="text-[10px] text-muted-foreground ml-auto">{t.xp_total || 0} XP</span>
                </div>
                <div className="flex items-center gap-1 mt-2" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => openEditTrilha(t)}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={async () => {
                    await updateTrilha(t.id, { publicada: !t.publicada } as any);
                  }}>
                    {t.publicada ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 text-destructive" onClick={() => {
                    if (confirm("Excluir trilha e todas as aulas?")) deleteTrilha(t.id);
                  }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </button>
            );
          })}
        </div>

        {/* Aulas for selected trilha */}
        <div className="md:col-span-2">
          {selectedTrilhaId ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">Aulas ({selectedTrilhaAulas.length})</h3>
                <Button size="sm" onClick={openNewAula} className="gap-1"><Plus className="h-3 w-3" /> Aula</Button>
              </div>
              {selectedTrilhaAulas.map((a, idx) => {
                const tipoInfo = TIPO_CONFIG[a.tipo] || TIPO_CONFIG.youtube;
                return (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                    <span className="text-xs text-muted-foreground font-bold w-6">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{a.titulo}</span>
                        <Badge variant="secondary" className="text-[9px]">{tipoInfo.emoji} {tipoInfo.label}</Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{a.duracao_minutos}min · {a.xp_recompensa} XP</span>
                    </div>
                    {a.tipo === "quiz" && (
                      <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => openQuizEditor(a.id)}>
                        ❓ Quiz
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => openEditAula(a)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 px-1.5 text-destructive" onClick={() => {
                      if (confirm("Excluir aula?")) deleteAula(a.id);
                    }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
              {selectedTrilhaAulas.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm">Nenhuma aula. Clique em "+ Aula" para criar.</div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground text-sm">Selecione uma trilha para gerenciar suas aulas.</div>
          )}
        </div>
      </div>

      {/* Trilha Dialog */}
      <Dialog open={trilhaDialogOpen} onOpenChange={setTrilhaDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editTrilha ? "Editar Trilha" : "Nova Trilha"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Título</Label><Input value={trilhaForm.titulo} onChange={e => setTrilhaForm(p => ({ ...p, titulo: e.target.value }))} /></div>
            <div><Label>Descrição</Label><Textarea value={trilhaForm.descricao} onChange={e => setTrilhaForm(p => ({ ...p, descricao: e.target.value }))} rows={3} /></div>
            <div><Label>URL da Capa/Thumbnail</Label><Input value={trilhaForm.thumbnail_url} onChange={e => setTrilhaForm(p => ({ ...p, thumbnail_url: e.target.value }))} placeholder="https://..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label>
                <Select value={trilhaForm.categoria} onValueChange={v => setTrilhaForm(p => ({ ...p, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Nível</Label>
                <Select value={trilhaForm.nivel} onValueChange={v => setTrilhaForm(p => ({ ...p, nivel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iniciante">Iniciante</SelectItem>
                    <SelectItem value="intermediario">Intermediário</SelectItem>
                    <SelectItem value="avancado">Avançado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Visibilidade</Label>
                <Select value={trilhaForm.visibilidade} onValueChange={v => setTrilhaForm(p => ({ ...p, visibilidade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="corretores">Só Corretores</SelectItem>
                    <SelectItem value="gerentes">Só Gerentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={trilhaForm.publicada} onCheckedChange={v => setTrilhaForm(p => ({ ...p, publicada: v }))} />
                <Label>Publicada</Label>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSaveTrilha}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aula Dialog */}
      <Dialog open={aulaDialogOpen} onOpenChange={setAulaDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editAula ? "Editar Aula" : "Nova Aula"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Título</Label><Input value={aulaForm.titulo} onChange={e => setAulaForm(p => ({ ...p, titulo: e.target.value }))} /></div>
            <div><Label>Descrição</Label><Textarea value={aulaForm.descricao} onChange={e => setAulaForm(p => ({ ...p, descricao: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={aulaForm.tipo} onValueChange={v => setAulaForm(p => ({ ...p, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="youtube">▶️ YouTube</SelectItem>
                    <SelectItem value="vimeo">▶️ Vimeo</SelectItem>
                    <SelectItem value="video_upload">▶️ Upload Vídeo</SelectItem>
                    <SelectItem value="pdf">📄 PDF</SelectItem>
                    <SelectItem value="texto">📝 Texto</SelectItem>
                    <SelectItem value="quiz">❓ Quiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Ordem</Label><Input type="number" value={aulaForm.ordem} onChange={e => setAulaForm(p => ({ ...p, ordem: parseInt(e.target.value) || 1 }))} /></div>
            </div>

            {/* Type-specific fields */}
            {aulaForm.tipo === "youtube" && (
              <div><Label>URL do YouTube</Label><Input value={aulaForm.youtube_url} onChange={e => setAulaForm(p => ({ ...p, youtube_url: e.target.value }))} placeholder="https://youtube.com/watch?v=..." /></div>
            )}
            {aulaForm.tipo === "vimeo" && (
              <div><Label>URL do Vimeo</Label><Input value={aulaForm.vimeo_url} onChange={e => setAulaForm(p => ({ ...p, vimeo_url: e.target.value }))} placeholder="https://vimeo.com/..." /></div>
            )}
            {aulaForm.tipo === "video_upload" && (
              <div>
                <Label>Upload de Vídeo</Label>
                <div className="mt-1 border-2 border-dashed border-border rounded-lg p-4 text-center">
                  {uploadedPath ? (
                    <p className="text-xs text-emerald-600">✅ Vídeo enviado</p>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <input
                        type="file"
                        accept="video/*"
                        onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], "academia-videos")}
                        className="text-xs"
                      />
                      {uploadingVideo && <Loader2 className="h-4 w-4 animate-spin mx-auto mt-2" />}
                    </>
                  )}
                </div>
              </div>
            )}
            {aulaForm.tipo === "pdf" && (
              <div>
                <Label>Upload de PDF</Label>
                <div className="mt-1 border-2 border-dashed border-border rounded-lg p-4 text-center">
                  {uploadedPath ? (
                    <p className="text-xs text-emerald-600">✅ PDF enviado</p>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], "academia-pdfs")}
                        className="text-xs"
                      />
                      {uploadingPdf && <Loader2 className="h-4 w-4 animate-spin mx-auto mt-2" />}
                    </>
                  )}
                </div>
              </div>
            )}
            {aulaForm.tipo === "texto" && (
              <div>
                <Label>Conteúdo (HTML)</Label>
                <Textarea
                  value={aulaForm.conteudo_html}
                  onChange={e => setAulaForm(p => ({ ...p, conteudo_html: e.target.value }))}
                  rows={8}
                  placeholder="<h2>Título</h2><p>Conteúdo da aula...</p>"
                />
              </div>
            )}
            {aulaForm.tipo === "quiz" && !editAula && (
              <p className="text-xs text-muted-foreground">Após criar a aula, use o botão "❓ Quiz" para adicionar perguntas.</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Duração (min)</Label><Input type="number" value={aulaForm.duracao_minutos} onChange={e => setAulaForm(p => ({ ...p, duracao_minutos: parseInt(e.target.value) || 10 }))} /></div>
              <div><Label>XP Recompensa</Label><Input type="number" value={aulaForm.xp_recompensa} onChange={e => setAulaForm(p => ({ ...p, xp_recompensa: parseInt(e.target.value) || 10 }))} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSaveAula}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quiz Editor Dialog */}
      <Dialog open={quizDialogOpen} onOpenChange={setQuizDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>❓ Editor de Quiz</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {quizQuestions.map((q, qi) => (
              <div key={qi} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-bold">Pergunta {qi + 1}</Label>
                  <Button variant="ghost" size="sm" className="h-6 text-destructive" onClick={() => {
                    setQuizQuestions(prev => prev.filter((_, i) => i !== qi));
                  }}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <Input
                  value={q.pergunta}
                  onChange={e => {
                    const updated = [...quizQuestions];
                    updated[qi].pergunta = e.target.value;
                    setQuizQuestions(updated);
                  }}
                  placeholder="Digite a pergunta..."
                />
                {q.opcoes.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`q-${qi}`}
                      checked={opt.correct}
                      onChange={() => {
                        const updated = [...quizQuestions];
                        updated[qi].opcoes = updated[qi].opcoes.map((o, i) => ({ ...o, correct: i === oi }));
                        setQuizQuestions(updated);
                      }}
                      className="shrink-0"
                    />
                    <Input
                      value={opt.text}
                      onChange={e => {
                        const updated = [...quizQuestions];
                        updated[qi].opcoes[oi].text = e.target.value;
                        setQuizQuestions(updated);
                      }}
                      placeholder={`Alternativa ${oi + 1}`}
                      className="flex-1"
                    />
                  </div>
                ))}
                <div>
                  <Label className="text-xs text-muted-foreground">Explicação (opcional)</Label>
                  <Input
                    value={q.explicacao}
                    onChange={e => {
                      const updated = [...quizQuestions];
                      updated[qi].explicacao = e.target.value;
                      setQuizQuestions(updated);
                    }}
                    placeholder="Por que esta é a resposta correta?"
                  />
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={addQuizQuestion} className="w-full gap-1.5">
              <Plus className="h-4 w-4" /> Adicionar Pergunta
            </Button>
          </div>
          <DialogFooter><Button onClick={handleSaveQuiz}>Salvar Quiz ({quizQuestions.length} perguntas)</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
