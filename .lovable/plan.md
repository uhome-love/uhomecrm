Diagnóstico confirmado nas queries e logs:

1. Lead "Tamiris" (aproveitada por Eliezer no Mutirão) foi salva em `pipeline_leads.corretor_id` com o `profiles.id` (7519c22e...) em vez de `auth.users.id` (cd3bd7ae...). A RLS do pipeline exige `corretor_id = auth.uid()`, então Eliezer não enxerga o lead em "Novo Lead".

2. Visita da Andrea (agendada por Rafaela no Mutirão) não foi inserida. O log da edge function `oferta-ativa-registrar-resultado` mostra: `null value in column "user_id" of relation "notifications"`. Causas:
   - `visitas.corretor_id` está sendo preenchido com `profiles.id` (015f5dbf...), mas triggers/notificações esperam `auth.users.id`.
   - `visitas.gerente_id` não está sendo resolvido pela edge function, fica null, e o trigger `notify_visita_criada` tenta notificar o gerente com `user_id` null, causando rollback da transação inteira.
   - `visitas.tipo` (NOT NULL) não está sendo enviado no insert.

O que será corrigido

1. **Edge function `supabase/functions/oferta-ativa-registrar-resultado/index.ts`**
   - Usar `auth.users.id` (`userId`) em `visitas.corretor_id` e em `pipeline_leads.corretor_id` (via `reactivateLead`).
   - Resolver `visitas.gerente_id` a partir de `team_members` do corretor antes do insert.
   - Enviar `tipo: "lead"` no insert de `visitas`.
   - Garantir fallback de `nome_cliente` para o nome do lead quando não vier no payload.
   - Após o insert, invalidar queries relevantes no frontend (já existe no hook, mas confirmar).

2. **Helper `supabase/functions/_shared/reactivateLead.ts`**
   - Alterar a API para receber `auth_user_id` e `profile_id` separadamente.
   - Atualizar `pipeline_leads.corretor_id` com `auth_user_id` (conforme mapa canônico de IDs).
   - Resolver e gravar `gerente_id` no lead quando aplicável.
   - Manter `profile_id` para uso em tabelas que exigem `profiles.id` (ex.: `oferta_ativa_participantes`, eventos pulse).

3. **Edge function `supabase/functions/oferta-ativa-historico-reaproveitar/index.ts`**
   - Passar `auth_user_id` para o `reactivateLead` corrigido.

4. **Backfill dos dados afetados (hoje)**
   - Atualizar `pipeline_leads.corretor_id` do lead Tamiris de `profiles.id` para `auth.users.id` do Eliezer.
   - Recriar a visita perdida da Andrea (Rafaela) com os dados disponíveis no lead e na ligação, preenchendo `tipo`, `corretor_id`, `gerente_id` corretamente.
   - Reexecutar triggers de tarefas automáticas de visita para a Andrea (se necessário, inserir tarefa manualmente).
   - Verificar se há outras visitas/alterações recentes do Mutirão com `corretor_id` = `profiles.id` e corrigir.

5. **Validação ponta a ponta**
   - Testar no preview: Eliezer acessa "Novo Lead" e visualiza Tamiris.
   - Testar no preview: Rafaela agenda visita via Mutirão e a visita aparece em "Agenda de Visitas" e o lead avança para etapa Visita no pipeline.
   - Verificar notificações e tarefas automáticas geradas.

Arquivos alterados
- `supabase/functions/_shared/reactivateLead.ts`
- `supabase/functions/oferta-ativa-registrar-resultado/index.ts`
- `supabase/functions/oferta-ativa-historico-reaproveitar/index.ts`

Backfill (via insert tool, não migration)
- `UPDATE pipeline_leads SET corretor_id = '<auth_user_id>', gerente_id = '<gerente_id>' WHERE id = '1c36f796-9140-4b64-9f19-e53f825b2a61';`
- `INSERT INTO visitas (...tipo, corretor_id, gerente_id...) VALUES (...)` para recriar a visita da Andrea.
- Revisão e correção de outras linhas recentes do Mutirão se encontradas.