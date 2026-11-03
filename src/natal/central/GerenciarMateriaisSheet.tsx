import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { lerNomeArquivo } from "./arquivos";
import { BUCKET, useInvalidarMateriais, useMateriais, type Material } from "./useMateriais";

const TIPOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
interface Envio { nome: string; status: "enviando" | "ok" | "erro"; msg?: string }

export function GerenciarMateriaisSheet() {
  const { user } = useAuth();
  const { data: lista = [] } = useMateriais(true);
  const invalidar = useInvalidarMateriais();
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [confirma, setConfirma] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const atualizar = (nome: string, e: Partial<Envio>) => setEnvios((v) => v.map((x) => (x.nome === nome ? { ...x, ...e } : x)));

  async function enviar(files: FileList | File[]) {
    const arr = Array.from(files);
    setEnvios((v) => [...arr.map((f) => ({ nome: f.name, status: "enviando" as const })), ...v.filter((x) => !arr.some((f) => f.name === x.nome))]);
    for (const f of arr) {
      const lido = lerNomeArquivo(f.name);
      if (!lido) { atualizar(f.name, { status: "erro", msg: "nome fora do padrão" }); continue; }
      if (!TIPOS.includes(f.type) || f.size > 25 * 1024 * 1024) { atualizar(f.name, { status: "erro", msg: "tipo ou tamanho inválido (até 25 MB)" }); continue; }
      const up = await supabase.storage.from(BUCKET).upload(lido.caminho, f, { upsert: true, contentType: f.type });
      if (up.error) { atualizar(f.name, { status: "erro", msg: up.error.message }); continue; }
      const { error } = await supabase.from("natal_materiais").upsert({
        chave: lido.chave, secao: lido.secao, ordem: lido.ordem, titulo: lido.titulo,
        arquivo_path: lido.caminho, mime: f.type, tamanho_bytes: f.size, created_by: user?.id ?? null, updated_at: new Date().toISOString(),
      }, { onConflict: "chave" });
      atualizar(f.name, error ? { status: "erro", msg: error.message } : { status: "ok" });
    }
    invalidar();
  }

  async function alternar(m: Material, ativo: boolean) {
    const { error } = await supabase.from("natal_materiais").update({ ativo, updated_at: new Date().toISOString() }).eq("id", m.id);
    if (error) toast.error(error.message); else invalidar();
  }
  async function apagar(m: Material) {
    if (!window.confirm(`Apagar ${m.chave}?`)) return;
    await supabase.storage.from(BUCKET).remove([m.arquivo_path]);
    const { error } = await supabase.from("natal_materiais").delete().eq("id", m.id);
    if (error) toast.error(error.message); else invalidar();
  }
  async function apagarTudo() {
    const { data, error } = await supabase.functions.invoke("natal-central-limpeza", { body: { forcar: true } });
    if (error || !data?.ok) toast.error("Não foi possível apagar."); else toast.success(`Apagados ${data.arquivos} arquivos.`);
    setConfirma(""); invalidar();
  }

  return (
    <Sheet>
      <SheetTrigger asChild><Button variant="outline" size="sm">Gerenciar materiais</Button></SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>Gerenciar materiais</SheetTitle></SheetHeader>
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastando(false); enviar(e.dataTransfer.files); }}
          className={`mt-4 rounded-xl border-2 border-dashed p-6 text-center text-sm ${arrastando ? "border-primary bg-primary/5" : ""}`}
        >
          <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p>Arraste os arquivos aqui</p>
          <Button size="sm" className="mt-2" onClick={() => input.current?.click()}>Escolher arquivos</Button>
          <p className="mt-2 text-xs text-muted-foreground">JPG, PNG, WEBP ou PDF até 25 MB. O nome do arquivo define a seção (ex.: CARD-01-Open_Bosque.jpg).</p>
          <input ref={input} type="file" multiple hidden accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => e.target.files && enviar(e.target.files)} />
        </div>
        {envios.length > 0 && (
          <ul className="mt-3 space-y-2 text-xs">
            {envios.map((e) => (
              <li key={e.nome}>
                <div className="flex justify-between"><span className="truncate">{e.nome}</span><span className={e.status === "erro" ? "text-destructive" : ""}>{e.status === "ok" ? "✅" : e.status === "erro" ? e.msg : "enviando…"}</span></div>
                {e.status === "enviando" && <Progress value={50} className="h-1" />}
              </li>
            ))}
          </ul>
        )}
        <h4 className="mt-6 text-sm font-bold">Na Campanha ({lista.length})</h4>
        <ul className="mt-2 divide-y text-xs">
          {lista.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-2">
              <span className="w-16 shrink-0 text-muted-foreground">{m.secao}</span>
              <span className="min-w-0 flex-1 truncate"><b>{m.titulo}</b> · {m.chave}</span>
              <Switch checked={m.ativo} onCheckedChange={(v) => alternar(m, v)} aria-label="Ativo" />
              <Button size="icon" variant="ghost" aria-label="Apagar" onClick={() => apagar(m)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
        <div className="mt-6 space-y-2 rounded-xl border border-destructive/40 p-3">
          <p className="text-xs">Para apagar tudo agora, digite <b>APAGAR</b>:</p>
          <Input value={confirma} onChange={(e) => setConfirma(e.target.value)} />
          <Button variant="destructive" size="sm" className="w-full" disabled={confirma !== "APAGAR"} onClick={apagarTudo}>Apagar todos os materiais agora</Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Os arquivos são apagados sozinhos em 27/12/2026.</p>
      </SheetContent>
    </Sheet>
  );
}
