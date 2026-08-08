import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, ExternalLink } from "lucide-react";
import type { PdnGrupo, PdnRow } from "@/hooks/usePdn";
import type { PdnSavePatch } from "../PdnKanban";
import { PdnTabAcao } from "./PdnTabAcao";
import { PdnTabEtapa } from "./PdnTabEtapa";
import { loadPublishedHashes, publicarNoLead, type PubField } from "./publish";

interface Props {
  row: PdnRow | null;
  onClose: () => void;
  onSave: (row: PdnRow, patch: PdnSavePatch) => void;
  onRemove: (row: PdnRow) => void;
  onQueda: (row: PdnRow) => void;
  onReativar: (row: PdnRow) => void;
  onMudarEtapa: (row: PdnRow, grupo: PdnGrupo) => void;
  onLimparEtapa: (row: PdnRow) => void;
  onAvisar: (row: PdnRow, mensagem: string) => void;
  defaultTab?: "acao" | "etapa";
}

/**
 * Drawer unificado do PDN — usado tanto pela visão Kanban quanto pela Planilha.
 * Substitui o `PdnCardDrawer` legado, quebrando o conteúdo em 3 abas:
 *   - Contexto: leitura + timeline canônica do lead
 *   - Ação:     campos editáveis + publicar no histórico do lead
 *   - Etapa:    mover no PDN, avisar corretor, marcar risco/queda, remover
 */
export function PdnLeadDrawer({
  row, onClose, onSave, onRemove, onQueda, onReativar, onMudarEtapa, onLimparEtapa, onAvisar,
  defaultTab = "acao",
}: Props) {
  const [status, setStatus] = useState("");
  const [obs, setObs] = useState("");
  const [publishing, setPublishing] = useState<PubField | null>(null);
  const [publishedHash, setPublishedHash] = useState<Record<PubField, string | null>>({ observacao: null, proxima_acao: null });
  const [tab, setTab] = useState<string>(defaultTab);

  // Só reseta o estado quando o lead efetivamente mudar (id diferente).
  // Sem isso, toda atualização de dados (realtime/refresh) recria o objeto row
  // e faz o drawer "pular" de aba e resetar campos que o usuário está editando.
  const rowId = row?.id ?? null;
  useEffect(() => {
    if (!row) return;
    setStatus(row.status || "");
    setObs(row.observacoes || "");
    setPublishedHash({ observacao: null, proxima_acao: null });
    setTab(defaultTab);
    if (row.pipelineLeadId) {
      loadPublishedHashes(row.pipelineLeadId).then(setPublishedHash).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId, defaultTab]);

  if (!row) return null;

  const save = () => {
    onSave(row, { status, observacoes: obs });
    onClose();
  };

  const saveAndPublish = async () => {
    if (!row.pipelineLeadId) { save(); return; }
    // salva overlay
    onSave(row, { status, observacoes: obs });
    setPublishing("observacao");
    try {
      const hash = await publicarNoLead(row.pipelineLeadId, "observacao", obs, row);
      if (hash) setPublishedHash(prev => ({ ...prev, observacao: hash }));
    } finally {
      setPublishing(null);
      onClose();
    }
  };

  const handlePublish = async (field: PubField, texto: string) => {
    if (!row.pipelineLeadId) return;
    setPublishing(field);
    try {
      const hash = await publicarNoLead(row.pipelineLeadId, field, texto, row);
      if (hash) {
        setPublishedHash(prev => ({ ...prev, [field]: hash }));
        onSave(row, { observacoes: texto.trim() });
      }
    } finally {
      setPublishing(null);
    }
  };

  const canPublish = !!row.pipelineLeadId && !!obs.trim();
  const publishedSame = publishedHash.observacao && obs.trim().length > 0;

  return (
    <Sheet open={!!row} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {row.emRisco && <AlertTriangle className="h-4 w-4 text-amber-500" />}
            {row.nome}
          </SheetTitle>
          {row.pipelineLeadId && (
            <a
              href={`/pipeline?lead=${row.pipelineLeadId}`}
              className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir no pipeline (dados, timeline e tarefas)
            </a>
          )}
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-3 flex min-h-0 flex-1 flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="acao">Anotação</TabsTrigger>
            <TabsTrigger value="etapa">Etapa</TabsTrigger>
          </TabsList>
          <div className="mt-3 flex-1 overflow-y-auto pr-1">
            <TabsContent value="acao" className="m-0">
              <PdnTabAcao row={row} state={{ status, setStatus, obs, setObs }} />
            </TabsContent>
            <TabsContent value="etapa" className="m-0">
              <PdnTabEtapa
                row={row}
                onMudarEtapa={onMudarEtapa}
                onLimparEtapa={onLimparEtapa}
                onAvisar={onAvisar}
                onQueda={onQueda}
                onReativar={onReativar}
                onRemove={onRemove}
                onClose={onClose}
              />
            </TabsContent>
          </div>
        </Tabs>

        <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="outline" onClick={save} disabled={!!publishing}>Salvar</Button>
          {canPublish && (
            <Button onClick={saveAndPublish} disabled={!!publishing}>
              {publishing === "observacao"
                ? "Publicando…"
                : publishedSame ? "Salvar e republicar" : "Salvar e publicar"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

