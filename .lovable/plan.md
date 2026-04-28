## Problema

O Douglas Costa aparece como "Não vinculado" na tela "Meu Time" porque seu registro em `team_members` está incompleto:

- ✅ `gerente_id` = Gabriel Vieira (correto)
- ❌ `user_id` = NULL (deveria ser o auth.users.id do Douglas)
- ❌ `equipe` = NULL (deveria ser "Gabriel" como os demais)
- ✅ `status` = ativo

Por convenção (memória `team_members table is the sole source for manager-broker relationships`), o vínculo só é reconhecido quando `user_id` está preenchido com o `auth.users.id` do corretor.

## Dados

- **Douglas Costa**: `user_id = 70b93b6e-ec84-4981-9321-11a523049d6b`
- **Gabriel Vieira (gerente)**: `user_id = b3a1c3a4-f109-40ae-b5d4-15eff3a541ab`
- **Registro team_members do Douglas**: `id = b23bb4f2-45d6-4646-8da6-7a7dba2dc697`

## Ação

Executar UPDATE no registro existente:

```sql
UPDATE public.team_members
SET user_id = '70b93b6e-ec84-4981-9321-11a523049d6b',
    equipe = 'Gabriel',
    status = 'ativo',
    updated_at = now()
WHERE id = 'b23bb4f2-45d6-4646-8da6-7a7dba2dc697';
```

## Validação após aplicar

1. Conferir que Douglas aparece como "✓ Vinculado" na tela Meu Time do Gabriel
2. Confirmar que as visitas do Douglas passam a aparecer na agenda do gerente Gabriel (problema relatado anteriormente)
