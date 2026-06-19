## Objetivo
Transferir **Douglas Costa** da equipe do **Gabriel Vieira** para a equipe do **Junior Padilha**.

## Situação atual (verificada no banco)
- Douglas Costa (`team_members.id` = `b23bb4f2-...`, user_id `70b93b6e-...`)
  - `gerente_id` = Gabriel Vieira (`b3a1c3a4-...`)
  - `equipe` = "Gabriel"
- Destino: Junior Padilha (`gerente_id` = `7a270cc1-...`, equipe "Junior")

A tabela `team_members` é a fonte canônica única da relação gestor↔corretor, então é o único registro que precisa mudar. Os leads, negócios e demais dados do Douglas continuam vinculados a ele (pelo `corretor_id`/`user_id` dele) — eles automaticamente passam a aparecer sob o Junior porque a visão de equipe lê de `team_members`.

## Mudança
Atualizar a linha do Douglas em `team_members`:
- `gerente_id` → `7a270cc1-a457-4a02-8a62-462ba5a98937` (Junior Padilha)
- `equipe` → "Junior"

```sql
UPDATE team_members
SET gerente_id = '7a270cc1-a457-4a02-8a62-462ba5a98937',
    equipe = 'Junior'
WHERE id = 'b23bb4f2-45d6-4646-8da6-7a7dba2dc697';
```

## Validação
- Reconsultar `team_members` para confirmar que Douglas aparece sob Junior.
- Confirmar na tela de Equipes que o Douglas (e seus leads/negócios) agora aparece no time do Junior e saiu do time do Gabriel.

Nenhuma alteração de código é necessária — é apenas uma mudança de dado.