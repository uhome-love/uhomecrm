import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export interface QuizQuestion {
  pergunta: string;
  opcoes: { text: string; correct: boolean }[];
  explicacao: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  aulaId: string | null;
  questions: QuizQuestion[];
  setQuestions: (q: QuizQuestion[]) => void;
}

export function QuizDialog({ open, onOpenChange, aulaId, questions, setQuestions }: Props) {
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    if (!aulaId) return;
    setSaving(true);
    await supabase.from("academia_quiz").delete().eq("aula_id", aulaId);
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await supabase.from("academia_quiz").insert({
        aula_id: aulaId,
        pergunta: q.pergunta,
        opcoes: { options: q.opcoes },
        explicacao: q.explicacao || null,
        ordem: i + 1,
      });
    }
    setSaving(false);
    toast.success("Quiz salvo!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>❓ Editor de quiz</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={qi} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-bold">Pergunta {qi + 1}</Label>
                <Button variant="ghost" size="sm" className="h-6 text-destructive" onClick={() => setQuestions(questions.filter((_, i) => i !== qi))}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Input
                value={q.pergunta}
                onChange={e => {
                  const up = [...questions];
                  up[qi] = { ...up[qi], pergunta: e.target.value };
                  setQuestions(up);
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
                      const up = [...questions];
                      up[qi] = { ...up[qi], opcoes: up[qi].opcoes.map((o, i) => ({ ...o, correct: i === oi })) };
                      setQuestions(up);
                    }}
                    className="shrink-0"
                  />
                  <Input
                    value={opt.text}
                    onChange={e => {
                      const up = [...questions];
                      const opcoes = [...up[qi].opcoes];
                      opcoes[oi] = { ...opcoes[oi], text: e.target.value };
                      up[qi] = { ...up[qi], opcoes };
                      setQuestions(up);
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
                    const up = [...questions];
                    up[qi] = { ...up[qi], explicacao: e.target.value };
                    setQuestions(up);
                  }}
                />
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            className="w-full gap-1.5"
            onClick={() => setQuestions([...questions, {
              pergunta: "",
              opcoes: [{ text: "", correct: true }, { text: "", correct: false }, { text: "", correct: false }, { text: "", correct: false }],
              explicacao: "",
            }])}
          >
            <Plus className="h-4 w-4" /> Adicionar pergunta
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={salvar} disabled={saving}>Salvar quiz</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
