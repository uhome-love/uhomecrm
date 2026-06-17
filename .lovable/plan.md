# Perfil de Gerente — Junior Padilha (pacote único, verificado)

Junior Padilha vira gerente da Uhome espelhando Bruno/Gabriel (que já têm `gestor`+`corretor`), **mas** com uma diferença: ele precisa continuar operando como corretor (se credenciar na roleta, receber e aceitar leads, tarefas, visitas) enquanto tem a visão de gerente. A auditoria mostrou que quase tudo já é dinâmico — o único ponto de quebra é a **navegação**, que mostra o menu de um único papel.

## Resultado da auditoria (o que JÁ funciona sozinho)
- **Pipeline de leads (visão time)** — `usePipeline` resolve a equipe do gestor por `team_members.gerente_id` dinamicamente. ✓
- **Pipeline de negócios** — `useNegocios` usa a RPC `resolve_managed_brokers` (lê `team_members`). ✓
- **Visitas** — `useEquipesDisponiveis` lê `team_members`. ✓
- **Dashboard do gerente (V4)** + **aba Equipes (CEO)** — RPCs dinâmicas por `team_members`. ✓
- **Credenciar / receber leads** — `credenciar_na_roleta` e a distribuição são *role-agnostic* (validam pipeline, não papel). As rotas `/corretor`, `/aceite`, `/corretor/call` **não têm guard de papel** → acessíveis. ✓

## PONTO DE QUEBRA (precisa correção)
**Menu lateral mostra o nav de UM papel só** (`AppLayout` define `sidebarRole`: admin > rh > gestor > corretor). Como Junior será `gestor`, ele recebe o menu de gestor — que **não tem**: "Minha rotina" (`/corretor`, onde fica a barra de auto-credenciamento na roleta), "Aceite de leads" (`/aceite`) e "Oferta ativa" do corretor (`/corretor/call`). Sem esses itens ele não consegue se credenciar nem aceitar os leads que recebe. As páginas existem e são acessíveis por URL, só faltam no menu.

## Plano de execução

### Parte 1 — Dados (sem migração de schema)
1. Adicionar papel `gestor` ao Junior (`user_roles`), mantendo o `corretor`.
2. Criar auto-vínculo em `team_members`: `gerente_id = user_id = 7a270cc1-…`, `equipe = "Junior"`, `status = "ativo"` → faz o pipeline pessoal dele aparecer na visão de equipe.
3. Mover **Adriana Kaiser** (`a5b6ca08-…`) da equipe do Gabriel para a do Junior (atualizar `gerente_id` e `equipe`).

### Parte 2 — Navegação híbrida (correção do ponto de quebra)
4. Em `src/components/layout/Sidebar.tsx`: adicionar um grupo **"Modo Corretor"** no nav de gestor, exibido apenas para gestores que também atuam como corretor, restrito por uma **allowlist de auth_ids** (inicialmente só o Junior) — assim o menu do Bruno/Gabriel não muda. Itens: **Minha rotina** (`/corretor`), **Aceite de leads** (`/aceite`), **Oferta ativa** (`/corretor/call`).
   - `AppLayout` passa a flag/allowlist ao `Sidebar`.
   - Quando a equipe do Junior crescer, basta removê-lo da allowlist e ele deixa de ter o modo corretor.

### Parte 3 — Listas hardcoded de gerentes (cor laranja `#EA580C`)
5. `src/components/pipeline/header/PipelineGestorSelect.tsx` → incluir Junior em `GERENTES_REAIS` (também alimenta `PipelineScopeBadge` e `PipelineKanban`).
6. `src/components/pipeline/equipes/gestorTheme.ts` → tema laranja para o auth_id do Junior.
7. `src/components/ceo/TabEmpresa.tsx` → adicionar Junior à lista `GERENTES` (cor `#EA580C`, equipe "junior").
8. `src/pages/PlacarDoDia.tsx` → adicionar Junior à lista `GERENTES` (equipe "junior") → entra no placar da TV e no ranking de equipes.

## Observações
- **Metas**: a visão de gerente mostra metas zeradas até o Junior (ou o CEO) definir em `ceo_metas_mensais` pelo modal "Editar metas" do dashboard. Não quebra nada — apenas valor inicial 0.
- IDs canônicos: `team_members.gerente_id` e `user_roles.user_id` = `auth.users.id`.

## Verificação ao final
- Login do Junior: vê dashboard de gerente + grupo "Modo Corretor" (credenciar na roleta, aceitar leads, oferta ativa).
- Pipeline de leads/negócios, visitas e central de tarefas mostram leads dele + da Adriana.
- Filtro "por gestor" (CEO), aba Equipes, TabEmpresa e Placar da TV listam "Junior Padilha" em laranja.
- Junior consegue se credenciar e receber um lead de teste pela roleta.
