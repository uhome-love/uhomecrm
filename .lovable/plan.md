

# Sync uhomesales_id no banco do site — Estratégia escolhida e plano

## TL;DR

Match por email é **100% limpo**. Recomendação: **Estratégia B (sync em massa no banco do site)**. Single SQL, 34 UPDATEs, sem ambiguidade.

## Resultado do dry-run

| Categoria | Qtd | Detalhe |
|-----------|-----|---------|
| ✅ Já sincronizados | 0 | Nenhum profile aponta pro user_id atual do CRM |
| 🔄 UPDATEs necessários | **34** | Todos os corretores reais — email bate, só atualizar `uhomesales_id` |
| ➕ INSERTs necessários | 0 | Todo CRM user real já tem profile no site |
| ⏭️ SKIPs (contas de teste) | 5 | naoexiste999, weakpw2, pentest-check, hot.testes01, teste@uhome.imb.br |
| ⚠️ Órfãos no site sem CRM | 0 | Todo profile do site bate com algum CRM user |
| ❓ Ambíguos (mesmo email duplicado) | 0 | 1:1 perfeito |

**Conclusão**: cada um dos 34 corretores reais tem exatamente UM profile no site com email idêntico. Os `uhomesales_id` atuais são lixo de uma base antiga (provavelmente da renomeação uhomesales → uhomecrm). Basta sobrescrever.

## Por que Estratégia B (sync no banco) e não A (match por email no hook)

| Critério | A (match por email no hook) | B (sync em massa) |
|----------|------------------------------|-------------------|
| Latência criação vitrine | +1 query lookup por email a cada criação | Lookup direto por uhomesales_id, igual hoje |
| Resiliência se admin trocar email | Precisa estar sincronizado em ambos | Idem (qualquer estratégia precisa) |
| Complexidade no hook | Adiciona fallback `eq(email)` se `uhomesales_id` falhar | Zero mudança no hook |
| Outros lugares que usam uhomesales_id | Continuariam quebrados | Conserta TUDO de uma vez |
| Reversibilidade | Trivial | Backup antes do UPDATE resolve |

A B conserta a raiz. A A só remendaria a vitrine — qualquer outra integração CRM↔site continuaria quebrada.

## Schema confirmado de `profiles` no site

```
id, email, nome, telefone, role, ativo, slug_ref, foto_url, avatar_url,
creci, uhomesales_id, sincronizado_em, created_at
```

Coluna canônica de ponte CRM↔site: `uhomesales_id` (não existe `auth_user_id`, `crm_id`, etc. — é mesmo essa).

## Plano de execução (próximo turno, em modo default)

### Passo 1 — Backup pré-sync
Salvar snapshot atual em `/mnt/documents/site_profiles_backup_pre_sync.json` (todos os 36 profiles com uhomesales_id atual) — para rollback se necessário.

### Passo 2 — Aplicar 34 UPDATEs no banco do site
Como o `psql` da sandbox aponta pro CRM, e migrations gerenciadas pelo Lovable também afetam o CRM, o UPDATE no site precisa ser feito via REST API com a anon key (se RLS permitir UPDATE) **ou** via SQL Editor manual no Supabase do site.

Subplano:
1. Tentar via REST PATCH `/rest/v1/profiles?id=eq.<site_profile_id>` com body `{"uhomesales_id":"<crm_user_id>"}` usando anon key.
2. Se RLS bloquear (esperado, anon não deve ter UPDATE em profiles), gerar arquivo `/mnt/documents/sync_uhomesales_id.sql` com os 34 UPDATEs prontos e pedir pro usuário rodar no SQL Editor do projeto do site (huigglwvvzuwwyqvpmec). É 1 minuto de trabalho manual.

Formato do SQL gerado:
```sql
-- Sync uhomesales_id: CRM (hunbxqzhvuemgntklyzb) → Site (huigglwvvzuwwyqvpmec)
-- 34 corretores reais. Contas de teste (naoexiste999, weakpw2, pentest-check, 
-- hot.testes01, teste@uhome.imb.br) intencionalmente fora.
BEGIN;
UPDATE profiles SET uhomesales_id = 'a5b6ca08-...', sincronizado_em = now()
  WHERE id = '5b58f658-...' AND email = 'adri.uhome@gmail.com';
-- ... (34 linhas, cada uma com WHERE email= como salvaguarda dupla)
-- Verificação antes do COMMIT:
SELECT email, uhomesales_id FROM profiles 
  WHERE email IN (...) ORDER BY email;
COMMIT;
```

Cada UPDATE filtra por `id = <site_profile_id> AND email = <email>` — duplo predicado garante zero risco de atualizar profile errado.

### Passo 3 — Validação pós-sync
Re-rodar o dry-run e confirmar que os 34 corretores aparecem como "Already OK" e nada mudou na contagem de órfãos/ambíguos.

### Passo 4 — Teste end-to-end
Criar uma vitrine real pelo `/imoveis` com qualquer corretor real. Hook deve achar o profile via `uhomesales_id`, INSERT deve passar, link público deve abrir. Se passou, fluxo está reparado pra todos.

### Passo 5 — Memória
Salvar `mem://integracoes/crm-site-profile-sync` documentando:
- `profiles.uhomesales_id` no site = `auth.users.id` no CRM
- Email é a chave secundária de match (caso uhomesales_id diverja no futuro)
- Renomeação uhomesales → uhomecrm causou drift histórico, resolvido em 2026-04-20

## Guardrails

NÃO tocar:
- Tabelas do CRM
- `created_by` no insert da vitrine (continua sendo `user.id` do CRM, semântica de auditoria)
- Qualquer hook além do `useCreateVitrine` (já está correto)
- Profiles de teste (5 contas listadas como SKIP)

Decisão necessária no próximo turno: aprovar geração do `.sql` para você rodar no SQL Editor do site, ou tentar primeiro via REST (se RLS permitir).

