import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Copy, CheckCircle, XCircle, Layers, BarChart3, Plug, Bug } from "lucide-react";
import type { AuditIssue } from "@/hooks/useAudit";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const typeIcons: Record<string, any> = {
  duplication: Layers,
  consistency: BarChart3,
  integration: Plug,
  error: Bug,
};
const typeLabels: Record<string, string> = {
  duplication: "Duplicação",
  consistency: "Consistência",
  integration: "Integração",
  error: "Erro",
};
const sevColors: Record<string, string> = {
  alto: "destructive",
  medio: "secondary",
  baixo: "outline",
};

export function IssuesList({ issues, onAutoFix }: { issues: AuditIssue[]; onAutoFix?: (issue: AuditIssue) => void }) {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? issues : issues.filter((i) => i.type === filter);
  const types = ["all", "duplication", "consistency", "integration", "error"];

  const counts: Record<string, number> = {};
  for (const i of issues) counts[i.type] = (counts[i.type] || 0) + 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Problemas Encontrados ({issues.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="mb-3">
            <TabsTrigger value="all">Todos ({issues.length})</TabsTrigger>
            {types.slice(1).map((t) => (
              counts[t] ? (
                <TabsTrigger key={t} value={t}>
                  {typeLabels[t]} ({counts[t]})
                </TabsTrigger>
              ) : null
            ))}
          </TabsList>
        </Tabs>

        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm">Nenhum problema encontrado nesta categoria.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((issue) => {
              const Icon = typeIcons[issue.type] || Bug;
              return (
                <div key={issue.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{issue.title}</span>
                      <Badge variant={sevColors[issue.severity] as any} className="text-[10px]">
                        {issue.severity}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{issue.module}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{issue.description}</p>
                    {issue.ids && (
                      <p className="text-[10px] text-muted-foreground mt-1">{issue.ids.length} registro(s) afetado(s)</p>
                    )}
                  </div>
                  {issue.autoFixable && onAutoFix && (
                    <Button size="sm" variant="outline" className="text-xs shrink-0" onClick={() => onAutoFix(issue)}>
                      Corrigir
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
