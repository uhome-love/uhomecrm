/**
 * CampaignAnalyticsPage — Admin dashboard for SMS campaign tracking
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, MousePointerClick, UserPlus, RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClickStats {
  total_clicks: number;
  leads_created: number;
  leads_updated: number;
  redirected: number;
  errors: number;
}

interface ClickRow {
  id: string;
  telefone: string | null;
  nome: string | null;
  status: string;
  lead_action: string | null;
  canal: string;
  utm_source: string | null;
  created_at: string;
  error_message: string | null;
}

export default function CampaignAnalyticsPage() {
  const { data: clicks, isLoading, refetch } = useQuery({
    queryKey: ["campaign-clicks-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_clicks")
        .select("*")
        .eq("campanha", "MELNICK_DAY_POA_2026")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as ClickRow[];
    },
    refetchInterval: 30_000,
  });

  const stats: ClickStats = {
    total_clicks: clicks?.length || 0,
    leads_created: clicks?.filter(c => c.lead_action === "created").length || 0,
    leads_updated: clicks?.filter(c => c.lead_action === "updated").length || 0,
    redirected: clicks?.filter(c => c.status !== "error").length || 0,
    errors: clicks?.filter(c => c.status === "error").length || 0,
  };

  const redirectRate = stats.total_clicks > 0
    ? ((stats.redirected / stats.total_clicks) * 100).toFixed(1)
    : "0";

  const COUNTERS = [
    { label: "Total de Cliques", value: stats.total_clicks, icon: MousePointerClick, color: "text-blue-500" },
    { label: "Leads Criados", value: stats.leads_created, icon: UserPlus, color: "text-emerald-500" },
    { label: "Leads Atualizados", value: stats.leads_updated, icon: RefreshCw, color: "text-amber-500" },
    { label: "Redirecionamentos", value: `${stats.redirected} (${redirectRate}%)`, icon: ExternalLink, color: "text-purple-500" },
    { label: "Erros", value: stats.errors, icon: AlertTriangle, color: "text-red-500" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📊 Campaign Analytics — SMS Melnick Day</h1>
          <p className="text-sm text-muted-foreground">
            Campanha Brevo · MELNICK_DAY_POA_2026
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {COUNTERS.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Brevo URL Reference */}
      <Card className="bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">🔗 URL para usar no Brevo</CardTitle>
        </CardHeader>
        <CardContent>
          <code className="text-xs bg-background px-3 py-2 rounded block break-all border">
            {"https://uhomesales.com/melnickday?phone={{ contact.SMS }}&nome={{ contact.FIRSTNAME }}&utm_source=brevo&utm_medium=sms&utm_campaign=melnick_day_poa_2026"}
          </code>
        </CardContent>
      </Card>

      {/* Recent Clicks Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Últimos Cliques</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horário</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(clicks || []).slice(0, 100).map((click) => (
                  <TableRow key={click.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(click.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-xs">{click.nome || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{click.telefone || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={click.status === "error" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {click.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {click.lead_action === "created" && <span className="text-emerald-600 font-medium">Novo</span>}
                      {click.lead_action === "updated" && <span className="text-amber-600 font-medium">Atualizado</span>}
                      {click.lead_action === "none" && <span className="text-muted-foreground">—</span>}
                      {!click.lead_action && "—"}
                    </TableCell>
                    <TableCell className="text-xs">{click.utm_source || click.canal}</TableCell>
                    <TableCell className="text-xs text-red-500 max-w-[200px] truncate">
                      {click.error_message || ""}
                    </TableCell>
                  </TableRow>
                ))}
                {(!clicks || clicks.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum clique registrado ainda
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
