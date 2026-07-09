## Objetivo

Fazer o aviso do botão "Avisar corretor" (PDN) virar um **link direto** que abre o pipeline do corretor com o negócio já selecionado e a etapa sugerida pelo gestor em destaque — pronta para aplicar em 1 clique, sem alterar o pipeline até o corretor confirmar.

## Situação atual

- `avisarCorretor` (em `usePdn.ts`) cria a notificação com `dados: { pdn_lead_id, etapa_sugerida, empreendimento }`.
- O roteamento de notificações (`getNotificationUrl` em `useNotifications.ts` e `getNotificationRoute` em `NotificationList.tsx`) **não trata `tipo="pdn"`** e usa `pipeline_lead_id`/`lead_id` — por isso o clique hoje cai em `/notificacoes`.
- A página de pipeline (`/pipeline-leads` → `PipelineKanban.tsx`) já lê `?lead=<id>` e abre o modal do lead automaticamente. Falta apenas passar/receber a etapa sugerida.

## Mudanças

### 1. `src/hooks/usePdn.ts` — payload da notificação
No `avisarCorretor`, ajustar `p_dados` para o roteamento reconhecer o lead e a etapa:
```
p_dados: {
  pipeline_lead_id: row.pipelineLeadId,   // chave usada pelo deep-link
  etapa_sugerida: row.grupo,              // ex.: "em_negociacao"
  etapa_sugerida_label: GRUPO_LABEL[row.grupo],
  empreendimento: row.empreendimento,
}
```

### 2. Roteamento das notificações (link direto)
Adicionar tratamento de `tipo === "pdn"` em ambos os pontos, apontando para o pipeline com lead + etapa:
- `useNotifications.ts` → `getNotificationUrl`
- `NotificationList.tsx` → `getNotificationRoute`

Rota gerada: `/pipeline-leads?lead=<pipeline_lead_id>&etapaSugerida=<etapa_sugerida>`

Também adicionar `pdn` em `TIPO_LABELS` ("Gestor") e `TIPO_CONFIG` (emoji 📋, cor indigo) para o item aparecer formatado na lista/sino.

### 3. `src/pages/PipelineKanban.tsx` — repassar a etapa sugerida
No efeito que já lê `searchParams.get("lead")`, ler também `searchParams.get("etapaSugerida")`, guardar em estado (`etapaSugerida`) e limpá-lo do URL junto com `lead`. Passar `etapaSugerida` como prop para `PipelineLeadDetail` (e zerar ao fechar o modal).

### 4. `src/components/pipeline/PipelineLeadDetail.tsx` — banner "sugestão do gestor"
- Nova prop opcional `etapaSugerida?: string` (grupo do PDN).
- Mapear grupo do PDN → stage ativo do board por nome:
  `visita_realizada → "Visita"`, `em_negociacao → "Em Negociação"`, `contrato → "Contrato"`, `ganho → "Ganho"`. `caidos` não sugere movimentação.
- Se houver etapa sugerida e ela for diferente da etapa atual do lead, exibir no topo do modal um banner destacado:
  `📋 Seu gestor sugeriu atualizar a etapa para "<label>"` + botão **"Aplicar etapa"** que chama `onMove(lead.id, stageIdSugerido)`.
- O banner é apenas uma sugestão: nada muda no pipeline até o corretor clicar em "Aplicar etapa" (mantém a diretriz de não alterar o pipeline do corretor automaticamente).

## Resultado

Ao clicar no aviso (toast "Abrir", sino ou página de notificações), o corretor cai direto no seu pipeline com o negócio aberto e um banner sugerindo a etapa correta, aplicável em 1 clique.

## Técnico

- Sem migration: reusa a coluna `dados` (jsonb) da tabela `notifications` e a RPC `criar_notificacao` existente.
- Alterações restritas a 4 arquivos de frontend; nenhuma escrita automática no pipeline.
- Validação: typecheck + teste ponta a ponta no preview (enviar aviso, abrir o link como corretor, aplicar a etapa) com limpeza dos artefatos ao final.