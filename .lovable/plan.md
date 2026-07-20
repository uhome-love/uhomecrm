## Objetivo

Deixar a validação de presença da roleta acessível em **dois lugares**: dashboard do gerente (já existe hoje via `V4PanelRoleta`) e dashboard do CEO (`/ceo`, hoje não tem nada de presença). Sem página nova, sem aba nova em `/roleta` — segue o pedido de manter no dashboard de cada um.

## Situação atual

- `V4PanelRoleta.tsx` (dashboard do gerente `/gerente/dashboard`) já implementa: chips de status por turno, botões Chegou/Saiu, "+ Marcar presença" avulsa. Puxa dados via `useDashboardGerenteV4Dia` (filtrado pela equipe do gestor).
- `CeoDashboard.tsx` (`/ceo`) não tem nenhum bloco de presença hoje.
- Backend (`roleta_presencas`, RPC `roleta_marcar_presenca`, `get_elegibilidade_roleta`) já está pronto e é agnóstico a papel — só depende de o usuário ser gestor/admin nas policies.

## O que muda

### 1. Extrair painel de presença compartilhado

Extrair o miolo de `V4PanelRoleta.tsx` para um componente reutilizável `src/components/roleta/PresencaRoletaPanel.tsx`, com prop `scope`:

- `scope="gestor"` → mostra só credenciados/presenças da equipe do gestor logado (comportamento atual, via `useDashboardGerenteV4Dia`).
- `scope="ceo"` → mostra todos os credenciados/presenças do dia, sem filtro de equipe. Usar consulta direta a `roleta_credenciamentos` + `roleta_presencas` do dia (ou um novo hook fino `useRoletaPresencaDia({ escopo })`), reaproveitando `derivarEstadoTurno`, `expandirTurnos` e o `MarcarPresencaAvulsaDialog` já existentes.

Mantém: cards por corretor, chips por turno (Manhã/Tarde/Noite), botões Chegou/Saiu, ação "+ Marcar presença" avulsa, contadores no topo (Na empresa / Saiu / Falta / Na roleta).

### 2. Montar no dashboard do gerente

`V4PanelRoleta.tsx` vira um wrapper fino que renderiza `<PresencaRoletaPanel scope="gestor" gestorId={...} />`. Layout, título e posição no grid ficam iguais — nenhuma mudança visual pro gestor.

### 3. Montar no dashboard do CEO

Em `CeoDashboard.tsx`, adicionar um bloco novo "Presença da Roleta hoje" com `<PresencaRoletaPanel scope="ceo" />`. Posicionamento: acima ou ao lado dos blocos operacionais existentes (definir junto do bloco de fila/roleta se houver, senão logo abaixo do header de KPIs). Colapsável por padrão fechado, pra não pesar o dashboard.

### 4. Não mexer

- Central de Roleta (`/roleta`) segue exatamente como está — sem aba de presença.
- Regras de elegibilidade, RPC e edge function de fechamento do dia continuam idênticas.
- Nada de banco nesta etapa.

## Detalhes técnicos

- Novo arquivo: `src/components/roleta/PresencaRoletaPanel.tsx` (~300 linhas migradas de `V4PanelRoleta`).
- Novo hook (se necessário pra escopo CEO): `src/hooks/useRoletaPresencaDia.ts` — retorna `{ credenciados, presencas, isLoading }` para o dia atual em BRT, com realtime em `roleta_presencas`.
- `V4PanelRoleta.tsx` reduzido a wrapper.
- `CeoDashboard.tsx` ganha o import e a seção nova; sem tocar nos hooks/KPIs existentes.
- RLS: gestor já lê `roleta_presencas` da equipe; admin lê tudo. Sem alteração de policy.

## Fora de escopo

- Página `/roleta/presenca` dedicada.
- Aba "Presença" dentro da Central de Roleta.
- Ativar o gate duro de distribuição por presença (`system_flags.presenca_gate_distribuicao`) — segue desligado até você mandar ligar.
