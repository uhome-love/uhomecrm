# Achado crítico que bloqueia o publish — diagnóstico e liberação

## 1) Qual é o achado

Só existe **1 achado crítico ativo** hoje (scan re-rodado agora, 04:39 UTC de 23/08):

- **Nome:** "Employee PII (CPF, CRECI, phone) readable by any logged-in user"
- **internal_id:** `profiles_full_pii_exposed_to_all_authenticated` (scanner `supabase_lov`)
- **Onde:** tabela `public.profiles`, policy de SELECT `Authenticated users can view all profiles` com `USING (true)`
- **O que ele aponta:** que essa policy permitiria a qualquer usuário logado (inclusive corretor) ler todas as colunas de todos os perfis, incluindo `cpf`, `creci` e `telefone`

Os outros itens não bloqueiam: 1 error `Security Definer View` já marcado como ignorado por você e 4 warns (todos já ignorados anteriormente).

## 2) Veredito: FALSO POSITIVO

O scanner olha só a policy de RLS e não enxerga os **grants de coluna**, que já estão restritos no banco. Verificação feita agora, só leitura:

- Grant de tabela em `public.profiles` para `authenticated`: `awdDxtm` — **sem `r` (SELECT)**.
- SELECT concedido apenas coluna a coluna: `id`, `user_id`, `nome`, `cargo`, `avatar_url`, `created_at`, `updated_at`, avatares, `status_online`, `status_updated_at`, `de_plantao`, `ativo`, `slug_ref`.
- Teste direto de privilégio:
  - `has_column_privilege('authenticated', 'profiles', 'cpf', 'SELECT')` → **false**
  - `creci` → **false**
  - `telefone` → **false**
  - `nome` → true

Ou seja, a mitigação que o próprio achado pede ("revoke column-level SELECT on cpf/creci/telefone from authenticated") **já está aplicada**. A policy `USING (true)` sozinha não expõe nada, porque sem grant de coluna o Postgres nega a leitura antes da RLS.

## 3) Ação proposta

- Scan de segurança: **já re-rodado** (nenhum crítico real aberto).
- **Publicar o app em produção** para servir os arquivos estáticos novos em `public/`.
- **Nenhuma alteração de código, RLS, banco ou marcação de "ignorar"** — nada será tocado.

Se preferir, dá para deixar o achado marcado como ignorado depois (com justificativa dos grants de coluna) para ele parar de reaparecer — mas só se você pedir.
