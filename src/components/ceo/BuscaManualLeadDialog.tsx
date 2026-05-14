import { useEffect, useState } from "react";
import { Loader2, Search, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/customClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { negociosRelinkService } from "@/services/negociosRelinkService";

interface NegocioContext {
  id: string;
  nome_cliente: string;
  telefone: string | null;
  empreendimento: string | null;
  corretor_nome?: string | null;
}

interface LeadResult {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  empreendimento: string | null;
  created_at: string;
  corretor_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  negocio: NegocioContext | null;
  onLinked: (negocioId: string, leadId: string) => void;
}

export default function BuscaManualLeadDialog({ open, onOpenChange, negocio, onLinked }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LeadResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  // Pré-preenche com nome do cliente quando abre
  useEffect(() => {
    if (open && negocio) {
      setQuery(negocio.nome_cliente || "");
    } else if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open, negocio]);

  // Busca debounce
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const onlyDigits = q.replace(/\D/g, "");
      const isPhone = onlyDigits.length >= 8;
      let req = supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, email, empreendimento, created_at, corretor_id")
        .order("created_at", { ascending: false })
        .limit(25);

      if (isPhone) {
        const last8 = onlyDigits.slice(-8);
        req = req.ilike("telefone", `%${last8}%`);
      } else {
        req = req.or(`nome.ilike.%${q}%,email.ilike.%${q}%`);
      }
      const { data, error } = await req;
      if (error) toast.error("Erro na busca: " + error.message);
      setResults((data || []) as LeadResult[]);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, open]);

  const handleVincular = async (lead: LeadResult) => {
    if (!negocio) return;
    setLinking(lead.id);
    try {
      await negociosRelinkService.manualLink(negocio.id, lead.id);
      toast.success(`Vinculado a ${lead.nome}`);
      onLinked(negocio.id, lead.id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    } finally {
      setLinking(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Busca manual de lead
          </DialogTitle>
          <DialogDescription>
            {negocio ? (
              <>
                Negócio: <strong>{negocio.nome_cliente}</strong> · 📞 {negocio.telefone || "—"} · 🏢{" "}
                {negocio.empreendimento || "—"}
                {negocio.corretor_nome && <> · 👤 {negocio.corretor_nome}</>}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, email ou telefone (≥3 caracteres)…"
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Buscando…
            </div>
          ) : results.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              {query.trim().length < 3 ? "Digite ao menos 3 caracteres" : "Nenhum lead encontrado"}
            </div>
          ) : (
            results.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-3 p-3 border rounded-md hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{l.nome}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    📞 {l.telefone || "—"} · ✉️ {l.email || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    🏢 {l.empreendimento || "—"} ·{" "}
                    {new Date(l.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <Button size="sm" onClick={() => handleVincular(l)} disabled={linking === l.id}>
                  {linking === l.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vincular"}
                </Button>
              </div>
            ))
          )}
        </div>

        {negocio && (
          <div className="text-xs text-muted-foreground border-t pt-3">
            <Badge variant="secondary">Dica</Badge> Tente o nome completo, parte do email, ou últimos 8 dígitos do
            telefone. A vinculação é registrada como <code>manual</code> e atualiza o lead_id imediatamente.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
