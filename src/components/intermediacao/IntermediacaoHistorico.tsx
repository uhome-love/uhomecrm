import {useState,useEffect,useMemo} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Card,CardContent} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "@/components/ui/table";
import {AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle,AlertDialogTrigger} from "@/components/ui/alert-dialog";
import {toast} from "sonner";
import {Search,Loader2,Pencil,Download,Trash2} from "lucide-react";
import {brl} from "./IntermediacaoCampos";
// ─── Aba Histórico ──────────────────────────────────────────────────────────────
interface IntermediacaoRegistro {
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
  payload: any;
  negocio_id: string|null;
  origem: string;
}

const fmtDataHist = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

export function HistoricoTab({ onEditar }: { onEditar: (payload: any) => void }) {
  const [registros, setRegistros] = useState<IntermediacaoRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [baixando, setBaixando] = useState<string | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);

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
        setRegistros((data ?? []) as IntermediacaoRegistro[]);
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

  const baixar = async (r: IntermediacaoRegistro) => {
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

  const apagar = async (r: IntermediacaoRegistro) => {
    setApagando(r.id);
    try {
      if (r.arquivo_path) {
        await supabase.storage.from("intermediacoes").remove([r.arquivo_path]);
      }
      const { error } = await supabase.from("intermediacoes").delete().eq("id", r.id);
      if (error) throw error;
      setRegistros((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Intermediação apagada.");
    } catch {
      toast.error("Não foi possível apagar a intermediação.");
    } finally {
      setApagando(null);
    }
  };

  return (
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
                    <TableCell className="whitespace-nowrap text-sm">{fmtDataHist(r.created_at)}</TableCell>
                    <TableCell className="text-sm font-medium">{r.comprador_nome}</TableCell>
                    <TableCell className="text-sm">
                      {r.empreendimento}
                      <span className="text-muted-foreground"> / {r.unidade}</span>
                    </TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">{brl(r.vgv)}</TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">{brl(r.valor_comissao)}</TableCell>
                    <TableCell className="text-sm">{(r.corretores ?? []).join(", ")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEditar(r.payload)}
                          disabled={!r.payload || r.payload.importacaoHistorica === true}
                          title={r.payload?.importacaoHistorica ? "Documento histórico: divisão original preservada" : r.payload ? "Editar e gerar novamente" : "Registro antigo sem dados para edição"}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="ml-1">Editar</span>
                        </Button>
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
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={apagando === r.id || !!r.negocio_id || r.origem === "drive_historico"}
                            >
                              {apagando === r.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Apagar intermediação?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação remove permanentemente o registro de{" "}
                                <strong>{r.comprador_nome}</strong> e o documento gerado. Não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => apagar(r)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Apagar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
