## Objetivo

Fechar o fluxo ponta-a-ponta de presença com **auto-presença via trigger**, **escopos corretos** (admin/CEO/diretora = empresa inteira; gestor = time; corretor = próprio), **visibilidade dinâmica** no dashboard do corretor, e um **widget motivacional** que conecta presença → leads → negócios.

## Fluxo canônico

```text
Corretor pede credenciamento          →  status = pendente
CEO/diretora aprova                    →  status = aprovado
    └► TRIGGER cria roleta_presencas ('na_empresa', origem='auto_credenciamento')

Corretor abre dashboard
    RoletaStatusBar → ✅ Aprovado + 🟢 Presente desde HH:MM
    Widget Motivacional → "5 presenças este mês · 42 leads recebidos"

Se sair (corretor OU gestor):
    roleta_credenciamentos.status = saiu
    roleta_presencas.status = saiu          ← unificado
    Distribuição bloqueia · dashboard corretor mostra 🟡 Saiu às HH:MM

Novo dia (00:00 BRT):
    Card do corretor "zera" · status volta a refletir só o dia atual
    (histórico continua contando, mas não aparece como chip ativo)

01:00 BRT (cron):
    Aprovados sem presença → status='falta' (não aparece pro corretor
    no dia seguinte, só entra no histórico e nos rankings)
```

## Escopo por papel — final

| Papel | O que vê | Marca presença |
|---|---|---|
| **Corretor** | Só a si mesmo (dashboard + widget) | Só o próprio "Sair" |
| **Gestor** | Time dele (via `team_members`) | Time dele |
| **Diretora / CEO / Admin** | Empresa inteira, filtro opcional por gestor | Qualquer um |

Diretora entra na mesma trilha lógica de admin/CEO em todo lugar (rotas, RPCs, RLS).

## Widget do corretor — "Sua presença faz diferença"

Card compacto no dashboard do corretor, logo abaixo do `RoletaStatusBar`. Conecta presença com resultado para motivar.

```text
┌─────────────────────────────────────────────────────────┐
│  📊 Sua semana                                          │
│                                                         │
│   Presenças        Leads recebidos     Negócios criados │
│      5                 42                    3          │
│    ▲ +2 vs sem passada                                  │
│                                                         │
│   ─────────────────────────────────────────────         │
│                                                         │
│   Média da equipe: 4 presenças → 32 leads               │
│   Você: 5 presenças → 42 leads   (+31% acima)           │
│                                                         │
│   💡 Cada presença adicional = ~8 leads em média        │
│                                                         │
│   [ Ver detalhes → ]                                    │
└─────────────────────────────────────────────────────────┘
```

**Dados que puxa** (tudo do que já existe):

- `roleta_presencas` (presenças da semana, agrupadas por corretor)
- `roleta_distribuicoes` (leads recebidos na semana)
- `negocios` (criados na semana)
- Média da equipe: query agregada com `team_members` do gestor do corretor

**Regra do insight dinâmico** (frase de rodapé):

- Se `presencas_semana ≥ 5`: "🔥 Semana no ritmo. Continue!"
- Se `presencas_semana` acima da média do time: "+X% acima da média da equipe"
- Se abaixo: "💡 Cada presença adicional = ~N leads em média" (com N calculado do time)
- Se elegibilidade Domingo travada: "⛔ Falta 1 presença pra desbloquear Domingo"

**Aba mensal secundária** (toggle Semana/Mês) mostra o mesmo com escopo mês.

## Backend — 1 migration aditiva

1. **Coluna** `origem text` em `roleta_presencas` (default `manual_gestor`).
2. **Trigger** `trg_presenca_auto_credenciamento`:
   - `AFTER UPDATE OF status ON roleta_credenciamentos WHEN NEW.status='aprovado'`
   - `INSERT ... ON CONFLICT (corretor_id, data, turno) DO NOTHING` com `status='na_empresa'`, `origem='auto_credenciamento'`, `chegou_em=now()`.
3. **Trigger** `trg_presenca_sync_saiu`:
   - `AFTER UPDATE OF status ON roleta_credenciamentos WHEN NEW.status='saiu'`
   - Atualiza `roleta_presencas` correspondente para `status='saiu'`, `saiu_em=now()` (unifica "sair pelo corretor" com "sair pelo gestor").
4. **RPC** `get_presenca_agregada(_data_inicio, _data_fim, _gestor_id uuid DEFAULT NULL, _corretor_id uuid DEFAULT NULL)`:
   - Retorna por corretor: nome, avatar, gestor, diurnas, manhã, tarde, noturnas, domingos, faltas, saídas, dias_ativos.
   - Escopo pelo `auth.uid()` + role: corretor força `_corretor_id=auth.uid()`; gestor filtra por `team_members`; admin/CEO/diretora vê tudo.
   - `SECURITY DEFINER`, `search_path = public`.
5. **RPC** `get_presenca_hoje(_data date)`:
   - Retorna a lista pronta para a tab Hoje com escopo automático por role.
6. **RPC** `get_widget_corretor_semana(_corretor_id uuid, _periodo text)`:
   - Retorna `{ presencas, leads, negocios, media_time_presencas, media_time_leads, elegibilidade_domingo }` para o widget.
   - Se `_corretor_id` for de outro user e o caller não for admin/gestor do time, retorna erro.
7. **Policies em `roleta_presencas`**:
   - SELECT: corretor lê próprio; gestor lê time; admin/CEO/diretora lê tudo.
   - INSERT/UPDATE só via RPC `security definer` (ninguém escreve direto do client).
   - Trigger continua rodando com `security definer` do owner.

## Frontend — arquivos

**Editar (loop do corretor):**
- `src/components/corretor/RoletaStatusBar.tsx` — chip de presença por turno ao lado do chip de credenciamento; realtime da presença (subscription filtrada por `corretor_id`).
- `src/hooks/useRoletaPresencas.ts` — expor `presencasHoje` filtrado por `corretor_id` para uso no dashboard.

**Novos (widget motivacional):**
- `src/components/corretor/WidgetProdutividadeCorretor.tsx` — card com Semana/Mês toggle, comparação com média do time, insight dinâmico.
- `src/hooks/useWidgetProdutividadeCorretor.ts` — chama `get_widget_corretor_semana`.
- Inserir o widget em `src/pages/CorretorDashboard.tsx` logo abaixo do `RoletaStatusBar`.

**Novos (página de gestão):**
- `src/pages/PresencaRoleta.tsx` — página `/roleta/presenca` com tabs Hoje / Histórico / Auditoria.
- `src/components/roleta/presenca/{PresencaHojeGrid, PresencaCorretorCard, PresencaHistoricoTable, PresencaAuditoriaTable, PresencaKpiHeader}.tsx`
- `src/hooks/usePresencaAgregada.ts`

**Editar (rota + navegação):**
- `src/App.tsx` — rota lazy `/roleta/presenca`.
- `src/components/layout/Sidebar.tsx` — item "Presença" no grupo Roleta para admin/gestor/diretora.
- `src/pages/CeoDashboard.tsx` + `src/components/dashboard-v4/V4PanelRoleta.tsx` — trocar painel gigante por card resumo compacto com link "Abrir Presença →".

**Ajuste de role — diretora**: verificar `useUserRole()` e checks de `profiles.cargo`. Se `diretora` ainda não é reconhecido, adicionar na mesma trilha de `admin`/`ceo` em rotas, RPCs e RLS.

## Ordem de execução

1. **Migration**: coluna `origem` + trigger auto-presença + trigger sync-saiu + 3 RPCs + policies.
2. **Corretor — visibilidade**: `RoletaStatusBar` com chip de presença + realtime.
3. **Corretor — widget** produtividade + insight dinâmico.
4. **Página `/roleta/presenca`** com tab Hoje.
5. Tab **Histórico** + tabela agregada + export CSV.
6. Tab **Auditoria** (admin/CEO/diretora).
7. **Encolher** painéis no dashboard do CEO e do gestor.
8. **Sidebar + rota**.
9. **Validação ponta-a-ponta**:
   - Aprovar credenciamento → conferir presença auto-criada.
   - Chip aparece no dashboard do corretor em tempo real.
   - Corretor clica "Sair" → chip amarelo em ambos os lados.
   - Widget atualiza contadores.
   - Novo dia → chip do dia anterior some do dashboard do corretor.
   - Falta gerada no cron aparece só em Histórico/rankings.
   - Ranking de presenças e Relatório Semanal batem com a nova contagem.

Pronto pra implementar.