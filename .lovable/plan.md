

# Correção: Distribuição desbalanceada na roleta

## Diagnóstico (causa raiz encontrada)

Existem **duas vias de aprovação** de corretores na roleta que se comportam diferentemente:

| Via | Arquivo | Insere na `roleta_fila`? | Seta `na_roleta = true`? |
|-----|---------|:---:|:---:|
| CEO Dashboard (`/ceo`) | `CeoDashboard.tsx` `aprovar()` | Sim | **Sim** |
| Página Roleta (`/roleta`) | `useRoleta.ts` `aprovarCredenciamento()` | Sim | **Não** |

O SQL do `distribuir_lead_atomico` exige `cd.na_roleta = true` para distribuir (a menos que `p_force = true`):

```sql
AND (p_force = true OR (cd.na_roleta IS NOT NULL AND cd.na_roleta = true))
```

O modal "Disparar Roleta" (FilaCeoDispatchModal) usa `action: "dispatch_batch"`, que seta `forceDispatch = false`. Resultado: **corretores aparecem na UI da roleta** (lidos de `roleta_fila`) **mas são invisíveis ao motor de distribuição** (filtrados por `na_roleta`).

Com N corretores na fila mas só M elegíveis (M < N), os leads são distribuídos apenas entre os M, causando o desbalanceamento observado (4 leads para 1 corretor, 0 para outro).

## Correções (3 pontos)

### 1. Fix na `upsert_roleta_fila` (SQL migration)
Alterar o RPC para que, ao inserir/reativar um corretor na fila, ele **automaticamente** garanta `na_roleta = true` em `corretor_disponibilidade`. Isso resolve o problema na raiz, independente de qual UI chamou.

```sql
-- Dentro do upsert_roleta_fila, após INSERT/UPDATE:
INSERT INTO corretor_disponibilidade (user_id, na_roleta, status, segmentos)
SELECT p2.user_id, true, 'na_empresa', '{}'::text[]
FROM profiles p2
WHERE p2.id = p_corretor_id AND p2.user_id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
SET na_roleta = true, updated_at = now();
```

### 2. Fix em `useRoleta.ts` `aprovarCredenciamento()` (belt and suspenders)
Adicionar o mesmo upsert de `na_roleta = true` que já existe em `CeoDashboard.tsx` `aprovar()`, logo após inserir na fila. ~5 linhas.

### 3. Fix em `incluirManualNaFila()` no mesmo hook
Verificar que a inclusão manual também seta `na_roleta = true` (mesma lógica).

## O que NÃO muda

- O algoritmo round-robin do `distribuir_lead_atomico` está correto (DISTINCT ON + sync de timestamps entre segmentos)
- A lógica de batch dispatch sequencial com advisory lock está correta
- Nenhuma mudança no `distribute-lead` edge function
- Nenhuma mudança no `trg_auto_distribute_lead` trigger

## Resultado esperado

Qualquer caminho de aprovação/inclusão na roleta garante elegibilidade real. O próximo disparo em lote vai alternar corretamente 1-a-1 entre todos os corretores visíveis na tela.

