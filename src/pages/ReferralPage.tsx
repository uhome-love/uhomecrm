import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Gift, Loader2, Home, AlertCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function ReferralPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [clienteNome, setClienteNome] = useState("");
  const [referralId, setReferralId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [interesse, setInteresse] = useState("");

  useEffect(() => {
    if (!codigo) return;
    fetch(`${SUPABASE_URL}/functions/v1/referral-public?codigo=${encodeURIComponent(codigo)}`, {
      headers: { apikey: SUPABASE_KEY },
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setClienteNome(data.cliente_nome);
          setReferralId(data.referral_id);
        }
      })
      .catch(() => setError("Erro ao carregar dados"))
      .finally(() => setLoading(false));
  }, [codigo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || (!telefone.trim() && !email.trim())) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/referral-public`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ referral_id: referralId, nome: nome.trim(), telefone: telefone.trim(), email: email.trim(), interesse: interesse.trim() }),
      });
      const data = await res.json();
      if (data.success) setSubmitted(true);
      else setError(data.error || "Erro ao enviar");
    } catch {
      setError("Erro de conexão");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error && !referralId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
            <h1 className="text-xl font-bold text-gray-800">Link inválido</h1>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Obrigado! 🎉</h1>
            <p className="text-gray-600">
              Sua indicação foi recebida com sucesso. Um especialista entrará em contato em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl border-0">
        <CardContent className="p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto">
              <Home className="h-7 w-7 text-orange-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Uhome Sales</h1>
            <div className="bg-orange-50 rounded-xl p-3">
              <p className="text-sm text-orange-700">
                Você foi indicado por <strong>{clienteNome}</strong> 🏠
              </p>
            </div>
            <p className="text-sm text-gray-500">
              Preencha seus dados e um especialista entrará em contato para ajudá-lo a encontrar o imóvel ideal.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Seu nome *</Label>
              <Input id="nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone *</Label>
              <Input id="telefone" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" maxLength={255} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interesse">O que você procura?</Label>
              <Textarea id="interesse" value={interesse} onChange={e => setInteresse(e.target.value)} placeholder="Ex: Apartamento 2 quartos na região central..." maxLength={500} rows={3} />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="w-full h-12 text-base font-bold bg-orange-500 hover:bg-orange-600" disabled={submitting || !nome.trim() || (!telefone.trim() && !email.trim())}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                <Gift className="h-4 w-4 mr-2" /> Enviar indicação
              </>}
            </Button>
          </form>

          <p className="text-[10px] text-center text-gray-400">
            Ao enviar, você concorda que um especialista entre em contato.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
