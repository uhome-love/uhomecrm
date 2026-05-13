## Objetivo

Corrigir a falha geral de login/carregamento e **incluir uma limpeza geral de cache** para que todos os corretores passem a usar apenas a versão estável do CRM.

## Diagnóstico consolidado

O problema está vindo da combinação de 3 fatores:

1. **Sessões inválidas de autenticação**
   - Há eventos de `bad_jwt`, `missing sub claim` e `session_not_found`.
   - Isso faz o usuário cair para o login ou travar antes de autenticar.

2. **Service Worker / cache antigo distribuindo bundle velho**
   - O projeto ainda registra `sw.js` e mantém shell cacheado.
   - Depois de atualização, alguns computadores continuam abrindo arquivos antigos.
   - Isso explica comportamento como:
     - estava funcionando e saiu sozinho,
     - volta para login,
     - não entra mais,
     - pipeline não carrega,
     - tela em loading ou vazia.

3. **Erros paralelos de dados/schema ampliando a quebra**
   - Existem erros recorrentes no banco e em funções auxiliares.
   - Eles pioram o carregamento e fazem o CRM parecer totalmente fora, mesmo quando a origem principal é sessão + cache velho.

## Plano de correção completa

### Frente 1 — Limpeza geral de cache para todos
1. **Transformar o `sw.js` em kill-switch temporário**
   - No próximo deploy, o Service Worker vai:
     - limpar todos os caches antigos,
     - desregistrar workers antigos,
     - forçar recarga limpa do app.
   - Isso garante que os computadores presos saiam da versão velha.

2. **Adicionar limpeza automática no boot do app**
   - Em `src/main.tsx`, antes de iniciar a aplicação:
     - limpar caches antigos,
     - remover service workers antigos em contexto problemático,
     - forçar carregamento limpo quando detectar versão inconsistente.

3. **Criar política de versão obrigatória**
   - O cliente vai comparar a versão atual com `version.json`.
   - Se detectar versão antiga, recarrega para a nova.
   - Resultado: ninguém permanece numa build quebrada antiga.

4. **Remover comportamento de cache agressivo de HTML/JS**
   - O app não poderá mais servir `index.html` e bundles antigos após deploy.
   - Fallback offline deixa de prevalecer sobre atualização crítica.

### Frente 2 — Corrigir a autenticação que derruba em massa
5. **Endurecer `useAuth.tsx` para sessão inválida real**
   - Tratar `bad_jwt`, `missing sub` e `session_not_found` como sessão vencida/inválida.
   - Fazer limpeza segura de storage local e retorno limpo ao login.
   - Evitar loop de “entrando” sem sair do lugar.

6. **Separar falha de rede de falha de sessão**
   - Revisar o fluxo atual para:
     - não derrubar usuário por oscilação momentânea,
     - mas limpar sessão quebrada de verdade.

7. **Evitar reaproveitamento de token podre**
   - Antes do boot, validar o token local.
   - Se estiver corrompido/obsoleto, descartar antes que o app monte com estado ruim.

### Frente 3 — Estabilizar o CRM após login
8. **Refatorar o carregamento do pipeline**
   - Carregar primeiro o essencial.
   - Impedir que falha auxiliar derrube a tela inteira.
   - Preservar último estado válido enquanto recupera novas leituras.

9. **Reduzir sensibilidade a recargas em cascata**
   - Revisar triggers de reload em `usePipeline.ts` e `PipelineKanban.tsx`.
   - Evitar comportamento que zera ou reinicia a tela facilmente.

### Frente 4 — Corrigir a camada de dados com erro recorrente
10. **Sanear migrations e referências quebradas**
   - Corrigir colunas consultadas que não existem.
   - Corrigir inserções com `stage_id` nulo.
   - Ajustar triggers/históricos que estão gerando erro repetido.

11. **Parar ruído estrutural que amplia a percepção de queda geral**
   - Revisar consultas/funções com erro recorrente para que o CRM volte a responder de forma previsível.

### Frente 5 — Prevenção permanente
12. **Implantar monitoramento de saúde de autenticação**
   - Detectar explosão de `bad_jwt` / `session_not_found` cedo.

13. **Criar rotina de smoke test pós-correção**
   - Validar login, refresh, reentrada, pipeline e troca de versão.

## Limpeza geral de cache pedida por você

Isso fará parte da solução com três camadas:

```text
Camada 1: limpar caches antigos do navegador via Service Worker kill-switch
Camada 2: desregistrar workers antigos presos nas máquinas dos corretores
Camada 3: impor versionamento obrigatório para carregar só a versão atual
```

Com isso, a ideia é que:
- os computadores que estão presos em build antiga sejam recuperados,
- ninguém continue rodando a versão problemática,
- e as próximas atualizações não repitam esse cenário.

## Arquivos/áreas principais que serão atacados

- `public/sw.js`
- `src/main.tsx`
- `src/hooks/useAuth.tsx`
- `src/lib/fetchCircuitBreaker.ts`
- `src/hooks/usePipeline.ts`
- `src/pages/PipelineKanban.tsx`
- migrations do banco para corrigir schema/trigger/consistência

## Critérios para considerar resolvido

1. O corretor consegue abrir o CRM mesmo após ter ficado preso antes.
2. O login volta a funcionar sem travar em loading.
3. O pipeline carrega novamente com dados.
4. Refresh, sair/entrar e troca de aba continuam funcionando.
5. Todos passam a usar a mesma versão válida do app.
6. O cache antigo não consegue mais manter usuários na build quebrada.

## Resultado esperado

Depois da execução:
- o CRM deixa de cair em massa para login quebrado,
- o cache antigo é eliminado de forma global,
- os corretores passam a abrir somente a versão funcional,
- a autenticação volta a estabilizar,
- e o problema deixa de reaparecer como falha geral.

Quando você aprovar, eu executo essa correção completa com foco explícito na limpeza geral de cache e na recuperação para todos os usuários.