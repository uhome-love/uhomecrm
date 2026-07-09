## Objetivo
No PDN, o gerente precisa poder (1) corrigir **empreendimento** e **VGV** de qualquer negócio, (2) **apagar/remover** um negócio errado da planilha — tudo isso **sem alterar o negócio/pipeline do corretor**. E confirmar que planilha e Kanban continuam se atualizando sozinhos.

## Situação atual (auditoria)
- A tabela de overlay `pdn_entries` já tem colunas `empreendimento` e `vgv`, e as linhas já resolvem `override → dado do pipeline`. Ou seja, a base para editar sem tocar no corretor **já existe**.
- **Porém**: hoje empreendimento/VGV só são editáveis em linhas *manuais*. Para negócios vindos do pipeline eles aparecem como texto fixo.
- **Excluir** também só existe para linhas manuais. Não há como remover um negócio errado que veio do pipeline (se apagar o overlay, ele volta do pipeline).
- Atualização automática: já funciona — a planilha lê ao vivo de `pipeline_leads` / `negocios` / `visitas` a cada carga, e o overlay do gerente fica "por cima", nunca gravando no `negocios`/pipeline do corretor.

## Mudanças

### 1. Editar empreendimento e VGV (overlay, sem afetar o corretor)
- Estender `saveOverride` para aceitar também `empreendimento` e `vgv` no patch, gravando em `pdn_entries` (camada do gerente). O corretor continua vendo o `negocios` original intacto.
- **Planilha:** para negócios do pipeline, transformar as células de Empreendimento e VGV em campos editáveis (mesmo componente `EditableCell` já usado nas linhas manuais), salvando via `saveOverride`.
- **Drawer (Kanban):** para negócios do pipeline, trocar os campos "Empreendimento" e "VGV" de somente-leitura para inputs editáveis, salvando via `saveOverride`. Mostrar uma dica de que o valor foi ajustado pelo gestor quando diferente do pipeline.
- Nada disso escreve em `negocios` nem em `pipeline_leads`.

### 2. Remover um negócio errado da planilha
- Adicionar a coluna `oculto` (boolean, padrão falso) em `pdn_entries` (migração).
- Nas linhas do PDN, ignorar negócios cujo overlay esteja com `oculto = true` (some da planilha e do Kanban).
- Ação "Remover da planilha" disponível para negócios do pipeline (planilha, drawer e card do Kanban): cria/atualiza o overlay marcando `oculto = true`. Para linhas manuais, mantém a exclusão real que já existe.
- Como isso é uma decisão de gestão que pode ser revertida, incluir um pequeno toggle "Mostrar ocultos" no cabeçalho para reexibir e um botão "Restaurar" nesses itens. Remover da planilha **não** apaga o negócio do corretor.

### 3. Verificação (planilha + Kanban)
- Confirmar que empreendimento/VGV editados aparecem iguais nas duas visões e persistem após recarregar.
- Confirmar que "Remover da planilha" tira o negócio das duas visões e não altera o pipeline do corretor.
- Confirmar que novas visitas realizadas / mudanças de etapa (negociação, contrato, ganho) continuam entrando automaticamente, preservando os ajustes manuais do gerente por cima.

## Detalhes técnicos
- **Migração:** `ALTER TABLE public.pdn_entries ADD COLUMN oculto boolean NOT NULL DEFAULT false;` (sem mudança de RLS/grants — tabela já existente).
- **`usePdn.ts`:** incluir `oculto` no `select` de `loadEntries` e no tipo `PdnEntry`; filtrar linhas ocultas em `rows`; ampliar o patch de `saveOverride` com `empreendimento`/`vgv`; adicionar helpers `ocultarRow(row)` e `restaurarRow(row)` (usam `saveOverride` com `oculto`).
- **`PdnGestor.tsx`:** células editáveis de empreendimento/VGV para linhas do pipeline; ação de remover; toggle "Mostrar ocultos".
- **`PdnCardDrawer.tsx` / `PdnKanban.tsx`:** inputs editáveis e ação de remover para negócios do pipeline.
- Sem alterações em `negocios`, `pipeline_leads`, `visitas` ou na lógica do corretor.