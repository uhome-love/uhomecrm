import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { format, addDays, startOfDay, endOfDay } from "date-fns";

interface Props {
  onSubmit: (desafio: any) => void;
  isLoading: boolean;
}

const TEMPLATES = [
  { titulo: "Blitz de Segunda", descricao: "Bora começar a semana forte!", metrica: "ligacoes", meta: 200, duracao: "hoje" },
  { titulo: "Sprint Semanal", descricao: "30 visitas para dominar!", metrica: "visitas", meta: 30, duracao: "semana" },
  { titulo: "Caça ao Negócio", descricao: "5 negócios fechados, quem consegue?", metrica: "negocios", meta: 5, duracao: "semana" },
];

export default function PulseDesafioForm({ onSubmit, isLoading }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [metrica, setMetrica] = useState("ligacoes");
  const [meta, setMeta] = useState(100);
  const [tipo, setTipo] = useState("time_inteiro");
  const [recompensa, setRecompensa] = useState("");

  const handleTemplate = (t: typeof TEMPLATES[0]) => {
    setTitulo(t.titulo);
    setDescricao(t.descricao);
    setMetrica(t.metrica);
    setMeta(t.meta);
  };

  const handleSubmit = () => {
    if (!titulo || !user) return;
    const now = new Date();
    onSubmit({
      titulo,
      descricao,
      metrica,
      meta,
      tipo,
      criado_por: user.id,
      data_inicio: now.toISOString(),
      data_fim: endOfDay(addDays(now, tipo === "time_inteiro" ? 0 : 6)).toISOString(),
      recompensa_badge: recompensa || null,
    });
    setOpen(false);
    setTitulo(""); setDescricao(""); setMeta(100); setRecompensa("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
          🏆 Lançar Desafio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">🏆 Novo Desafio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Templates */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Templates rápidos:</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <Button key={t.titulo} variant="outline" size="sm" className="text-xs h-7" onClick={() => handleTemplate(t)}>
                  {t.titulo}
                </Button>
              ))}
            </div>
          </div>

          <Input placeholder="Título do desafio" value={titulo} onChange={e => setTitulo(e.target.value)} />
          <Textarea placeholder="Descrição motivacional (máx 140 chars)" maxLength={140} value={descricao} onChange={e => setDescricao(e.target.value)} className="h-16" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Métrica</label>
              <Select value={metrica} onValueChange={setMetrica}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ligacoes">📞 Ligações</SelectItem>
                  <SelectItem value="visitas">🏠 Visitas</SelectItem>
                  <SelectItem value="negocios">💰 Negócios</SelectItem>
                  <SelectItem value="misto">📊 Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Meta</label>
              <Input type="number" value={meta} onChange={e => setMeta(Number(e.target.value))} className="h-9" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="time_inteiro">Time Inteiro</SelectItem>
                  <SelectItem value="por_equipe">Por Equipe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Recompensa</label>
              <Input placeholder="Ex: Badge MVP" value={recompensa} onChange={e => setRecompensa(e.target.value)} className="h-9" />
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={!titulo || isLoading} className="w-full">
            {isLoading ? "Criando..." : "🚀 Lançar Desafio"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
