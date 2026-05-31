## Objetivo

O gestor Bruno precisa de uma carteira **própria** dentro do pipeline de leads:
- Criar leads sem erro de permissão
- Manter esses leads sob sua gestão (sem serem "doados" automaticamente para um corretor)
- **Filtrar para ver só os próprios leads** ou ver todos os da equipe
- Continuar vendo os negócios da equipe (pipeline de negócios)

## Diagnóstico

Investiguei o banco e o código:

1. **Bruno tem os papéis `gestor` e `corretor`** corretamente atribuídos.
2. **A regra de inserção do gestor já existe** no pipeline de leads e, no banco, permite o cadastro.
3. **Causa real do problema:** quando o gestor cadastra um lead sem definir responsável, um gatilho automático (`trg_auto_distribute_lead`) **distribui o lead para um corretor da roleta** (ou o deixa pendente). O lead sai da mão do gestor e ele não o vê mais. Isso, combinado com a falta de responsável definido, gera o comportamento de "não consigo adicionar / o lead some" que aparece como erro de permissão.
4. **Visibilidade já funciona:** gestor vê leads dos 13 membros do time (`is_lead_in_my_team`) e os negócios da equipe (`negocios_select_scoped` já cobre time + próprios). Negócios não precisam de mudança.

## Solução

### 1. Frontend — diálogo de novo lead (`PipelineAddLeadDialog.tsx`)
- Para gestor/admin, adicionar seletor **"Atribuir a"** com:
  - **Minha carteira (eu)** — padrão
  - **Membros do time** (lista dos corretores do time)
  - **Distribuir automaticamente** (mantém a roleta)
- Corretor comum: nada muda (auto-atribuído a si mesmo).

### 2. Frontend — lógica de criação (`usePipeline.ts`, `addLead`)
- **Minha carteira:** grava `corretor_id` = id do próprio gestor e `aceite_status = "aceito"` → impede a distribuição automática e mantém o lead visível.
- **Membro do time:** grava `corretor_id` do membro escolhido.
- **Distribuir automaticamente:** envia `corretor_id` nulo (comportamento atual da roleta).

### 3. Frontend — filtro "Minha carteira / Equipe" no pipeline de leads
- Adicionar um seletor de escopo na barra do pipeline, visível apenas para gestor/admin:
  - **Equipe (todos)** — padrão atual (todos os leads do time + próprios)
  - **Minha carteira** — mostra somente os leads cujo responsável é o próprio gestor
- O filtro é client-side sobre os leads já carregados (`corretor_id = id do gestor`), simples e instantâneo. A preferência fica lembrada na sessão.

### 4. Banco — reforço das permissões (garantia)
- **Garantir** a regra de inserção do gestor (recriar de forma idempotente).
- **Adicionar** ao gestor a permissão de ver/editar leads que ele mesmo criou (`created_by = gestor`), além dos da equipe — assim, mesmo um lead sem responsável criado por ele permanece visível e gerenciável.
- Não altera visibilidade dos corretores nem dos negócios (já corretas).

## Resultado esperado
- Gestor cria leads sem erro.
- Lead criado fica na **carteira do gestor** por padrão (não é doado).
- Gestor pode direcionar o lead a um corretor ou à distribuição automática.
- Gestor alterna entre **Minha carteira** e **Equipe (todos)** no pipeline.
- Gestor continua vendo todos os negócios da equipe.

## Detalhes técnicos
- Arquivos: `src/components/pipeline/PipelineAddLeadDialog.tsx`, `src/hooks/usePipeline.ts`, e a página/board do pipeline de leads para o seletor de escopo.
- Migration de RLS em `pipeline_leads`: recriar política INSERT de gestor; adicionar `created_by = auth.uid()` às políticas SELECT/UPDATE de gestor (sem `anon`; mantendo `service_role`).
- Sem mudanças em `negocios` (RLS já cobre time + próprios + parcerias).
- Lista de membros do time via `team_members` (`gerente_id = auth.uid()`).

Estimativa: ~45–55 min, risco baixo (1 migration + frontend).
