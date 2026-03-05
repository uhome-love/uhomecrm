import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText, MessageCircle, Mail, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

export default function TeamScriptAssignment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [titulo, setTitulo] = useState("");
  const [empreendimento, setEmpreendimento] = useState("");
  const [campanha, setCampanha] = useState("");
  const [scriptLigacao, setScriptLigacao] = useState("");
  const [scriptWhatsapp, setScriptWhatsapp] = useState("");
  const [scriptEmail, setScriptEmail] = useState("");

  // Fetch existing team scripts
  const { data: scripts, isLoading } = useQuery({
    queryKey: ["team-scripts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_scripts")
        .select("*")
        .eq("gerente_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch empreendimentos from OA listas for suggestions
  const { data: empreendimentos } = useQuery({
    queryKey: ["oa-empreendimentos"],
    queryFn: async () => {
      const { data } = await supabase.from("oferta_ativa_listas").select("empreendimento, campanha").order("created_at", { ascending: false });
      const emps = [...new Set((data || []).map(d => d.empreendimento))];
      return emps;
    },
  });

  const handleSave = async () => {
    if (!user || !empreendimento.trim() || !titulo.trim()) {
      toast.error("Preencha o título e empreendimento.");
      return;
    }
    if (!scriptLigacao.trim() && !scriptWhatsapp.trim() && !scriptEmail.trim()) {
      toast.error("Preencha pelo menos um script.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("team_scripts").insert({
        gerente_id: user.id,
        titulo: titulo.trim(),
        empreendimento: empreendimento.trim(),
        campanha: campanha.trim() || null,
        script_ligacao: scriptLigacao.trim() || null,
        script_whatsapp: scriptWhatsapp.trim() || null,
        script_email: scriptEmail.trim() || null,
      } as any);
      if (error) throw error;
      toast.success("Script atribuído ao time!");
      queryClient.invalidateQueries({ queryKey: ["team-scripts"] });
      resetForm();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from("team_scripts").update({ ativo } as any).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["team-scripts"] });
    toast.success(ativo ? "Script ativado!" : "Script desativado.");
  };

  const deleteScript = async (id: string) => {
    await supabase.from("team_scripts").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["team-scripts"] });
    toast.success("Script removido.");
  };

  const resetForm = () => {
    setShowForm(false);
    setTitulo("");
    setEmpreendimento("");
    setCampanha("");
    setScriptLigacao("");
    setScriptWhatsapp("");
    setScriptEmail("");
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Scripts para o Time
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Defina scripts por empreendimento/campanha. Seus corretores verão esses scripts durante a discagem.
          </p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo Script
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Título *</Label>
                <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Script Lançamento Verão" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Empreendimento *</Label>
                {empreendimentos && empreendimentos.length > 0 ? (
                  <Select value={empreendimento} onValueChange={setEmpreendimento}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {empreendimentos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={empreendimento} onChange={e => setEmpreendimento(e.target.value)} placeholder="Nome do empreendimento" className="mt-1" />
                )}
              </div>
              <div>
                <Label className="text-xs">Campanha (opcional)</Label>
                <Input value={campanha} onChange={e => setCampanha(e.target.value)} placeholder="Ex: Meta Ads Março" className="mt-1" />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-emerald-600" /> Script de Ligação</Label>
                <Textarea value={scriptLigacao} onChange={e => setScriptLigacao(e.target.value)} rows={4} placeholder="Use {nome} e {empreendimento} como variáveis..." className="mt-1 text-xs font-mono" />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-green-600" /> Script WhatsApp</Label>
                <Textarea value={scriptWhatsapp} onChange={e => setScriptWhatsapp(e.target.value)} rows={4} placeholder="Use {nome} e {empreendimento} como variáveis..." className="mt-1 text-xs font-mono" />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-blue-500" /> Script E-mail</Label>
                <Textarea value={scriptEmail} onChange={e => setScriptEmail(e.target.value)} rows={4} placeholder="Use {nome} e {empreendimento} como variáveis..." className="mt-1 text-xs font-mono" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Atribuir ao Time
              </Button>
              <Button variant="ghost" onClick={resetForm}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing scripts */}
      {scripts && scripts.length === 0 && !showForm && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm">Nenhum script atribuído ao time ainda.</p>
            <p className="text-xs mt-1">Crie scripts que seus corretores verão automaticamente na discagem.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(scripts || []).map((s: any) => (
          <Card key={s.id} className={`${s.ativo ? "border-primary/20" : "border-muted opacity-60"}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-sm text-foreground">{s.titulo}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">{s.empreendimento}</Badge>
                    {s.campanha && <Badge variant="secondary" className="text-[10px]">{s.campanha}</Badge>}
                    <Badge variant={s.ativo ? "default" : "outline"} className="text-[10px]">
                      {s.ativo ? "Ativo" : "Desativado"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Switch checked={s.ativo} onCheckedChange={(v) => toggleAtivo(s.id, v)} />
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteScript(s.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {s.script_ligacao && (
                  <div className="bg-muted/50 p-2 rounded text-xs">
                    <p className="font-semibold text-[10px] text-emerald-600 mb-1 flex items-center gap-1"><FileText className="h-3 w-3" /> Ligação</p>
                    <p className="text-muted-foreground whitespace-pre-line line-clamp-3">{s.script_ligacao}</p>
                  </div>
                )}
                {s.script_whatsapp && (
                  <div className="bg-muted/50 p-2 rounded text-xs">
                    <p className="font-semibold text-[10px] text-green-600 mb-1 flex items-center gap-1"><MessageCircle className="h-3 w-3" /> WhatsApp</p>
                    <p className="text-muted-foreground whitespace-pre-line line-clamp-3">{s.script_whatsapp}</p>
                  </div>
                )}
                {s.script_email && (
                  <div className="bg-muted/50 p-2 rounded text-xs">
                    <p className="font-semibold text-[10px] text-blue-500 mb-1 flex items-center gap-1"><Mail className="h-3 w-3" /> E-mail</p>
                    <p className="text-muted-foreground whitespace-pre-line line-clamp-3">{s.script_email}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
