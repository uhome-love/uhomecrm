## Rodada 0 — Migration `ops_events` INSERT policy

Estou em plan mode; preciso da sua aprovação ("Implementar plano") para rodar a migration.

### O que será feito

Uma única migration adicionando policy de INSERT em `public.ops_events` para o role `authenticated`, permitindo que o frontend grave eventos de telemetria do Modo Foco (e qualquer outro `logFocus`/`logOps` client-side).

### SQL

```sql
CREATE POLICY "Authenticated can insert ops_events"
ON public.ops_events
FOR INSERT
TO authenticated
WITH CHECK (true);
```

### Justificativa

- RLS atual: só existe SELECT (admins via `has_role`). Sem INSERT, qualquer `supabase.from('ops_events').insert(...)` do cliente falha silenciosamente — bloqueia Item 5 (telemetria) da Rodada 2.
- `WITH CHECK (true)`: tabela é append-only de eventos; não há dado sensível do usuário cruzado (cada evento carrega seu próprio `ctx`). Risco baixo, reversível.
- Rollback documentado: `DROP POLICY "Authenticated can insert ops_events" ON public.ops_events;`

### Escopo

- ✅ Só essa policy.
- ❌ Nenhum arquivo `src/` tocado nesta rodada.
- ❌ Nenhuma outra tabela/policy alterada.

### Próximo passo

Após aprovação e execução bem-sucedida, aguardo seu **"execute rodada 1"** para começar Item 1 (BRT + hora) e Item 3 (régua 1/5/10) em `useFocusLeads.ts` e `FocusModeModal.tsx`. Conforme combinado, vou reler o estado atual desses arquivos antes de diffar — sem assumir nada de Fase B.
