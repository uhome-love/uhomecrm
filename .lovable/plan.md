# PDN do Gestor — correção da fonte de dados e melhorias

## Objetivo
Fazer o PDN refletir 100% o pipeline de leads (fonte única), corrigir a coluna Corretor, permitir ao gerente anotar **sem alterar o pipeline**, remover a coluna Construtora e organizar por data com filtro.

## Diagnóstico (validado no banco)
- O PDN atual monta as linhas a partir da tabela legada `negocios`, mapeando corretor por `profiles.id`. Por isso a coluna **Corretor aparece em branco** e o filtro de mês por `fase_changed_at` esconde negócios em aberto.
- O pipeline real é `pipeline_leads` (etapas: **Em Negociação** = `proposta`, **Contrato** = `contrato_gerado`, **Ganho** = `venda`), com `corretor_id = auth.users.id`.
- Para o time do Bruno hoje: 4 em **Em Negociação** e 30 em **Ganho**, todos com negócio vinculado. Ou seja, os dados existem — o problema é a fonte/filtro, não dados faltando.

## Mudanças

### 1. Banco (migração)
Adicionar em `pdn_entries` (overlay do gerente, não toca no pipeline):
- `status` (text) — status livre que o gerente escreve.
- `pipeline_lead_id` (uuid) — chave do overlay para linhas de visita/lead sem negócio.

### 2. `src/hooks/usePdn.ts` — reescrever a fonte de dados
Passar a montar as linhas a partir de **`pipeline_leads`** (join com `negocios` para VGV/empreendimento e com `visitas` para Visita Realizada):
- **Em Negociação** (`proposta`) e **Contrato** (`contrato_gerado`): mostra **todos os leads abertos na etapa** (snapshot ao vivo, sem recorte de mês) — assim o gerente enxerga o funil real.
- **Ganho** (`venda`): filtra pelo mês do fechamento (`data_assinatura` do negócio, fallback `fase_changed_at`).
- **Visita Realizada**: visitas `realizada` no mês sem negócio ativo (como hoje), agora com corretor resolvido.
- **Corretor**: resolvido por `pipeline_leads.corretor_id` (auth id) via `profiles.user_id`/`team_members.user_id` — igual ao pipeline. Fim do "—".
- **Escopo do gestor**: mesma regra do board (RPC `resolve_managed_brokers` → auth ids do time), aplicada sobre `pipeline_leads.corretor_id`.
- **Overlay** (`observacoes`, `status`, `proxima_acao`) casado por `negocio_id` quando há negócio, senão por `pipeline_lead_id`. Nunca escreve em `pipeline_leads`/`negocios` — só em `pdn_entries`.
- Remover uso da coluna `construtora`.
- Ordenação padrão: **por data dentro de cada etapa**.

### 3. `src/pages/PdnGestor.tsx` — UI
- **Remover** a coluna **Construtora** (header, célula, export CSV).
- **Adicionar** coluna **Status** editável (célula que grava em `pdn_entries.status` via overlay) — para todas as linhas, inclusive as vindas do pipeline, sem afetar o pipeline.
- Manter **Observação** editável.
- **Ordenar por data** em cada etapa, com um controle de **ordem (mais recente / mais antigo)** ao lado do filtro de corretor/risco.
- Filtro de corretor continua, agora populado com os nomes corretos.
- Ajustar o CSV para: Nome, Data, Empreendimento, VGV, Status, Corretor, Equipe, Observação.

### 4. Validação ponta a ponta
- Conferir no preview, como Bruno (gerente), que **Em Negociação, Contrato e Ganho** agora listam os negócios do time com **corretor preenchido** e ordenados por data.
- Conferir que editar **Status/Observação** salva e **não altera** etapa/substatus do lead no pipeline.
- Conferir totais dos cards (VGV, Ganhos, Contrato, Forecast, Em risco) coerentes com as linhas.
- Rodar `tsgo` e checar responsivo/mobile.

## Detalhes técnicos
- `pipeline_leads.corretor_id` = `auth.users.id`; resolver nome com um único fetch de `profiles`+`team_members` por auth id.
- Etapas por `pipeline_stages.tipo`: `proposta`, `contrato_gerado`, `venda`.
- VGV/empreendimento do negócio vinculado (`negocios.vgv_final` → `vgv_estimado`), com overlay do gerente por cima quando existir.
- Overlay ke y: `negocio_id` (negócios) / `pipeline_lead_id` (visitas/leads sem negócio).
- Sem novas dependências.
