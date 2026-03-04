import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, History } from "lucide-react";
import { format } from "date-fns";

interface LogEntry {
  id: string;
  created_at: string;
  modulo: string;
  acao: string;
  chave_unica: string | null;
  descricao: string | null;
  origem: string | null;
}

export function AuditLogPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterMod, setFilterMod] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, [filterMod]);

  const loadLogs = async () => {
    setLoading(true);
    let query = supabase
      .from("audit_log")
      .select("id, created_at, modulo, acao, chave_unica, descricao, origem")
      .order("created_at", { ascending: false })
      .limit(100);
    if (filterMod && filterMod !== "all") query = query.eq("modulo", filterMod);
    const { data } = await query;
    setLogs((data as LogEntry[]) || []);
    setLoading(false);
  };

  const exportCsv = () => {
    const header = "Data,Módulo,Ação,Chave,Descrição,Origem\n";
    const rows = logs.map((l) =>
      `"${l.created_at}","${l.modulo}","${l.acao}","${l.chave_unica || ""}","${(l.descricao || "").replace(/"/g, '""')}","${l.origem || ""}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const actionColors: Record<string, string> = {
    create: "bg-green-500/10 text-green-700",
    update: "bg-blue-500/10 text-blue-700",
    delete: "bg-red-500/10 text-red-700",
    merge: "bg-purple-500/10 text-purple-700",
    import: "bg-yellow-500/10 text-yellow-700",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Log de Auditoria
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filterMod} onValueChange={setFilterMod}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos módulos</SelectItem>
                <SelectItem value="Checkpoint">Checkpoint</SelectItem>
                <SelectItem value="Funil">Funil</SelectItem>
                <SelectItem value="PDN">PDN</SelectItem>
                <SelectItem value="Leads">Leads</SelectItem>
                <SelectItem value="Relatórios">Relatórios</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="text-xs" onClick={exportCsv}>
              <FileDown className="h-3.5 w-3.5 mr-1" /> CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {loading ? "Carregando..." : "Nenhum registro de auditoria encontrado."}
          </p>
        ) : (
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Módulo</TableHead>
                  <TableHead className="text-xs">Ação</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs">Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(l.created_at), "dd/MM HH:mm")}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{l.modulo}</Badge></TableCell>
                    <TableCell>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${actionColors[l.acao] || ""}`}>
                        {l.acao}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs max-w-[300px] truncate">{l.descricao || "—"}</TableCell>
                    <TableCell className="text-xs">{l.origem || "—"}</TableCell>
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
