## Objetivo
Corrigir de forma completa o travamento de carregamento do pipeline para corretores e eliminar o mesmo padrão em outras telas críticas, sem mexer no backend se não for necessário.

## Diagnóstico consolidado
- O backend hospedado está saudável; não apareceu sinal de indisponibilidade geral.
- O volume do pipeline é relevante, mas não extremo: cerca de 5.8k leads totais, 2.8k ativos. Há índices importantes já criados em `pipeline_leads`.
- Não encontrei indício de `statement timeout` ou erro recorrente de banco nos logs consultados.
- Há dois problemas distintos acontecendo ao mesmo tempo:
  1. **Travamento funcional do pipeline**: o hook `usePipeline` ainda depende da resolução de cargo/perfil para disparar parte da carga. Quando `user_roles` ou resolução de perfil atrasa/falha/intermite, o usuário fica preso em estados ambíguos ou em recarga parcial.
  2. **Falha de asset/chunk em clientes reais**: o preview do usuário registrou `TypeError: Importing a module script failed.` Isso indica cliente com bundle/chunk inconsistente, cache antigo ou asset não carregado. Isso pode impedir que páginas protegidas abram, mesmo com a API funcionando.
- Também encontrei telas com o mesmo risco estrutural:
  - `useNegocios` / página `MeusNegocios`
  - `usePipelineLeadData` / drawer do lead
  - `useRoleta` em vários pontos ainda com `.single()` sensível
  - vários lookups de `profiles` e `user_roles` espalhados em layout, WhatsApp, relatórios e roleta

## O que vou corrigir

### 1. Blindar o shell de navegação e lazy imports contra cache/chunk quebrado
- Fortalecer o retry de imports dinâmicos para páginas protegidas e públicas.
- Padronizar o fallback de erro de chunk para:
  - limpar caches quando houver erro de módulo/chunk
  - recarregar com cache-bust controlado
  - evitar loop infinito de reload
- Revisar o fluxo de kill switch / recovery para não depender só de ação manual do corretor.

### 2. Reestruturar o `usePipeline` para nunca deixar loading indefinido
- Separar claramente:
  - carregamento de `stages`
  - carregamento de `segmentos`
  - carregamento de `leads`
  - resolução de escopo do usuário
- Garantir que qualquer falha de cargo/perfil leve a um estado explícito de erro ou fallback, nunca a spinner eterno.
- Colocar timeout por etapa crítica, não apenas timeout global.
- Persistir último snapshot utilizável com sinalização clara de dado antigo quando a carga falhar.
- Eliminar caminhos onde `roleLoading` ou uma dependência assíncrona impede a finalização do fluxo visual.

### 3. Endurecer a resolução de identidade e escopo
- Revisar o uso de `useUserRole`, `useAuthUser`, `resolveProfileIds` e pontos que dependem de `profiles`.
- Trocar usos perigosos de `.single()` por `.maybeSingle()` onde ausência de linha é possível.
- Adicionar fallback controlado quando o perfil ainda não existir ou vier duplicado/inconsistente.
- Garantir que o corretor não fique sem pipeline apenas porque a resolução `auth.users.id -> profiles.id` demorou.

### 4. Corrigir páginas com o mesmo sintoma estrutural
Aplicar o mesmo padrão de robustez em:
- `useNegocios` / `MeusNegocios`
- `usePipelineLeadData` / detalhe do lead
- `useRoleta` e páginas relacionadas a credenciamento
- pontos do `AppLayout` e páginas que carregam perfil via `profiles.single()`

O objetivo é evitar que outras telas tenham:
- spinner infinito
- erro silencioso
- tela vazia sem motivo visível
- falha total por falta de uma linha em `profiles`

### 5. Padronizar estados de tela e observabilidade
- Padronizar `loading`, `error`, `stale`, `empty` nas telas críticas.
- Mostrar erro acionável quando houver problema real.
- Adicionar logs mais úteis nos pontos de falha do pipeline e carregamento de escopo.
- Evitar toasts excessivos; manter erro visível na tela quando a página ficar inutilizável.

### 6. Validar as rotas críticas após a correção
Vou validar pelo menos:
- `/pipeline`
- `/pipeline-negocios`
- `/pos-vendas`
- `/whatsapp`
- `/roleta`
- drawer de detalhe do lead

## Arquivos mais prováveis de alteração
- `src/hooks/usePipeline.ts`
- `src/hooks/useUserRole.tsx`
- `src/hooks/useAuthUser.ts`
- `src/hooks/useNegocios.ts`
- `src/hooks/usePipelineLeadData.ts`
- `src/hooks/useRoleta.ts`
- `src/config/pageRegistry.ts`
- `src/App.tsx`
- possivelmente `src/components/AppLayout.tsx` e telas que usam `profiles.single()` em carregamento inicial

## Detalhes técnicos
```text
Problema A: dados
user_roles / profiles atrasam ou falham
-> escopo do corretor não resolve
-> loadLeads não fecha corretamente
-> pipeline fica preso ou cai em estado parcial

Problema B: frontend/cache
cliente com chunk antigo ou asset falho
-> import dinâmico quebra antes da tela abrir
-> parece "pipeline não carrega", mas o problema é o shell da página

Correção
1. robustez de lazy import/cache
2. pipeline com timeouts por etapa + fallback explícito
3. identity/profile lookup tolerante a ausência
4. replicar padrão nas páginas irmãs
```

## Resultado esperado
- Corretores conseguem abrir o pipeline mesmo em cenários de rede instável.
- Quando houver falha real, a tela mostra erro e ação de recuperação, não spinner infinito.
- Páginas relacionadas deixam de depender de `.single()` frágil para abrir.
- Reduzimos os casos em que o problema parece “fetch quebrado” mas na verdade é cache/chunk/perfil.

## Fora de escopo nesta implementação
- Reestruturação completa do modelo de dados do CRM
- Mudanças grandes de RLS ou schema sem evidência de necessidade
- Analytics de uso ou auditoria ampla do sistema
- Refactor visual amplo sem relação direta com carregamento