import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, Bot, Clock, CheckCircle, XCircle, PhoneOff, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface AiCallEntry {
  id: string;
  telefone: string;
  nome_lead: string | null;
  empreendimento: string | null;
  status: string;
  duracao_segundos: number | null;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  initiated: { label: "Iniciada", icon: Phone, color: "text-blue-500" },
  ringing: { label: "Chamando", icon: Phone, color: "text-amber-500" },
  "in-progress": { label: "Em andamento", icon: Bot, color: "text-emerald-500" },
  completed: { label: "Concluída", icon: CheckCircle, color: "text-emerald-600" },
  busy: { label: "Ocupado", icon: PhoneOff, color: "text-amber-600" },
  "no-answer": { label: "Sem resposta", icon: XCircle, color: "text-destructive" },
  failed: { label: "Falhou", icon: XCircle, color: "text-destructive" },
  canceled: { label: "Cancelada", icon: XCircle, color: "text-muted-foreground" },
};

export default function AiCallPanel() {
  const [phone, setPhone] = useState("");
  const [nome, setNome] = useState("");
  const [calling, setCalling] = useState(false);
  const [recentCalls, setRecentCalls] = useState<AiCallEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadRecent = useCallback(async () => {
    const { data } = await supabase
      .from("ai_calls")
      .select("id, telefone, nome_lead, empreendimento, status, duracao_segundos, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setRecentCalls(data as AiCallEntry[]);
    setLoaded(true);
  }, []);

  if (!loaded) loadRecent();

  const handleCall = async () => {
    if (!phone.trim()) {
      toast.error("Informe o telefone");
      return;
    }
    setCalling(true);
    try {
      const { data, error } = await supabase.functions.invoke("twilio-ai-call", {
        body: { telefone: phone, nome, empreendimento: "" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`📞 Ligação iniciada! SID: ${data.call_sid?.slice(-8)}`);
      setPhone("");
      setNome("");
      setTimeout(loadRecent, 2000);
    } catch (err: any) {
      toast.error(`Erro: ${err.message || "Falha ao iniciar ligação"}`);
    } finally {
      setCalling(false);
    }
  };

  const formatDuration = (s: number | null) => {
    if (!s) return "-";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          Discagem IA (Twilio + ElevenLabs)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick dial form */}
        <div className="flex gap-2">
          <Input
            placeholder="Telefone (ex: 51999999999)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Nome (opcional)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-40"
          />
          <Button
            onClick={handleCall}
            disabled={calling || !phone.trim()}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          >
            {calling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Phone className="h-4 w-4" />
            )}
            {calling ? "Ligando..." : "Ligar com IA"}
          </Button>
        </div>

        {/* Recent calls */}
        {recentCalls.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Ligações recentes</p>
            <div className="space-y-1.5">
              {recentCalls.map((call) => {
                const st = STATUS_MAP[call.status] || STATUS_MAP.initiated;
                const StIcon = st.icon;
                return (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <StIcon className={`h-3.5 w-3.5 ${st.color}`} />
                      <span className="font-medium">{call.nome_lead || call.telefone}</span>
                      {call.nome_lead && (
                        <span className="text-xs text-muted-foreground">{call.telefone}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {st.label}
                      </Badge>
                      {call.duracao_segundos && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(call.duracao_segundos)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
