import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Trash2, Phone, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface SavedScript {
  id: string;
  tipo: string;
  empreendimento: string;
  tipo_abordagem: string | null;
  situacao_lead: string | null;
  objetivo: string | null;
  conteudo: string;
  titulo: string | null;
  created_at: string;
}

export default function ScriptLibrary() {
  const { user } = useAuth();
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTipo, setFilterTipo] = useState<string>("");
  const [filterEmpreendimento, setFilterEmpreendimento] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase.from("saved_scripts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (filterTipo) query = query.eq("tipo", filterTipo);
    if (filterEmpreendimento) query = query.eq("empreendimento", filterEmpreendimento);
    const { data } = await query;
    setScripts((data as SavedScript[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, filterTipo, filterEmpreendimento]);

  const empreendimentos = [...new Set(scripts.map(s => s.empreendimento))];

  const deleteScript = async (id: string) => {
    await supabase.from("saved_scripts").delete().eq("id", id);
    toast.success("Script excluído");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os tipos</SelectItem>
            <SelectItem value="ligacao">Scripts de Ligação</SelectItem>
            <SelectItem value="followup">Follow Ups</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEmpreendimento} onValueChange={setFilterEmpreendimento}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Todos empreendimentos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos empreendimentos</SelectItem>
            {empreendimentos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{scripts.length} script(s) salvos</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando biblioteca...</div>
      ) : scripts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card shadow-card p-8 text-center">
          <div className="text-4xl mb-3">📚</div>
          <p className="text-sm text-muted-foreground">Nenhum script salvo. Gere scripts nas abas anteriores e salve para reutilizar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scripts.map(s => (
            <div key={s.id} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/10 transition-colors"
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${s.tipo === "ligacao" ? "bg-primary/10" : "bg-success/10"}`}>
                  {s.tipo === "ligacao" ? <Phone className="h-4 w-4 text-primary" /> : <MessageSquare className="h-4 w-4 text-success" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.titulo || `${s.empreendimento} - ${s.situacao_lead}`}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {s.empreendimento} • {s.situacao_lead} • {new Date(s.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.tipo === "ligacao" ? "bg-primary/10 text-primary" : "bg-success/10 text-success"}`}>
                  {s.tipo === "ligacao" ? "Ligação" : "Follow Up"}
                </span>
              </button>

              {expandedId === s.id && (
                <div className="border-t border-border">
                  <div className="flex items-center gap-2 px-4 py-2 bg-muted/20">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => { navigator.clipboard.writeText(s.conteudo); toast.success("Copiado!"); }}>
                      <Copy className="h-3 w-3" /> Copiar
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 text-destructive hover:text-destructive" onClick={() => deleteScript(s.id)}>
                      <Trash2 className="h-3 w-3" /> Excluir
                    </Button>
                  </div>
                  <div className="p-4 prose prose-sm max-w-none text-foreground prose-headings:font-display prose-headings:text-foreground prose-strong:text-foreground">
                    <ReactMarkdown>{s.conteudo}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
