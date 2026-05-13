# Plano de correção completa da oscilação do CRM

## Objetivo
Eliminar a instabilidade intermitente do CRM (`volta e cai`), restaurar carregamento contínuo do pipeline/tarefas/login e impedir que falhas transitórias de rede derrubem o trabalho dos corretores.

## Diagnóstico consolidado
- O backend hospedado está saudável neste momento; não há evidência atual de queda geral da infraestrutura.
- O preview mostrou o pipeline carregado com dados, então a falha não é um bloqueio permanente de banco ou autenticação agora.
- Há um erro confirmado no cliente: `Maximum update depth exceeded` em `CeoDashboard.tsx`, indicando loop de renderização/efeitos.
- A aplicação está pesada sob carga:
  - heap ~192–209MB
  - script duration ~9s
  - page load ~7.2s
- O pipeline depende de múltiplas consultas grandes e recargas concorrentes (`loadStages`, `loadSegmentos`, `loadLeads`, tarefas por lote, realtime, visibility reload, focus reload).
- O circuit breaker global de `fetch` hoje pode forçar purge/reload em rajadas transitórias e transformar instabilidade curta em efeito cascata de logout/reload.
- Há um 401 em `manifest.json` no preview, que não parece ser a causa principal do pipeline, mas deve ser removido do caminho para não gerar ruído.

## Causa mais provável
A oscilação está sendo causada por uma combinação de fatores no frontend:
1. loop de atualização no dashboard CEO;
2. excesso de recargas/efeitos concorrentes em telas críticas;
3. estratégia agressiva de recuperação global via `fetchCircuitBreaker`, que pode resetar a sessão em falhas transitórias;
4. custo alto de queries e renderização, deixando a UI sensível a qualquer variação de rede.

## O que vou implementar

### 1) Remover a fonte do loop no dashboard CEO
- Corrigir o `Maximum update depth exceeded` em `src/pages/CeoDashboard.tsx`.
- Tornar estáveis efeitos, callbacks e sincronizações locais que hoje podem disparar re-render infinito.
- Garantir que o dashboard não derrube o restante da app quando o usuário navega ou quando o layout global monta providers.

### 2) Endurecer o pipeline contra oscilação
- Revisar `usePipeline` para evitar recargas duplicadas e concorrentes.
- Reduzir gatilhos redundantes de reload por foco/visibilidade/realtime.
- Manter cache local visível durante refetch em vez de deixar a tela “sumir”.
- Melhorar tratamento de erro transitório para não virar estado fatal cedo demais.

### 3) Ajustar o circuit breaker global de fetch
- Revisar `src/lib/fetchCircuitBreaker.ts` para não purgar sessão/recarregar em qualquer rajada curta.
- Limitar atuação aos cenários realmente irreversíveis (sessão corrompida persistente), não a oscilações normais.
- Evitar efeito cascata de reload/logoff enquanto o backend ainda responde.

### 4) Blindar autenticação e carregamento inicial
- Revisar a interação entre `useAuth`, retries de sessão e reload automático.
- Separar melhor erro de token inválido de erro transitório de rede.
- Garantir que login e restauração de sessão não entrem em ciclo de recuperação.

### 5) Reduzir custo operacional da tela do pipeline
- Revisar consultas auxiliares do kanban (tarefas, visitas, filtros, batches) para cortar trabalho desnecessário na primeira carga.
- Priorizar renderização do board já com dados principais e postergar complementos pesados quando possível.
- Diminuir risco de travamento ao abrir o pipeline com muitos leads.

### 6) Validar ponta a ponta após a correção
Vou testar até estabilizar:
- login
- abertura do CRM
- pipeline com dados visíveis
- navegação entre páginas críticas
- carregamento repetido/refresh
- observação de console e requests para confirmar que a oscilação cessou

## Entregáveis
- Correção do loop de renderização.
- Estabilização do pipeline e do fetch global.
- Ajustes de resiliência em auth/carregamento.
- Validação prática com testes no preview.
- Resumo final com causa raiz + medidas de prevenção imediata.

## Detalhes técnicos
```text
Foco dos arquivos:
- src/pages/CeoDashboard.tsx
- src/hooks/useCeoDashboard.ts
- src/hooks/usePipeline.ts
- src/pages/PipelineKanban.tsx
- src/lib/fetchCircuitBreaker.ts
- src/hooks/useAuth.tsx
```

```text
Critérios de aceite:
- sem `Maximum update depth exceeded`
- sem loop de reload/logout automático
- pipeline abre com dados de forma consistente
- falha transitória não derruba a sessão inteira
- navegação entre CRM/tarefas/pipeline permanece funcional
```

## Resultado esperado
O CRM deixa de oscilar, o pipeline para de desaparecer/interromper carregamento e os corretores voltam a trabalhar sem quedas intermitentes de fetch e sessão.