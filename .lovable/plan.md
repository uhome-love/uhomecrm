## Fluxo canônico (validado ponta a ponta)

```text
1. CORRETOR              → pede credenciamento na roleta (manhã/tarde/noturna/domingo)
2. CEO                   → aprova credenciamento
                           (só quem foi aprovado recebe lead no turno)
3. GERENTE (por turno)   → marca "Chegou" quando o corretor está fisicamente na empresa
                           - manhã e tarde são independentes
                           - vale mesmo se o corretor NÃO se credenciou naquele turno
                             (chegou 10:30, credenciamento manhã já fechou → presença vale)
4. GERENTE (durante turno) → marca "Saiu" se corretor deixou a empresa antes do fim
                             → RPC roleta_marcar_presenca(status='saiu') já suspende
                               distribuição de lead pra ele naquele turno
5. FIM DO DIA (01:00 BRT)  → cron roleta_fechar_dia marca 'falta' quem não foi validado
6. ELEGIBILIDADE           → get_elegibilidade_roleta lê roleta_presencas:
                             - Noturna: exige presença 'na_empresa' em manhã E tarde no dia
                             - Domingo: exige 4 dias de presença + 2 visitas realizadas na semana
```

**Backend já suporta 100% desse fluxo** — RPC `roleta_marcar_presenca`, tabela `roleta_presencas`, cron `roleta_fechar_dia` e `get_elegibilidade_roleta` estão prontas e não precisam mudar.

## O que está errado hoje (só na UI)

O painel `PresencaRoletaPanel` **filtra a lista pelos credenciamentos aprovados do dia**. Consequência:

- Corretor que **não pediu credenciamento** de manhã mas chegou 10:30 → **não aparece na lista** → gerente não consegue clicar em "Chegou" → presença nunca é registrada → perde elegibilidade de noturna/domingo.
- O gestor tem que abrir o diálogo "Marcar presença avulsa" pra achar o corretor num dropdown, o que ninguém faz na prática.

Presença e credenciamento **são coisas diferentes** e a UI precisa refletir isso.

## Correção — só front-end, sem SQL

### 1. Nova fonte de dados: lista de corretores do dia

Novo hook `usePresencaCorretoresDia(scope, gestorId)` que devolve **todos os corretores relevantes**, credenciados ou não:

- `scope="gestor"`: `team_members` do gestor → `profiles` (nome, avatar, id) dos corretores ativos.
- `scope="ceo"`: `profiles` com `cargo='corretor'` e `ativo=true`.
- Junta com `roleta_credenciamentos` aprovados de hoje só pra marcar quais turnos cada um se credenciou (vira selo, não filtro).

Formato:
```ts
{
  turno_ativo_atual: 'manha' | 'tarde' | 'noturna' | 'domingo' | '-',
  corretores: Array<{
    corretor_id, nome, avatar_url,
    credenciamentos: Array<'manha'|'tarde'|'noturna'|'dia_todo'|'domingo'>,
  }>
}
```

### 2. Novo layout do card do corretor

Uma linha por corretor com **duas colunas fixas de turno (Manhã, Tarde)** e Noturna/Domingo aparecendo condicionalmente:

```text
[avatar] Fulano                                     [selo Roleta: 🎯M 🎯T]
  Manhã   [🟢 Na empresa]                          [Saiu]
  Tarde   [—]                                       [Chegou]
  Noturna (só se elegível: manhã E tarde na_empresa)
```

Regras de renderização por linha de turno:
- **Chip de estado**: usa `derivarEstadoTurno(presenca, credenciado)` já existente.
- **Selo "🎯 Na roleta"**: aparece quando o corretor tem credenciamento aprovado naquele turno. É informativo, não filtra.
- **Botões por turno**:
  - Sem presença → botão **Chegou** (marca `na_empresa` naquele turno específico).
  - Estado `na_empresa` → botão **Saiu** (marca `saiu`, remove da fila do turno).
  - Estado `saiu` ou `falta` → sem botão.

O turno **ativo agora** (via `getCurrentWindowInfo`) recebe borda/fundo destacado.

### 3. Cabeçalho e contadores

- Título: `Presença — {DataHoje}` (o "turno —" atual sai do lugar principal).
- Contador: **"Na empresa agora: X / Y"** onde:
  - X = corretores com presença `na_empresa` no turno ativo.
  - Y = total de corretores listados (time do gestor ou empresa).
- Fora de janela ativa (entre turnos): mostra "Presença de hoje" sem X/Y.

### 4. O que remover

- Filtro pela lista de credenciados aprovados (motivo do bug).
- Botão + diálogo **"Marcar presença avulsa"** — some, deixa de fazer sentido porque todo mundo já está listado.
- Empty state "Nenhum credenciamento aprovado hoje" → vira "Nenhum corretor no time" (só quando `corretores.length === 0`).

### 5. Arquivos afetados

- `src/hooks/usePresencaCorretoresDia.ts` (novo).
- `src/components/roleta/PresencaRoletaPanel.tsx` (reescrita do render — mantém contrato `scope`/`gestorId`/`hideManagerLink`).
- `src/hooks/useRoletaPresencaDia.ts` (deprecar/remover — substituído pelo novo hook).
- `src/components/dashboard-v4/V4PanelRoleta.tsx` e `src/pages/CeoDashboard.tsx`: nenhuma mudança, continuam usando o painel via `PresencaRoletaPanel`.

## O que fica igual (importante)

- Fluxo do corretor pedir credenciamento e CEO aprovar em `/roleta`.
- Marca "Saiu" durante o turno → RPC já remove da fila do turno atual (comportamento correto, mantido).
- Cron 01:00 BRT marca `falta` no fim do dia.
- Regras de elegibilidade noturna/domingo baseadas em `roleta_presencas`.
- Botões Chegou/Saiu por linha usam a **RPC existente** `roleta_marcar_presenca(p_turnos=[turno])`.

## Resultado esperado

- Gestor abre o dashboard → vê o time inteiro dele → clica **Chegou** na linha "Manhã" do Fulano que chegou 10:30 → presença gravada mesmo sem credenciamento manhã → à noite Fulano pode se credenciar na noturna.
- Fulano teve credenciamento manhã aprovado mas gerente clica **Saiu** às 09:30 → status vira `saiu`, roleta para de distribuir lead pra ele no turno da manhã. Se ele se credenciou também tarde, a linha da tarde continua independente.
- CEO no `/ceo` vê a mesma coisa, escopo empresa inteira.
