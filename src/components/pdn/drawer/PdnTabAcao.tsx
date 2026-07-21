import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "../MoneyInput";
import { PublishButton } from "./PublishButton";
import type { PdnRow } from "@/hooks/usePdn";
import type { PubField } from "./publish";

const STATUS_PRESETS = [
  "Aguardando docs", "Em aprovação", "Negociando", "Proposta", "Follow up",
  "Em confecção", "Gerado", "Assinado",
];

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
 * Aba Ação — campos editáveis + botões "Publicar no lead".
 * Espelha os campos que apareciam no drawer legado.
 */
export function PdnTabAcao({ row, state, publishing, publishedHash, onPublish }: Props) {
  const {
    status, setStatus, obs, setObs, proxAcao, setProxAcao, proxData, setProxData,
    prioridade, setPrioridade, nome, setNome, empreend, setEmpreend, vgv, setVgv, corretor, setCorretor,
  } = state;

  return (
    <div className="space-y-4">
      {/* Overlay do gestor para negócios do pipeline */}
      {!row.isManual && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="col-span-2 space-y-1">
            <Label>Empreendimento</Label>
            <Input value={empreend} onChange={(e) => setEmpreend(e.target.value)} placeholder="Nome do empreendimento" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>VGV</Label>
            <MoneyInput value={vgv} onCommit={setVgv} variant="field" />
          </div>
          <p className="col-span-2 text-[11px] text-muted-foreground">Overlay do gestor — não altera o pipeline do corretor.</p>
        </div>
      )}

      {row.isManual && (
        <div className="grid grid-cols-2 gap-3">
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

      <div className="space-y-1">
        <Label>Status</Label>
        <Select value={status || "__none"} onValueChange={(v) => setStatus(v === "__none" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Selecionar status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Sem status</SelectItem>
            {STATUS_PRESETS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Prioridade (foco do gestor)</Label>
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
          <Input type="date" value={proxData} onChange={(e) => setProxData(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label>Próxima ação</Label>
          <PublishButton
            field="proxima_acao"
            texto={proxAcao}
            pipelineLeadId={row.pipelineLeadId}
            publishedHash={publishedHash.proxima_acao}
            busy={publishing === "proxima_acao"}
            onPublish={() => onPublish("proxima_acao", proxAcao)}
          />
        </div>
        <Input value={proxAcao} onChange={(e) => setProxAcao(e.target.value)} placeholder="O que precisa ser feito…" />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label>Observação interna</Label>
          <PublishButton
            field="observacao"
            texto={obs}
            pipelineLeadId={row.pipelineLeadId}
            publishedHash={publishedHash.observacao}
            busy={publishing === "observacao"}
            onPublish={() => onPublish("observacao", obs)}
          />
        </div>
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} className="min-h-[90px]" placeholder="Anotações do gestor (uso interno)…" />
        <p className="text-[11px] text-muted-foreground">
          "Publicar no lead" grava uma nota no histórico marcada como <span className="font-medium">[Gestor · PDN]</span>. Republicar com o mesmo texto não duplica.
        </p>
      </div>
    </div>
  );
}
