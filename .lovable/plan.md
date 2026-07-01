# Corrigir visão da Diretora Comercial no Pipeline

## Problema

A Gabrielle tem o papel **diretor** (e também gestor, mas com 0 membros de equipe). A visão "CEO-like" da diretoria foi aplicada anteriormente só em funções SECURITY DEFINER (RPCs), mas **as partes que leem as tabelas diretamente ainda só reconhecem `admin`**. Resultado:

- **Pipeline vazio**: `usePipeline` trata diretor como gestor → busca só a equipe dela (vazia) → nada. Além disso, a política de segurança (RLS) de `pipeline_leads` só libera leitura total para `admin`, não para `diretor` — então mesmo removendo o filtro, o banco bloquearia.
- **Equipes vazio**: a função `get_pipeline_equipes_overview` recusa quem não é `admin` ("Acesso negado"), e o hook `useEquipesView` só habilita para `admin`.

## Correções

### 1. Banco de dados (migração)
- Alterar a função `get_pipeline_equipes_overview` para permitir também `diretor` na checagem de acesso (`admin OR diretor`).
- Adicionar políticas de leitura para `diretor` (visão de todo o escritório, igual admin) nas tabelas que o pipeline lê diretamente:
  - `pipeline_leads` (essencial para ver os leads)
  - `pipeline_tarefas`, `pipeline_atividades`, `pipeline_historico`, `pipeline_anotacoes` (para abrir e operar o detalhe do lead sem falhas)
  - `negocios` e `negocios_tarefas`/`negocios_atividades` se necessário para os cards de negócio

Cada política nova apenas adiciona `has_role(auth.uid(), 'diretor')` como condição de SELECT, espelhando o que já existe para admin. Nenhuma política existente é removida.

### 2. Frontend
- **`src/hooks/usePipeline.ts`**: incluir `isDiretor` do `useUserRole` e tratar `isCeoView = isAdmin || isDiretor` como escopo do escritório inteiro (mesmo ramo do admin, sem filtro por equipe), tanto na resolução de escopo quanto na query.
- **`src/hooks/useEquipesView.ts`**: habilitar a query para `isAdmin || isDiretor` (hoje só `isAdmin`).

`PipelineKanban.tsx` já trata `isCeoView = isAdmin || isDiretor` para as abas (default "equipes"), então após os ajustes acima a aba Equipes e o Kanban global passam a carregar dados.

## Validação
- Confirmar que a Diretora passa a ver todos os leads do escritório no Kanban e a aba Equipes populada.
- Confirmar que gestores e corretores continuam com o mesmo escopo restrito de antes (nada muda para eles).

## Detalhes técnicos
- Não altera a tabela `intermediacoes`, storage, nem edge functions.
- Migração só adiciona/edita políticas RLS e uma função — segue o limite de migrações por dia; roda em janela adequada.
- A abordagem espelha exatamente o acesso de `admin`, coerente com a decisão anterior de dar à diretoria visão equivalente ao CEO.
