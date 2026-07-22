import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "../MoneyInput";
import type { PdnRow } from "@/hooks/usePdn";
import type { PubField } from "./publish";

export interface AcaoState {
  status: string; setStatus: (v: string) => void;
  obs: string; setObs: (v: string) => void;
  proxAcao: string; setProxAcao: (v: string) => void;
  proxData: string; setProxData: (v: string) => void;
  prioridade: string; setPrioridade: (v: string) => void;
  nome: string; setNome: (v: string) => void;
  empreend: string; setEmpreend: (v: string) => void;
  vgv: number; setVgv: (v: number) => void;
  corretor: string; setCorretor: (v: string) => void;
}

interface Props {
  row: PdnRow;
  state: AcaoState;
  publishing: PubField | null;
  publishedHash: Record<PubField, string | null>;
  onPublish: (field: PubField, texto: string) => void;
}

/**
 * Aba Ação — foco em campos que NÃO existem inline na planilha:
 * próxima ação, prioridade e observação.
 * Status, Empreendimento e VGV são editados direto na planilha/kanban.
 * Publicação da observação acontece pelo botão do footer do drawer.
 */
export function PdnTabAcao({ row, state }: Props) {
  const {
    obs, setObs, proxAcao, setProxAcao, proxData, setProxData,
    prioridade, setPrioridade, nome, setNome, empreend, setEmpreend, vgv, setVgv, corretor, setCorretor,
  } = state;

  return (
    <div className="space-y-4">
      {row.isManual && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="col-span-2 space-y-1">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Empreendimento</Label>
            <Input value={empreend} onChange={(e) => setEmpreend(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>VGV</Label>
            <MoneyInput value={vgv} onCommit={setVgv} variant="field" />
          </div>
          <div className="space-y-1">
            <Label>Corretor</Label>
            <Input value={corretor} onChange={(e) => setCorretor(e.target.value)} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Prioridade</Label>
          <Select value={prioridade || "__none"} onValueChange={(v) => setPrioridade(v === "__none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Sem prioridade</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Próxima ação (data)</Label>
          <Input
            type="date"
            value={proxData}
            onChange={(e) => setProxData(e.target.value)}
            lang="pt-BR"
            placeholder="dd/mm/aaaa"
            className="[&::-webkit-datetime-edit]:text-foreground"
          />
          {!proxData && (
            <p className="text-[11px] text-muted-foreground">Formato: dd/mm/aaaa</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label>Próxima ação</Label>
        <Input value={proxAcao} onChange={(e) => setProxAcao(e.target.value)} placeholder="O que precisa ser feito…" />
      </div>

      <div className="space-y-1">
        <Label>Observação</Label>
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} className="min-h-[110px]" placeholder="Anotações do gestor…" />
        <p className="text-[11px] text-muted-foreground">
          Use <span className="font-medium">Salvar e publicar</span> no rodapé para gravar a observação no histórico do lead e avisar o corretor automaticamente.
        </p>
      </div>
    </div>
  );
}
