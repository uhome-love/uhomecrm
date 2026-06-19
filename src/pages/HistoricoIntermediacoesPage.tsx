import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { FileSignature, Download, Search, Loader2, ArrowLeft } from "lucide-react";

interface Intermediacao {
  id: string;
  created_at: string;
  comprador_nome: string;
  tipo_pessoa: string;
  empreendimento: string;
  unidade: string;
  vgv: number;
  valor_comissao: number;
  corretores: string[];
  arquivo_path: string;
  filename: string;
}

const ACCENT = "#4F46E5";

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const fmtData = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

export default function HistoricoIntermediacoesPage() {
  const [registros, setRegistros] = useState<Intermediacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [baixando, setBaixando] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("intermediacoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Erro ao carregar o histórico.");
      } else {
        setRegistros((data ?? []) as Intermediacao[]);
      }
      setLoading(false);
    })();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return registros;
    return registros.filter(
      (r) =>
        r.comprador_nome.toLowerCase().includes(q) ||
        r.empreendimento.toLowerCase().includes(q),
    );
  }, [registros, busca]);

  const baixar = async (r: Intermediacao) => {
    setBaixando(r.id);
    try {
      const { data, error } = await supabase.storage
        .from("intermediacoes")
        .createSignedUrl(r.arquivo_path, 300);
      if (error || !data?.signedUrl) throw error ?? new Error("URL não gerada");
      window.open(data.signedUrl, "_blank");
    } catch {
      toast.error("Não foi possível gerar o link de download.");
    } finally {
      setBaixando(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <FileSignature className="h-6 w-6" style={{ color: ACCENT }} />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Histórico de Intermediações</h1>
            <p className="text-sm text-muted-foreground">Documentos de intermediação gerados</p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link to="/intermediacao">
            <ArrowLeft className="h-4 w-4 mr-1" /> Gerar intermediação
          </Link>
        </Button>
      </header>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por comprador ou empreendimento..."
              className="pl-8"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma intermediação encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Comprador</TableHead>
                    <TableHead>Empreendimento / Unidade</TableHead>
                    <TableHead className="text-right">VGV</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead>Corretores</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">{fmtData(r.created_at)}</TableCell>
                      <TableCell className="text-sm font-medium">{r.comprador_nome}</TableCell>
                      <TableCell className="text-sm">
                        {r.empreendimento}
                        <span className="text-muted-foreground"> / {r.unidade}</span>
                      </TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap">{brl(r.vgv)}</TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap">{brl(r.valor_comissao)}</TableCell>
                      <TableCell className="text-sm">{(r.corretores ?? []).join(", ")}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => baixar(r)}
                          disabled={baixando === r.id}
                        >
                          {baixando === r.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          <span className="ml-1">Download</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
