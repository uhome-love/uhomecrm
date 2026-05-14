## Diagnóstico atual

A auditoria aponta que **os dados do CRM não sumiram** no backend. As tabelas principais estão íntegras agora:
- `pipeline_stages` de leads e negócios estão preenchidas
- `pipeline_segmentos` está preenchida
- `pipeline_leads` continua com volume normal de leads ativos
- o backend hospedado está saudável no momento

O que aconteceu no app foi um **colapso geral de leitura no cliente**: as capturas mostram `Load failed` em consultas básicas como estágios, segmentos, leads, negócios e KPIs ao mesmo tempo. Isso combina com o sintoma de “tudo zerado / pipeline vazio / foco e tarefas falhando juntos”.

A leitura do histórico de hoje mostra que as mudanças mais sensíveis ficaram concentradas em:
- autenticação e recuperação de sessão (`src/hooks/useAuth.tsx`)
- boot/PWA/cache/versionamento (`src/main.tsx`, `public/sw.js`)
- monitor de falhas de rede (`src/lib/fetchCircuitBreaker.ts`)
- wrappers de retry (`src/lib/taskQueryUtils.ts`)
- módulos CRM afetados (`src/hooks/usePipeline.ts`, `src/hooks/useFocusLeads.ts`, `src/pages/MinhasTarefas.tsx`, `src/components/corretor/MinhaAgendaWidget.tsx`)

Minha hipótese principal é:
1. houve uma falha transitória real de conectividade/sessão no cliente;
2. os módulos do CRM passaram a reagir mal a isso, **zerando estado visível ou entrando em carga falha em cascata**;
3. as mudanças de hoje em auth/recovery e fetch resiliente aumentaram a sensibilidade desse comportamento.

## O que vou corrigir

### 1) Blindar autenticação e recuperação de sessão
Vou revisar e simplificar o fluxo de sessão para que:
- falha transitória de rede não seja tratada como sessão inválida;
- refresh de token não gere cascata de perda de dados na interface;
- a recuperação não limpe estado útil nem force reinterpretações agressivas da sessão.

**Arquivos-alvo**
- `src/hooks/useAuth.tsx`
- `src/main.tsx`
- `src/lib/fetchCircuitBreaker.ts`

### 2) Impedir que o CRM zere a tela em falhas temporárias
Vou ajustar os hooks críticos para que, se uma carga falhar temporariamente:
- mantenham o último snapshot válido na tela;
- mostrem erro de estado degradado, sem “matar” os dados já carregados;
- não convertam indisponibilidade temporária em vazio real.

**Arquivos-alvo**
- `src/hooks/usePipeline.ts`
- `src/hooks/useFocusLeads.ts`
- `src/pages/MinhasTarefas.tsx`
- `src/components/corretor/MinhaAgendaWidget.tsx`
- `src/hooks/useCorretorHomeData.ts`

### 3) Eliminar pontos de cascata e carga excessiva
Vou revisar os pontos onde hoje pode existir efeito dominó:
- múltiplas queries paralelas repetindo em falha;
- retries simultâneos em vários módulos;
- estados que entram como `[]` por fallback silencioso e fazem parecer que o CRM está zerado;
- telas que dependem de `user.id` em casos onde o dado do domínio usa `profile.id`.

### 4) Separar “sem dados” de “erro de carregamento”
Hoje algumas telas acabam parecendo vazias como se fosse verdade de negócio. Vou padronizar para que:
- erro de backend/rede apareça como erro mesmo;
- vazio real só apareça quando a consulta respondeu com sucesso e retornou zero;
- dashboards e pipelines não mostrem falso zero durante indisponibilidade.

### 5) Validar com auditoria funcional após a correção
Depois da implementação, vou validar especificamente:
- pipeline de leads
- pipeline de negócios
- foco
- minhas tarefas
- rotina/agenda do corretor
- dashboards que estavam zerando

Também vou conferir se:
- estágios carregam sempre
- segmentos carregam sempre
- leads não desaparecem visualmente em falha transitória
- a sessão continua estável no PWA e no app aberto

## Resultado esperado

Depois dessa correção, o CRM deve:
- continuar mostrando os dados já carregados mesmo sob instabilidade momentânea;
- recuperar sozinho quando o backend voltar a responder;
- não transformar erro transitório em tela zerada;
- não depender de solução temporária ou paliativa.

## Detalhes técnicos

```text
Causa mais provável
backend/transiente -> várias queries falham com Load failed -> hooks tratam como vazio/erro crítico -> CRM inteiro aparenta zerado

Correção definitiva
sessão mais estável
+ retry/control mais previsível
+ preservar último estado válido
+ distinguir erro transitório de vazio real
+ reduzir cascata entre módulos
```

## Escopo da implementação

Vou focar só na causa da regressão de hoje e na blindagem definitiva desses fluxos. Não vou mexer nas regras comerciais nem nos dados do CRM além do necessário para estabilidade.