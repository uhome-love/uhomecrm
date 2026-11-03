import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { EMPREENDIMENTOS, INSTAGRAM, LISTA_TRANSMISSAO, PDFS } from "./conteudo";
import { BotoesTexto, CardArquivo, TextoMarcado, Vazio } from "./Pecas";
import { baixarMaterial, copiarTexto, type Material } from "./useMateriais";

type P = { itens: Material[]; urls: Record<string, string> };

export function AbaGrade({ itens, urls }: P) {
  if (!itens.length) return <Vazio />;
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{itens.map((m) => <CardArquivo key={m.id} m={m} url={urls[m.arquivo_path]} />)}</div>;
}

export function AbaDisparos({ itens, urls }: P) {
  return (
    <div className="space-y-4">
      <div className="natal-card space-y-2 p-4">
        <p className="font-bold">Lista de transmissão</p>
        <div className="rounded-lg bg-muted/50 p-3"><TextoMarcado texto={LISTA_TRANSMISSAO.texto} /></div>
        <ul className="list-disc pl-5 text-xs text-muted-foreground">{LISTA_TRANSMISSAO.dicas.map((d) => <li key={d}>{d}</li>)}</ul>
        <BotoesTexto texto={LISTA_TRANSMISSAO.texto} />
      </div>
      {!itens.length ? <Vazio /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {itens.map((m) => {
            const emp = EMPREENDIMENTOS.find((e) => e.arquivos.disparo.toLowerCase() === m.chave.toLowerCase());
            return (
              <div key={m.id} className="space-y-2">
                <CardArquivo m={m} url={urls[m.arquivo_path]} />
                {emp && (
                  <div className="natal-card space-y-2 p-3">
                    <TextoMarcado texto={emp.legendaDisparo} />
                    <Button size="sm" className="w-full" onClick={() => copiarTexto(emp.legendaDisparo)}>Copiar legenda</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AbaInstagram({ itens, molduras, urls }: P & { molduras: Material[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">Carrossel</h3>
        {itens.length > 0 && <Button size="sm" variant="outline" onClick={() => itens.forEach((m) => baixarMaterial(m))}><Download className="mr-1 h-4 w-4" />Baixar as {itens.length}</Button>}
      </div>
      <AbaGrade itens={itens} urls={urls} />
      <div className="natal-card space-y-2 p-4">
        <p className="font-bold">Legenda</p>
        <TextoMarcado texto={INSTAGRAM.legenda} />
        <Button size="sm" onClick={() => copiarTexto(INSTAGRAM.legenda)}>Copiar legenda</Button>
        <p className="text-xs text-muted-foreground">💡 {INSTAGRAM.dica}</p>
      </div>
      <h3 className="font-bold">Molduras</h3>
      <AbaGrade itens={molduras} urls={urls} />
    </div>
  );
}

export function AbaPdfs({ itens }: { itens: Material[] }) {
  if (!itens.length) return <Vazio />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {itens.map((m) => {
        const info = PDFS.find((p) => p.arquivo.toLowerCase() === m.chave.toLowerCase());
        return (
          <div key={m.id} className="natal-card flex items-center justify-between gap-3 p-4">
            <div><p className="font-semibold">📄 {info?.titulo ?? m.titulo}</p>{info && <p className="text-xs text-muted-foreground">{info.descricao}</p>}</div>
            <Button size="sm" onClick={() => baixarMaterial(m)}><Download className="mr-1 h-4 w-4" />Baixar</Button>
          </div>
        );
      })}
    </div>
  );
}
