

# Plano: Evolução Arquitetural — Fases 1, 2 e 3

Execução incremental, fase a fase, com teste de funcionamento ao final de cada uma. Fase 4 (Lead Detail) fica para redesenho futuro. Fase 5 (polish) pode ser feita depois.

---

## FASE 1 — Segurança e Limpeza Invisível

**Risco: zero. Nenhum fluxo ativo é afetado.**

### 1.1 Proteger `/import-brevo-contacts`
- Linha 193 do `App.tsx`: trocar de rota pública para `<ProtectedPage roles={["admin"]}>`.

### 1.2 Deletar 5 arquivos órfãos (sem rota ativa ou rota duplicada)
- `src/pages/FechamentoDay.tsx` — a rota `/fechamento-day` já renderiza `PlacarDoDia` diretamente (linha 197)
- `src/pages/ForecastDashboard.tsx` — sem rota no App.tsx
- `src/pages/FunilDashboard.tsx` — sem rota no App.tsx
- `src/pages/Index.tsx` — sem rota no App.tsx
- `src/pages/AlertasPage.tsx` — sem rota no App.tsx

### 1.3 Remover import morto
- Linha 49: remover `const RankingComercial = lazyRetry(...)` — não tem nenhuma `<Route>` associada

### Teste Fase 1
- Build compila sem erros
- Todas as rotas do sidebar funcionam
- `/import-brevo-contacts` redireciona para `/auth` se não logado, e para home se não admin

---

## FASE 2 — Unificação de Rotas Duplicadas

**Risco: baixo. Redirects preservam acesso por bookmark/URL.**

### 2.1 Rotas a substituir por `<Navigate to="..." replace />`
| Rota atual | Redireciona para | Motivo |
|---|---|---|
| `/fechamento-day` (linha 197) | `/placar-do-dia` | Mesmo componente `PlacarDoDia` |
| `/corretor/call` (linha 225) | `/oferta-ativa` | Dialers duplicados |
| `/corretor/ranking-equipes` (linha 228) | `/ranking` | Mesmo componente `RankingEquipe` |
| `/gestao` (linha 207) | `/gerente/dashboard` | Mesmo componente `GestorDashboard` |
| `/corretor/resumo` (linha 227) | `/corretor` | Sem entrada no sidebar |

### 2.2 Remover lazy imports que ficam órfãos após redirects
- `CorretorCall` (linha 74)
- `CorretorResumo` (linha 53)
- `GestorDashboard` continua sendo usado em `/gestao`? Não — `/gestao` renderiza `GestorDashboard` mas o redirect elimina isso. Porém `GestorDashboard` pode ser usado em outra rota? Verificar... Não, apenas `/gestao`. Mas o import `GestorDashboard` na linha 39 é usado em algum outro lugar? Não. Mas o componente é a **home do gestor via HomeDashboard**? Não — `HomeDashboard` é separado. Remover o import `GestorDashboard` e o arquivo `GestorDashboard.tsx`.

**Espera** — preciso ser cauteloso. `GestorDashboard` é importado na linha 39 e usado apenas na rota `/gestao` (linha 207). Se `/gestao` vira redirect, o import fica órfão. Mas o arquivo pode ser referenciado por outros componentes. Vou manter o arquivo e apenas remover o import do App.tsx.

### Teste Fase 2
- Acessar cada URL antiga e confirmar redirect
- Sidebar continua funcionando normalmente
- Nenhum 404

---

## FASE 3 — Ajuste do Sidebar do Corretor

**Risco: médio-visual. Só reorganização, sem perder funcionalidade.**

### 3.1 No `src/components/layout/Sidebar.tsx`
- Alterar o path do item "Oferta ativa" de `/corretor/call` para `/oferta-ativa` (linha 175)
- Verificar se há outros itens apontando para rotas que agora são redirects e atualizar

### Teste Fase 3
- Clicar em cada item do sidebar do corretor — todos funcionam
- Clicar em cada item do sidebar do admin — todos funcionam
- Clicar em cada item do sidebar do gestor — todos funcionam

---

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/App.tsx` | Proteger brevo, remover 3 imports órfãos, substituir 5 rotas por redirects |
| `src/components/layout/Sidebar.tsx` | Atualizar path oferta-ativa |
| `src/pages/FechamentoDay.tsx` | Deletar |
| `src/pages/ForecastDashboard.tsx` | Deletar |
| `src/pages/FunilDashboard.tsx` | Deletar |
| `src/pages/Index.tsx` | Deletar |
| `src/pages/AlertasPage.tsx` | Deletar |

## Estratégia anti-quebra
- Cada fase é um commit separado
- Se qualquer fase causar problema, revertemos apenas ela
- Redirects garantem que URLs antigas continuam funcionando
- Nenhum componente ativo é modificado ou removido

