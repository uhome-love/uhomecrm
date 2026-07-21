import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import type { PdnGrupo, PdnRow } from "@/hooks/usePdn";
import type { PdnSavePatch } from "../PdnKanban";
import { PdnTabContexto } from "./PdnTabContexto";
import { PdnTabAcao } from "./PdnTabAcao";
import { PdnTabEtapa } from "./PdnTabEtapa";
import { loadPublishedHashes, publicarNoLead, type PubField } from "./publish";

interface Props {
  row: PdnRow | null;
  onClose: () => void;
  onSave: (row: PdnRow, patch: PdnSavePatch) => void;
  onUpdateManual: (overrideId: string, patch: Record<string, unknown>) => void;
  onRemove: (row: PdnRow) => void;
  onQueda: (row: PdnRow) => void;
  onReativar: (row: PdnRow) => void;
  onMudarEtapa: (row: PdnRow, grupo: PdnGrupo) => void;
  onLimparEtapa: (row: PdnRow) => void;
  onAvisar: (row: PdnRow, mensagem: string) => void;
  defaultTab?: "contexto" | "acao" | "etapa";
}

/**
 * Drawer unificado do PDN — usado tanto pela visão Kanban quanto pela Planilha.
 * Substitui o `PdnCardDrawer` legado, quebrando o conteúdo em 3 abas:
 *   - Contexto: leitura + timeline canônica do lead
 *   - Ação:     campos editáveis + publicar no histórico do lead
 *   - Etapa:    mover no PDN, avisar corretor, marcar risco/queda, remover
 */
export function PdnLeadDrawer({
  row, onClose, onSave, onUpdateManual, onRemove, onQueda, onReativar, onMudarEtapa, onLimparEtapa, onAvisar,
  defaultTab = "acao",
}: Props) {
  const [status, setStatus] = useState("");
  const [obs, setObs] = useState("");
  const [proxAcao, setProxAcao] = useState("");
  const [proxData, setProxData] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [riscoManual, setRiscoManual] = useState(false);
  const [riscoMotivo, setRiscoMotivo] = useState("");
  const [nome, setNome] = useState("");
  const [empreend, setEmpreend] = useState("");
  const [vgv, setVgv] = useState(0);
  const [corretor, setCorretor] = useState("");
  const [publishing, setPublishing] = useState<PubField | null>(null);
  const [publishedHash, setPublishedHash] = useState<Record<PubField, string | null>>({ observacao: null, proxima_acao: null });
  const [tab, setTab] = useState<string>(defaultTab);

  useEffect(() => {
    if (!row) return;
    setStatus(row.status || "");
    setObs(row.observacoes || "");
    setProxAcao(row.proximaAcao || "");
    setProxData(row.proximaAcaoData || "");
    setPrioridade(row.prioridade || "");
    setRiscoManual(row.riscoManual);
    setRiscoMotivo(row.riscoMotivo || "");
    setNome(row.nome || "");
    setEmpreend(row.empreendimento === "—" ? "" : row.empreendimento);
    setVgv(row.vgv || 0);
    setCorretor(row.corretor === "—" ? "" : row.corretor);
    setPublishedHash({ observacao: null, proxima_acao: null });
    setTab(defaultTab);
    if (row.pipelineLeadId) {
      loadPublishedHashes(row.pipelineLeadId).then(setPublishedHash).catch(() => undefined);
    }
  }, [row, defaultTab]);

  if (!row) return null;

  const save = () => {
    onSave(row, {
      status, observacoes: obs, proximaAcao: proxAcao, proximaAcaoData: proxData,
      prioridade: (prioridade as PdnRow["prioridade"]) || "",
      riscoManual, riscoMotivo,
      ...(row.isManual ? {} : { empreendimento: empreend, vgv }),
    });
    if (row.isManual && row.overrideId) {
      onUpdateManual(row.overrideId, {
        nome, empreendimento: empreend || null, vgv, corretor: corretor || null,
      });
    }
    onClose();
  };

  const handlePublish = async (field: PubField, texto: string) => {
    if (!row.pipelineLeadId) return;
    setPublishing(field);
    try {
      const hash = await publicarNoLead(row.pipelineLeadId, field, texto);
      if (hash) {
        setPublishedHash(prev => ({ ...prev, [field]: hash }));
        // Persiste no overlay para não perder a última edição.
        if (field === "observacao") onSave(row, { observacoes: texto.trim() });
        else onSave(row, { proximaAcao: texto.trim(), proximaAcaoData: proxData });
      }
    } finally {
      setPublishing(null);
    }
  };

  return (
    <Sheet open={!!row} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {row.emRisco && <AlertTriangle className="h-4 w-4 text-amber-500" />}
            {row.isManual ? "Negócio manual" : row.nome}
          </SheetTitle>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-3 flex min-h-0 flex-1 flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="contexto">Contexto</TabsTrigger>
            <TabsTrigger value="acao">Ação</TabsTrigger>
            <TabsTrigger value="etapa">Etapa</TabsTrigger>
          </TabsList>
          <div className="mt-3 flex-1 overflow-y-auto pr-1">
            <TabsContent value="contexto" className="m-0">
              <PdnTabContexto row={row} />
            </TabsContent>
            <TabsContent value="acao" className="m-0">
              <PdnTabAcao
                row={row}
                state={{
                  status, setStatus, obs, setObs, proxAcao, setProxAcao, proxData, setProxData,
                  prioridade, setPrioridade, nome, setNome, empreend, setEmpreend, vgv, setVgv, corretor, setCorretor,
                }}
                publishing={publishing}
                publishedHash={publishedHash}
                onPublish={handlePublish}
              />
            </TabsContent>
            <TabsContent value="etapa" className="m-0">
              <PdnTabEtapa
                row={row}
                riscoManual={riscoManual}
                setRiscoManual={setRiscoManual}
                riscoMotivo={riscoMotivo}
                setRiscoMotivo={setRiscoMotivo}
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
          <Button onClick={save}>Salvar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
