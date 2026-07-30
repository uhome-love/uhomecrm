import { useState, useCallback, useEffect, useMemo } from "react";
import { useAcademia, type Trilha, type Aula } from "@/hooks/useAcademia";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ModuloRow } from "@/components/academia/gerenciar/ModuloRow";
import { ModuloDialog, MODULO_FORM_VAZIO, type ModuloForm } from "@/components/academia/gerenciar/ModuloDialog";
import { AulaDialog, AULA_FORM_VAZIO, type AulaForm } from "@/components/academia/gerenciar/AulaDialog";
import { QuizDialog, type QuizQuestion } from "@/components/academia/gerenciar/QuizDialog";

export default function AcademiaGerenciarPage({ showHeader = true }: { showHeader?: boolean } = {}) {
  const navigate = useNavigate();
  const { trilhas, aulas, createTrilha, updateTrilha, deleteTrilha, createAula, updateAula, deleteAula, loading } = useAcademia();

  const [expandido, setExpandido] = useState<string | null>(null);
  const [moduloDialogOpen, setModuloDialogOpen] = useState(false);
  const [aulaDialogOpen, setAulaDialogOpen] = useState(false);
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);
  const [editModulo, setEditModulo] = useState<Trilha | null>(null);
  const [editAula, setEditAula] = useState<Aula | null>(null);
  const [moduloAtivoId, setModuloAtivoId] = useState<string | null>(null);
  const [quizAulaId, setQuizAulaId] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);

  const [moduloForm, setModuloForm] = useState<ModuloForm>(MODULO_FORM_VAZIO);
  const [aulaForm, setAulaForm] = useState<AulaForm>(AULA_FORM_VAZIO);

  const [engagementMap, setEngagementMap] = useState<Record<string, { iniciaram: number; concluiram: number; mediaProgresso: number }>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("academia_progresso").select("trilha_id, status, corretor_id");
      if (!data || data.length === 0) return;
      const map: Record<string, { users: Set<string>; concluded: Set<string>; total: number; doneCount: number }> = {};
      for (const row of data) {
        const tid = row.trilha_id;
        if (!tid) continue;
        if (!map[tid]) map[tid] = { users: new Set(), concluded: new Set(), total: 0, doneCount: 0 };
        const uid = row.corretor_id || "anon";
        map[tid].users.add(uid);
        map[tid].total++;
        if (row.status === "concluida") { map[tid].concluded.add(uid); map[tid].doneCount++; }
      }
      const result: Record<string, { iniciaram: number; concluiram: number; mediaProgresso: number }> = {};
      for (const [tid, v] of Object.entries(map)) {
        result[tid] = {
          iniciaram: v.users.size,
          concluiram: v.concluded.size,
          mediaProgresso: v.total > 0 ? Math.round((v.doneCount / v.total) * 100) : 0,
        };
      }
      setEngagementMap(result);
    })();
  }, [trilhas]);

  const modulos = useMemo(
    () => [...trilhas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)),
    [trilhas]
  );

  const aulasDoModulo = useCallback(
    (id: string) => aulas.filter(a => a.trilha_id === id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)),
    [aulas]
  );

  // ── Módulos ──
  const abrirNovoModulo = () => {
    setEditModulo(null);
    setModuloForm(MODULO_FORM_VAZIO);
    setModuloDialogOpen(true);
  };

  const abrirEditarModulo = (m: Trilha) => {
    setEditModulo(m);
    setModuloForm({
      titulo: m.titulo, descricao: m.descricao || "", categoria: m.categoria || "tecnicas_vendas",
      nivel: m.nivel || "iniciante", publicada: m.publicada ?? false,
      visibilidade: (m as any).visibilidade || "todos", thumbnail_url: m.thumbnail_url || "",
    });
    setModuloDialogOpen(true);
  };

  const salvarModulo = useCallback(async () => {
    if (!moduloForm.titulo.trim()) { toast.error("Título obrigatório"); return; }
    const payload: any = {
      titulo: moduloForm.titulo,
      descricao: moduloForm.descricao || null,
      categoria: moduloForm.categoria,
      nivel: moduloForm.nivel,
      publicada: moduloForm.publicada,
      visibilidade: moduloForm.visibilidade,
      thumbnail_url: moduloForm.thumbnail_url || null,
    };
    if (editModulo) {
      await updateTrilha(editModulo.id, payload);
    } else {
      const criado = await createTrilha(payload);
      if (criado) setExpandido(criado.id);
    }
    setModuloDialogOpen(false);
    setEditModulo(null);
  }, [moduloForm, editModulo, createTrilha, updateTrilha]);

  // ── Aulas ──
  const abrirNovaAula = (moduloId: string) => {
    setModuloAtivoId(moduloId);
    setEditAula(null);
    setAulaForm({ ...AULA_FORM_VAZIO, ordem: aulasDoModulo(moduloId).length + 1 });
    setAulaDialogOpen(true);
  };

  const abrirEditarAula = (a: Aula) => {
    const c = a.conteudo as any;
    setModuloAtivoId(a.trilha_id);
    setEditAula(a);
    setAulaForm({
      titulo: a.titulo, descricao: a.descricao || "", tipo: a.tipo,
      duracao_minutos: a.duracao_minutos || 10, xp_recompensa: a.xp_recompensa || 10, ordem: a.ordem || 1,
      youtube_url: c?.url || "", vimeo_url: c?.url || "", conteudo_html: c?.html || "",
      storage_bucket: c?.storage_bucket || "", storage_key: c?.storage_key || "",
    });
    setAulaDialogOpen(true);
  };

  const salvarAula = useCallback(async () => {
    if (!aulaForm.titulo.trim() || !moduloAtivoId) { toast.error("Título e módulo obrigatórios"); return; }

    let conteudo: any = null;
    let youtubeId: string | null = null;

    if (aulaForm.tipo === "youtube" && aulaForm.youtube_url) {
      const match = aulaForm.youtube_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
      youtubeId = match ? match[1] : aulaForm.youtube_url;
      conteudo = { url: aulaForm.youtube_url };
    } else if (aulaForm.tipo === "vimeo" && aulaForm.vimeo_url) {
      conteudo = { url: aulaForm.vimeo_url };
    } else if ((aulaForm.tipo === "video_upload" || aulaForm.tipo === "pdf") && aulaForm.storage_key) {
      conteudo = { storage_bucket: aulaForm.storage_bucket, storage_key: aulaForm.storage_key };
    } else if (aulaForm.tipo === "texto") {
      conteudo = { html: aulaForm.conteudo_html };
    }

    const payload: any = {
      trilha_id: moduloAtivoId,
      titulo: aulaForm.titulo,
      descricao: aulaForm.descricao || null,
      tipo: aulaForm.tipo,
      conteudo,
      youtube_id: youtubeId,
      duracao_minutos: aulaForm.duracao_minutos,
      xp_recompensa: aulaForm.xp_recompensa,
      ordem: aulaForm.ordem,
    };

    if (editAula) {
      await updateAula(editAula.id, payload);
    } else {
      const criada = await createAula(payload);
      if (criada && aulaForm.tipo === "quiz") {
        setQuizAulaId(criada.id);
        setQuizQuestions([]);
        setQuizDialogOpen(true);
      }
    }
    setAulaDialogOpen(false);
    setEditAula(null);
  }, [aulaForm, editAula, moduloAtivoId, createAula, updateAula]);

  const moverAula = useCallback(async (a: Aula, dir: -1 | 1) => {
    const lista = aulasDoModulo(a.trilha_id!);
    const idx = lista.findIndex(x => x.id === a.id);
    const alvo = lista[idx + dir];
    if (!alvo) return;
    await Promise.all([
      updateAula(a.id, { ordem: idx + 1 + dir } as any),
      updateAula(alvo.id, { ordem: idx + 1 } as any),
    ]);
  }, [aulasDoModulo, updateAula]);

  const abrirQuiz = useCallback(async (aulaId: string) => {
    setQuizAulaId(aulaId);
    const { data } = await supabase.from("academia_quiz").select("*").eq("aula_id", aulaId).order("ordem");
    setQuizQuestions((data || []).map((q: any) => ({
      pergunta: q.pergunta,
      opcoes: (q.opcoes as any)?.options || [],
      explicacao: q.explicacao || "",
    })));
    setQuizDialogOpen(true);
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {showHeader && (
          <>
            <button onClick={() => navigate("/academia")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold">🎓 Gerenciar Academia</h1>
          </>
        )}
        <div className="ml-auto">
          <Button onClick={abrirNovoModulo} className="gap-1.5"><Plus className="h-4 w-4" /> Novo módulo</Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Crie um módulo, abra ele e arraste os vídeos para dentro — cada vídeo vira uma aula na sequência.
        Módulos em rascunho não aparecem para os corretores.
      </p>

      <div className="space-y-2">
        {modulos.map((m, i) => (
          <ModuloRow
            key={m.id}
            modulo={m}
            index={i}
            aulas={aulasDoModulo(m.id)}
            expanded={expandido === m.id}
            engagement={engagementMap[m.id]}
            onToggle={() => setExpandido(prev => (prev === m.id ? null : m.id))}
            onEdit={() => abrirEditarModulo(m)}
            onDelete={() => { if (confirm("Excluir módulo e todas as aulas?")) deleteTrilha(m.id); }}
            onTogglePublicar={() => updateTrilha(m.id, { publicada: !m.publicada } as any)}
            onNovaAula={() => abrirNovaAula(m.id)}
            onEditAula={abrirEditarAula}
            onDeleteAula={a => { if (confirm("Excluir aula?")) deleteAula(a.id); }}
            onMoveAula={moverAula}
            onQuiz={abrirQuiz}
            onCreateAula={createAula}
          />
        ))}

        {modulos.length === 0 && (
          <div className="text-center py-16 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
            Nenhum módulo ainda. Clique em "Novo módulo" para começar.
          </div>
        )}
      </div>

      <ModuloDialog
        open={moduloDialogOpen}
        onOpenChange={setModuloDialogOpen}
        form={moduloForm}
        setForm={fn => setModuloForm(fn)}
        isEdit={!!editModulo}
        onSave={salvarModulo}
      />

      <AulaDialog
        open={aulaDialogOpen}
        onOpenChange={setAulaDialogOpen}
        form={aulaForm}
        setForm={fn => setAulaForm(fn)}
        isEdit={!!editAula}
        moduloId={moduloAtivoId}
        onSave={salvarAula}
      />

      <QuizDialog
        open={quizDialogOpen}
        onOpenChange={setQuizDialogOpen}
        aulaId={quizAulaId}
        questions={quizQuestions}
        setQuestions={setQuizQuestions}
      />
    </div>
  );
}
