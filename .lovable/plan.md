## O que muda

Duas mudanças pequenas e coerentes:

**A) Deletar usuários fantasmas de vez** (`hugo teste`, `TIAGO MOLITOR`) — hoje só estão desativados (`ativo=false`), continuam ocupando espaço em consultas e podem voltar a aparecer se algum filtro esquecer o `ativo`. Deletar via migration com limpeza de refs.

**B) Fluxo "Presente / Saiu" com horário manual** na página `/roleta/presenca` (e no card compacto do dashboard). Gerente registra o horário real de chegada/saída em vez de o sistema carimbar `now()`. Não veio até o fim do turno = falta automática (já existe, mantém).

## Como valido a ideia

A ideia é sólida, com 3 pontos de atenção:

1. **Registro manual bate com o objetivo.** Hoje `chegou_em`/`saiu_em` viram `now()` no clique. Gestor que valida presença 14:30 de um cara que chegou 10:30 registra errado. Popup com hora resolve.
2. **Falta = "não preencheu até o fim do turno"** — já implementado pelo cron 01:00 BRT que fecha o dia. Reforço: adicionar um **aviso persistente no dashboard do gestor** enquanto o turno ativo tem corretores sem status marcado ("N corretores sem presença marcada — Manhã").
3. **Validação de horário**: hora de chegada tem que cair dentro do dia atual (BRT) e antes do momento presente; hora de saída tem que ser ≥ chegada. Se não preencher, aceita `now()` como fallback (default no input).

## Passos

### 1. Deletar usuários fantasmas (migration)
- Reatribuir/nullificar refs em tabelas onde `hugo teste` e `TIAGO MOLITOR` possam ter FKs (pipeline_leads.corretor_id, negocios, tarefas, presenças). Fazer `SELECT` pré-migration para dimensionar impacto.
- `DELETE FROM public.profiles WHERE id IN (...)` — trigger em cascata cuida do resto onde configurado; caso contrário, `SET NULL` explícito.
- `DELETE FROM auth.users` **não é seguro fazer diretamente** (schema gerenciado). Alternativa: manter em auth mas remover do `profiles` (some do app inteiro).

### 2. RPC aceitar horário manual
Estender `public.roleta_marcar_presenca` adicionando `p_chegou_em timestamptz DEFAULT NULL` e `p_saiu_em timestamptz DEFAULT NULL`. Se vier `NULL`, mantém comportamento atual (`now()`). Validações no plpgsql:
- `p_chegou_em`: entre início do dia BRT e `now()`.
- `p_saiu_em`: ≥ `chegou_em` existente e ≤ `now()`.

### 3. Frontend — Popup de horário
- `useRoletaPresencas.marcar` ganha params `chegou_em?` / `saiu_em?`.
- Em `PresencaRoletaPanel.tsx`:
  - Botão **"Chegou"** → **"Presente"** (label + ícone Check mantido).
  - Clicar em "Presente" abre `Dialog` com `input type="time"` pré-preenchido com hora atual BRT + botão "Registrar". Ao confirmar, dispara `marcar({ status: 'na_empresa', chegou_em })`.
  - Clicar em "Saiu" abre mesmo Dialog para hora de saída (default = agora), dispara `marcar({ status: 'saiu', saiu_em })`.
- Novo componente enxuto: `RegistrarHorarioDialog.tsx` (~60 linhas, reutilizado nos dois casos).

### 4. Aviso no dashboard do gestor
No card compacto de presença (`PresencaSummaryCard` no `GerenteDashboard`), quando `turno_ativo_atual` estiver rolando e houver corretores do time sem `roleta_presencas` do turno → banner amarelo: **"⚠️ 3 corretores sem presença marcada na Manhã — quem não for marcado até 12h vira falta"**. Link direto pra `/roleta/presenca`.

### 5. Backfill / dados existentes
Nenhum. Regra só passa a valer daqui pra frente.

## Detalhes técnicos

- Migration nova (RPC replace) + migration nova (delete profiles) — 2 migrations hoje, dentro do limite.
- Sem quebra: RPC continua compatível (params default NULL).
- Sem mudança no cron de falta automática — já roda 01:00 BRT e marca `falta` em quem não tem linha.
- ESTADO_LABEL mantém "Na empresa" internamente; só o **botão** vira "Presente" (mais direto pro gestor).

## Fora do escopo

- Editar horário de uma presença já registrada (pode virar Fase 2 na aba Auditoria).
- Mudar cor/tema.
