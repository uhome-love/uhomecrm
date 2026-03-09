import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send, FileText } from "lucide-react";

export default function TesteWhatsApp() {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; data: any } | null>(null);

  const handleTest = async () => {
    setLoading("text");
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: {
          telefone: "5551992597097",
          mensagem: "Teste UhomeSales - WhatsApp funcionando!",
          nome: "Lucas",
        },
      });
      if (error) {
        setResult({ success: false, data: { error: error.message, raw: error } });
      } else {
        setResult({ success: !!data?.success, data });
      }
    } catch (e: any) {
      setResult({ success: false, data: { error: e.message } });
    } finally {
      setLoading(null);
    }
  };

  const handleTestTemplate = async () => {
    setLoading("template");
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: {
          telefone: "5551992597097",
          template: {
            name: "novo_lead",
            language: "pt_BR",
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: "Lucas Teste" },
                  { type: "text", text: "51992597097" },
                  { type: "text", text: "lucas@uhome.imb.br" },
                  { type: "text", text: "Alfa Empreendimento" },
                ],
              },
            ],
          },
        },
      });
      if (error) {
        setResult({ success: false, data: { error: error.message, raw: error } });
      } else {
        setResult({ success: !!data?.success, data });
      }
    } catch (e: any) {
      setResult({ success: false, data: { error: e.message } });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">🧪 Teste WhatsApp</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Enviar mensagem de teste</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Telefone: 5551992597097 · Mensagem: "Teste UhomeSales - WhatsApp funcionando!"
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleTest} disabled={!!loading} className="gap-2">
              {loading === "text" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Testar Envio WhatsApp
            </Button>
            <Button onClick={handleTestTemplate} disabled={!!loading} variant="outline" className="gap-2">
              {loading === "template" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Testar com Template
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className={result.success ? "border-green-500" : "border-red-500"}>
          <CardContent className="pt-4">
            <p className={`text-sm font-semibold mb-2 ${result.success ? "text-green-600" : "text-red-600"}`}>
              {result.success ? "✅ Sucesso!" : "❌ Erro"}
            </p>
            <pre className="text-[11px] bg-muted p-3 rounded overflow-auto max-h-60 whitespace-pre-wrap">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
