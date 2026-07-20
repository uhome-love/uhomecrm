## O que vou fazer (backend + frontend + textos)

### Backend

**Migration (1 migration só, DDL):**
1. Tabela `roleta_presencas` (`corretor_id`→profiles, `data`, `turno` em [manha/tarde/noturna], `status` em [na_empresa/saiu/falta], `chegou_em`, `saiu_em`, `validado_por`, `validado_em`, `observacao`) com UNIQUE (corretor,data,turno). Grants + RLS: leitura autenticada, escrita só admin/gestor. Publicação em realtime.
2. `roleta_expand_turnos(text[])` — traduz `dia_todo` em `['manha','tarde']`.
3. `roleta_marcar_presenca(corretor, data, turnos[], status, obs)` — SECURITY DEFINER, valida role, aceita `auth.uid()` ou `profiles.id`, faz upsert por turno, e ao marcar `saiu` desativa a linha do corretor em `roleta_fila` naquele turno.
4. `roleta_fechar_dia(data)` — para todo credenciamento aprovado do dia sem presença correspondente, insere `falta`. Idempotente.
5. Config nova em `roleta_config`: `presencas_minimas_domingo=4`, `noturna_exige_manha_tarde=true`.
6. `get_elegibilidade_roleta` v2:
   - Noturna = geral + visita hoje + (presença `na_empresa` OU `saiu` em manhã E tarde).
   - Domingo = geral + `visitas_realizadas ≥ 2` + `COUNT DISTINCT dias com presença ≥ 4`.
   - Retorna novos campos `presente_manha_hoje`, `presente_tarde_hoje`, `presencas_semana`, `presencas_minimas_domingo`, `noturna_exige_manha_tarde`.

**Edge function + cron:**
- `supabase/functions/roleta-fechamento-dia/index.ts` chama `roleta_fechar_dia()`. Autenticação via `CRON_SECRET`.
- `pg_cron` diário 22:00 BRT (01:00 UTC).

### Frontend

1. **Hook novo** `src/hooks/useRoletaPresencas.ts`:
   - Query lista presenças do dia (join com credenciamentos para agrupar).
   - Mutation `marcarPresenca({corretor_id, data, turnos, status, obs})` chamando o RPC.
   - Realtime channel em `roleta_presencas`.

2. **Estado dinâmico do corretor** (lógica em `src/lib/roletaPresenca.ts`):
   - `saiu` > `na_empresa` > `na_roleta` (tem cred. aprovado sem presença) > `falta` (após fechamento).
   - Helpers de chip/cor.

3. **`V4PanelRoleta.tsx`** — extendido:
   - Chip de status dinâmico ao lado do nome (Na roleta cinza / Na empresa verde / Saiu amarelo / Falta vermelho).
   - Botões inline: `✓ Chegou` (na_empresa) e `→ Saiu` (saiu). Estado ↔ botões condicionais.
   - Botão topo `+ Marcar presença` que abre dialog para escolher corretor + turno(s) — cobre o caso "apareceu sem credenciar".

4. **`StatusElegibilidadeRoleta`** (corretor) — atualiza motivos de bloqueio:
   - "Aguardando validação de presença na tarde para liberar a Noturna"
   - "Faltam 2 presenças esta semana (2/4)"

5. **`useElegibilidadeRoleta.ts`** — tipa os campos novos.

### Rollout seguro

Fase A (este deploy): tudo acima ATIVO menos gate na distribuição de leads. Painel do gestor funcional, elegibilidade nova já aplicada, mas o dispatcher continua olhando `roleta_credenciamentos.status='aprovado'` como hoje. Zero risco pra funil.

Fase B (só depois de você validar em preview): ligo `system_flags.presenca_gate_distribuicao=true` e o dispatcher passa a exigir presença `na_empresa` para receber lead — corretor que só se credenciou e não foi validado não recebe até o gestor marcar Chegou. Reversível apagando a flag.

### Textos que vou entregar após o deploy

- **Guia para gerentes** (1 página) — regras, o painel, o botão "Marcar presença", o que muda pro corretor.
- **Recado curto pro time no WhatsApp** — 5–8 linhas em bullet points.

## Ordem de execução em build mode

1. Migration acima (via `supabase--migration`).
2. Edge function `roleta-fechamento-dia` + cron via `supabase--insert`.
3. Frontend (hook + libs + UI).
4. Verifico build/tsgo e testo o RPC via `supabase--read_query`.
5. Envio os 2 textos.

**Preciso que você troque para build mode para eu rodar.**
