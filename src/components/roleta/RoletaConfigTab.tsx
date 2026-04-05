import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Plus, Trash2, Settings, Tag, Globe } from "lucide-react";
import { toast } from "sonner";

interface ConfigItem {
  id: string;
  chave: string;
  valor: string;
  descricao: string | null;
}

interface Segmento {
  id: string;
  nome: string;
  ativo: boolean;
  campanhas: { id: string; empreendimento: string; ignorar_segmento: boolean }[];
}

export default function RoletaConfigTab() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [newCampanha, setNewCampanha] = useState<Record<string, string>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, segRes, campRes] = await Promise.all([
        supabase.from("roleta_config").select("*").order("chave"),
        supabase.from("roleta_segmentos").select("*").order("nome"),
        supabase.from("roleta_campanhas").select("*").order("empreendimento"),
      ]);

      setConfigs(configRes.data || []);
      const segs = (segRes.data || []).map(s => ({
        ...s,
        campanhas: (campRes.data || []).filter(c => c.segmento_id === s.id),
      }));
      setSegmentos(segs);

      const vals: Record<string, string> = {};
      for (const c of configRes.data || []) vals[c.chave] = c.valor;
      setEditValues(vals);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const saveConfig = async (chave: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("roleta_config")
        .update({ valor: editValues[chave], updated_at: new Date().toISOString() })
        .eq("chave", chave);
      if (error) throw error;
      toast.success(`Configuração "${chave}" salva!`);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const addCampanha = async (segmentoId: string) => {
    const emp = newCampanha[segmentoId]?.trim();
    if (!emp) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("roleta_campanhas").insert({
        empreendimento: emp,
        segmento_id: segmentoId,
        ativo: true,
      });
      if (error) throw error;
      toast.success(`Empreendimento "${emp}" adicionado!`);
      setNewCampanha(prev => ({ ...prev, [segmentoId]: "" }));
      await loadAll();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeCampanha = async (id: string) => {
    try {
      await supabase.from("roleta_campanhas").delete().eq("id", id);
      toast.success("Empreendimento removido");
      await loadAll();
    } catch { toast.error("Erro ao remover"); }
  };

  const toggleIgnorarSegmento = async (id: string, current: boolean) => {
    try {
      await supabase.from("roleta_campanhas").update({ ignorar_segmento: !current }).eq("id", id);
      toast.success(!current ? "Marcado como segmento geral" : "Removido do segmento geral");
      await loadAll();
    } catch { toast.error("Erro"); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const configLabels: Record<string, string> = {
    limite_leads_desatualizados: "Max leads desatualizados",
    limite_descartes_mes: "Max descartes/mês",
    tempo_aceite_minutos: "Tempo de aceite (min)",
    visitas_minimas_domingo: "Visitas mín. p/ domingo",
    origens_gerais: "Origens gerais (vírgula)",
  };

  return (
    <div className="space-y-6">
      {/* Parâmetros gerais */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" /> Parâmetros da Roleta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {configs.map(c => (
            <div key={c.id} className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium">{configLabels[c.chave] || c.chave}</label>
                {c.descricao && <p className="text-xs text-muted-foreground">{c.descricao}</p>}
              </div>
              <Input
                className="w-48"
                value={editValues[c.chave] || ""}
                onChange={e => setEditValues(prev => ({ ...prev, [c.chave]: e.target.value }))}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => saveConfig(c.chave)}
                disabled={saving || editValues[c.chave] === c.valor}
              >
                <Save className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Segmentos e empreendimentos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" /> Segmentos e Empreendimentos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {segmentos.map(seg => (
            <div key={seg.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{seg.nome}</h3>
                <Badge variant={seg.ativo ? "default" : "secondary"} className="text-xs">
                  {seg.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {seg.campanhas.map(c => (
                  <div key={c.id} className="flex items-center gap-1 bg-muted rounded-md px-2 py-1 text-xs">
                    <span>{c.empreendimento}</span>
                    {c.ignorar_segmento && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        <Globe className="h-2.5 w-2.5 mr-0.5" />Geral
                      </Badge>
                    )}
                    <button
                      className="text-muted-foreground hover:text-primary ml-1"
                      onClick={() => toggleIgnorarSegmento(c.id, c.ignorar_segmento)}
                      title={c.ignorar_segmento ? "Remover do geral" : "Tornar geral"}
                    >
                      <Globe className="h-3 w-3" />
                    </button>
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeCampanha(c.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Novo empreendimento..."
                  className="text-sm h-8"
                  value={newCampanha[seg.id] || ""}
                  onChange={e => setNewCampanha(prev => ({ ...prev, [seg.id]: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && addCampanha(seg.id)}
                />
                <Button size="sm" variant="outline" className="h-8" onClick={() => addCampanha(seg.id)} disabled={saving}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
