import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Target, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

interface Campanha {
  id: string;
  empreendimento: string;
  segmento_id: string;
  ativo: boolean;
}

interface Segmento {
  id: string;
  nome: string;
}

export default function RoletaCampanhasPanel() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // New campaign form
  const [novoNome, setNovoNome] = useState("");
  const [novoSegmento, setNovoSegmento] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [campRes, segRes] = await Promise.all([
      supabase.from("roleta_campanhas").select("*").order("empreendimento"),
      supabase.from("roleta_segmentos").select("id, nome").order("nome"),
    ]);
    setCampanhas((campRes.data || []) as Campanha[]);
    setSegmentos((segRes.data || []) as Segmento[]);
    setLoading(false);
  }

  function getSegmentoNome(segId: string) {
    return segmentos.find((s) => s.id === segId)?.nome || "—";
  }

  const segmentColor: Record<string, string> = {
    "MCMV / Até 500k": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    "Médio-Alto Padrão": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    "Altíssimo Padrão": "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    "Investimento": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  };

  async function handleAdd() {
    if (!novoNome.trim() || !novoSegmento) {
      toast.error("Preencha o nome e selecione o segmento");
      return;
    }
    const exists = campanhas.some(
      (c) => c.empreendimento.toLowerCase() === novoNome.trim().toLowerCase()
    );
    if (exists) {
      toast.error("Já existe uma campanha com esse nome");
      return;
    }

    setAdding(true);
    const { error } = await supabase.from("roleta_campanhas").insert({
      empreendimento: novoNome.trim(),
      segmento_id: novoSegmento,
      ativo: true,
    });

    if (error) {
      toast.error("Erro ao adicionar: " + error.message);
    } else {
      toast.success(`Campanha "${novoNome.trim()}" vinculada!`);
      setNovoNome("");
      setNovoSegmento("");
      setShowForm(false);
      await loadData();
    }
    setAdding(false);
  }

  async function handleToggle(id: string, ativo: boolean) {
    const { error } = await supabase
      .from("roleta_campanhas")
      .update({ ativo: !ativo })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar");
    } else {
      setCampanhas((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ativo: !ativo } : c))
      );
      toast.success(ativo ? "Campanha desativada" : "Campanha ativada");
    }
  }

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Remover "${nome}" da roleta?`)) return;
    const { error } = await supabase.from("roleta_campanhas").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover");
    } else {
      setCampanhas((prev) => prev.filter((c) => c.id !== id));
      toast.success("Campanha removida");
    }
  }

  async function handleSegmentoChange(id: string, newSegId: string) {
    const { error } = await supabase
      .from("roleta_campanhas")
      .update({ segmento_id: newSegId })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar segmento");
    } else {
      setCampanhas((prev) =>
        prev.map((c) => (c.id === id ? { ...c, segmento_id: newSegId } : c))
      );
      toast.success("Segmento atualizado");
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-primary" />
          Campanhas da Roleta
        </CardTitle>
        <CardDescription>
          Vincule empreendimentos/campanhas aos segmentos de distribuição da roleta de leads
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing campaigns */}
        <div className="space-y-2">
          {campanhas.map((c) => {
            const segNome = getSegmentoNome(c.segmento_id);
            return (
              <div
                key={c.id}
                className={`flex items-center gap-3 p-3 rounded-lg border border-border transition-opacity ${
                  !c.ativo ? "opacity-50" : ""
                }`}
              >
                <Switch
                  checked={c.ativo}
                  onCheckedChange={() => handleToggle(c.id, c.ativo)}
                  className="shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.empreendimento}</p>
                </div>

                <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                <Select
                  value={c.segmento_id}
                  onValueChange={(v) => handleSegmentoChange(c.id, v)}
                >
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {segmentos.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Badge
                  variant="secondary"
                  className={`text-[10px] shrink-0 ${segmentColor[segNome] || ""}`}
                >
                  {segNome}
                </Badge>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleDelete(c.id, c.empreendimento)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Add form */}
        {showForm ? (
          <div className="p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 space-y-3">
            <p className="text-sm font-semibold text-foreground">Nova campanha</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome da campanha / empreendimento</Label>
                <Input
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Ex: Melnick Day Alto Padrao"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Segmento de distribuição</Label>
                <Select value={novoSegmento} onValueChange={setNovoSegmento}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione o segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    {segmentos.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              O nome deve corresponder ao que chega nas campanhas do Jetimob/Meta Ads. O sistema usa correspondência automática (case-insensitive).
            </p>
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={adding} size="sm" className="gap-1.5">
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Adicionar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setNovoNome("");
                  setNovoSegmento("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setShowForm(true)}
            className="gap-1.5 w-full border-dashed"
          >
            <Plus className="h-4 w-4" />
            Adicionar nova campanha
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
