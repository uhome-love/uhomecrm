import { useEffect, useMemo, useState } from "react";
import { Rocket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCriarCampanhaV2,
  useEmpreendimentosCanonicos,
  useEscopoOpcoes,
  useFormulariosBase,
  usePreviewCampanhaV2,
  useTemplatesOA,
  type BaseLeadsFiltro,
  type CampanhaFiltroV2,
} from "@/hooks/useBaseLeads";
import { PassoPublico } from "./campanha/PassoPublico";
import { PassoIdentidade, expiracaoEm, type IdentidadeState } from "./campanha/PassoIdentidade";
import { PassoEscopo, type EscopoState } from "./campanha/PassoEscopo";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Filtro herdado da tela da Base Única (opcional — tudo é editável aqui dentro). */
  filtroInicial?: BaseLeadsFiltro;
}

const FILTRO_PADRAO: CampanhaFiltroV2 = {
  empreendimento_ids: [],
  formularios: [],
  ano_min: null,
  ano_max: null,
  situacao: null,
  nunca_trabalhado: true,
  com_telefone: true,
  com_email: false,
  ordem_selecao: "recentes",
  incluir_descartados: true,
  descarte_min_dias: 90,
};

export function CriarCampanhaDialog({ open, onOpenChange, filtroInicial }: Props) {
  const [filtro, setFiltro] = useState<CampanhaFiltroV2>(FILTRO_PADRAO);
  const [ident, setIdent] = useState<IdentidadeState>({
    nome: "",
    observacao: "",
    template_id: null,
    limite: 300,
    expira: expiracaoEm(3),
    max_tentativas: 3,
    cooldown_dias: 30,
  });
  const [escopo, setEscopo] = useState<EscopoState>({ equipes: [], corretores: [], liberar: true });
  const [aba, setAba] = useState("publico");

  const { data: emps } = useEmpreendimentosCanonicos();
  const { data: forms } = useFormulariosBase();
  const { data: templates } = useTemplatesOA();
  const { data: opcoesEscopo } = useEscopoOpcoes();
  const { data: preview, isLoading: loadingPreview } = usePreviewCampanhaV2(filtro, open);
  const criar = useCriarCampanhaV2();

  const nomeSugerido = useMemo(() => {
    const empNome =
      filtro.empreendimento_ids.length === 1
        ? emps?.find((e) => e.id === filtro.empreendimento_ids[0])?.nome
        : filtro.empreendimento_ids.length > 1
          ? `${filtro.empreendimento_ids.length} produtos`
          : "Base Única";
    return `${empNome ?? "Base Única"} · ${new Date().toLocaleDateString("pt-BR")}`;
  }, [filtro.empreendimento_ids, emps]);

  useEffect(() => {
    if (!open) return;
    setAba("publico");
    setFiltro({
      ...FILTRO_PADRAO,
      empreendimento_ids: filtroInicial?.empreendimento_canonico_id ? [filtroInicial.empreendimento_canonico_id] : [],
      ano_min: filtroInicial?.ano_min ?? null,
      ano_max: filtroInicial?.ano_max ?? null,
      situacao: null, // higiene automática: só entra quem não existe no CRM
      nunca_trabalhado: filtroInicial?.nunca_trabalhado ?? true,
      com_telefone: filtroInicial?.com_telefone ?? true,
      incluir_descartados: filtroInicial?.incluir_descartados ?? true,
      descarte_min_dias: filtroInicial?.descarte_min_dias ?? 90,
    });
    setIdent((s) => ({ ...s, nome: "", observacao: "", expira: expiracaoEm(3) }));
    setEscopo({ equipes: [], corretores: [], liberar: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const nomeFinal = ident.nome.trim() || nomeSugerido;
  const total = preview?.total ?? 0;
  const totalCampanha = Math.min(total, ident.limite);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket size={16} /> Criar campanha de Oferta Ativa
          </DialogTitle>
          <DialogDescription>
            Monte a lista que o time vai ligar: público, identidade e quem trabalha. Ao expirar, os leads não
            trabalhados voltam para a Base Única.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={aba} onValueChange={setAba}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="publico">1 · Público</TabsTrigger>
            <TabsTrigger value="identidade">2 · Campanha</TabsTrigger>
            <TabsTrigger value="escopo">3 · Quem liga</TabsTrigger>
          </TabsList>

          <TabsContent value="publico" className="mt-3">
            <PassoPublico
              filtro={filtro}
              set={(p) => setFiltro((f) => ({ ...f, ...p }))}
              emps={emps ?? []}
              forms={forms ?? []}
              preview={preview}
              loading={loadingPreview}
              limite={ident.limite}
            />
          </TabsContent>

          <TabsContent value="identidade" className="mt-3">
            <PassoIdentidade
              state={{ ...ident, nome: ident.nome || nomeSugerido }}
              set={(p) => setIdent((s) => ({ ...s, ...p }))}
              templates={templates ?? []}
            />
          </TabsContent>

          <TabsContent value="escopo" className="mt-3">
            <PassoEscopo state={escopo} set={(p) => setEscopo((s) => ({ ...s, ...p }))} opcoes={opcoesEscopo} />
          </TabsContent>
        </Tabs>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {loadingPreview ? "Calculando…" : `${total.toLocaleString("pt-BR")} no filtro · ${totalCampanha.toLocaleString("pt-BR")} serão liberados`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            {aba !== "escopo" ? (
              <Button onClick={() => setAba(aba === "publico" ? "identidade" : "escopo")}>Continuar</Button>
            ) : (
              <Button
                disabled={criar.isPending || totalCampanha === 0}
                onClick={() =>
                  criar.mutate(
                    {
                      nome: nomeFinal,
                      filtro,
                      config: {
                        limite: ident.limite,
                        expira_em: ident.expira ? new Date(ident.expira).toISOString() : null,
                        liberar: escopo.liberar,
                        observacao: ident.observacao.trim() || null,
                        template_id: ident.template_id,
                        max_tentativas: ident.max_tentativas,
                        cooldown_dias: ident.cooldown_dias,
                        ordem_selecao: filtro.ordem_selecao,
                        escopo: { equipes: escopo.equipes, corretores: escopo.corretores },
                      },
                    },
                    { onSuccess: () => onOpenChange(false) },
                  )
                }
              >
                {criar.isPending ? "Criando…" : `Criar com ${totalCampanha} leads`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CriarCampanhaDialog;
