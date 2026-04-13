import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Mail, Plus, Check, X, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Cadencia {
  id: string;
  stage_tipo: string;
  step_number: number;
  delay_dias: number;
  canal: string;
  template_name: string;
  descricao: string | null;
  is_active: boolean;
}

export default function CadenciasTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [editDelay, setEditDelay] = useState(0);
  const [editTemplate, setEditTemplate] = useState("");

  const { data: cadencias = [], isLoading } = useQuery({
    queryKey: ["nurturing-cadencias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nurturing_cadencias")
        .select("*")
        .order("stage_tipo")
        .order("step_number");
      if (error) throw error;
      return data as Cadencia[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, delay_dias, template_name }: { id: string; delay_dias: number; template_name: string }) => {
      const { error } = await supabase
        .from("nurturing_cadencias")
        .update({ delay_dias, template_name })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nurturing-cadencias"] });
      setEditing(null);
      toast.success("Passo atualizado");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const grouped = cadencias.reduce<Record<string, Cadencia[]>>((acc, c) => {
    (acc[c.stage_tipo] ||= []).push(c);
    return acc;
  }, {});

  const stageTipoLabel: Record<string, string> = {
    descarte_reengajamento: "Reengajamento Geral",
    descarte_reengajamento_financeiro: "Reengajamento Financeiro",
  };

  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando cadências...</div>;

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([stageTipo, steps]) => (
        <Card key={stageTipo}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">{stageTipo}</Badge>
              <span>{stageTipoLabel[stageTipo] || stageTipo}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative pl-6 border-l-2 border-muted space-y-4">
              {steps.map((step) => {
                const isEditing = editing === step.id;
                return (
                  <div key={step.id} className="relative">
                    <div className="absolute -left-[calc(1.5rem+1px)] top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                        {step.canal === "whatsapp" ? (
                          <MessageCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <Mail className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span>Passo {step.step_number}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            D+{step.delay_dias}
                          </Badge>
                          <Badge variant={step.canal === "whatsapp" ? "default" : "outline"} className="text-[10px]">
                            {step.canal}
                          </Badge>
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-2 mt-2">
                            <Input
                              type="number"
                              value={editDelay}
                              onChange={(e) => setEditDelay(Number(e.target.value))}
                              className="w-20 h-7 text-xs"
                              placeholder="Dias"
                            />
                            <Input
                              value={editTemplate}
                              onChange={(e) => setEditTemplate(e.target.value)}
                              className="flex-1 h-7 text-xs"
                              placeholder="Template name"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => updateMutation.mutate({ id: step.id, delay_dias: editDelay, template_name: editTemplate })}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{step.template_name}</p>
                            {step.descricao && <p className="text-xs text-muted-foreground mt-0.5">{step.descricao}</p>}
                          </>
                        )}
                      </div>
                      {!isEditing && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          onClick={() => {
                            setEditing(step.id);
                            setEditDelay(step.delay_dias);
                            setEditTemplate(step.template_name);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
