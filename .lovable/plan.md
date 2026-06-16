## Contexto apurado

IDs canônicos:
- Gabrielle — `profiles.id` `12da96bd…`, `auth.users.id` `7882d73e…`
- Taynah — `profiles.id` `c4fc833f…`, `auth.users.id` `b473388d…`

Diagnóstico:
1. **Pipeline de Negócios só mostra a Taynah** — o hook `useNegocios` filtra a equipe do gestor por `team_members` (sem checar `status`) e a única linha restante sob a Gabrielle é a da Taynah (status `inativo`). Além disso o hook **não usa** `diretoria_equipes`/`resolve_managed_brokers`, então a Gabrielle não enxerga as equipes do Bruno e do Gabriel.
2. **VGV da antiga equipe não aparece** — as vendas assinadas com `gerente_id = 12da96bd` (antiga Equipe Gabrielle) não entram na conta dela porque os dashboards somam apenas por `corretor_id` da equipe resolvida, e os corretores foram remanejados para Bruno/Gabriel. Decisão do usuário: **só ajustar a visão/meta** para que esse VGV apareça **como a antiga equipe dela**.
3. **Taynah** — ainda tem 1 linha em `team_members` (inativo, sob a Gabrielle) e 14 negócios ativos no nome dela. 0 leads ativos, 0 `user_roles`. Decisão: **arquivar/descartar** os negócios e remover a presença dela.

## Mudanças

### 1. Corrigir o Pipeline de Negócios (`src/hooks/useNegocios.ts`)
Para o ramo `isGestor && !isAdmin`, substituir a consulta direta a `team_members` por:
- Chamar a RPC `resolve_managed_brokers(user.id)` → retorna os `auth_id` dos corretores das equipes geridas (inclui as equipes dos gerentes mapeados em `diretoria_equipes`, ou seja Bruno + Gabriel para a Gabrielle, e já exclui inativos como a Taynah).
- Mapear esses `auth_id` → `profiles.id` e filtrar `negocios.corretor_id IN (...)`.
- **Adicionalmente** incluir os negócios em que `gerente_id = profileId` do gestor (histórico da "antiga equipe dela"), unindo os dois conjuntos de IDs no filtro `.in("corretor_id", ...)` e mantendo um segundo fetch por `gerente_id` quando necessário.

Resultado: a Gabrielle passa a ver, no pipeline de negócios, as duas equipes que dirige + o histórico dela como gerente, e a Taynah some.

### 2. VGV/meta da diretora (`get_dashboard_gerente_v4_kpis` e correlatas)
Migration ajustando as CTEs de vendas (`vendas_atual`/`vendas_prev`) para somar negócios cujo `corretor_id` esteja na equipe resolvida **OU** cujo `gerente_id` seja o `profiles.id` do próprio gestor. Assim o VGV assinado da antiga Equipe Gabrielle aparece atribuído a ela, sem criar nenhuma venda nova. Aplicar o mesmo critério nas funções irmãs que calculam VGV do gestor (`get_dashboard_gerente_v4_dia`, `get_dashboard_gerente`) onde fizer sentido.

### 3. Remover a Taynah do CRM
- **Migration**: adicionar o valor `'arquivado'` como status aceito de negócio (já existem `ativo`/`perdido`; sem constraint rígida, então é só convenção).
- **Insert/Update (data)**: marcar os 14 negócios ativos da Taynah (`corretor_id = c4fc833f…`) como `status = 'arquivado'` para saírem do pipeline.
- **Insert/Update (data)**: remover a linha dela em `team_members` (`user_id = b473388d…`).
- Confirmar que `user_roles` e leads ativos já estão zerados (estão).

### 4. Memória
Atualizar a memória de estrutura de equipe registrando que a Gabrielle é Diretora sobre Bruno + Gabriel via `diretoria_equipes`, que o VGV da antiga equipe dela conta por `gerente_id`, e que a Taynah foi removida/arquivada.

## Detalhes técnicos
- `negocios.corretor_id` = `profiles.id` (nunca `auth.users.id`); `pipeline_leads.corretor_id` = `auth.users.id`. Sempre resolver antes de filtrar.
- `resolve_managed_brokers` é `SECURITY DEFINER` e já retorna `DISTINCT` apenas `status='ativo'`.
- Mudanças de dados (status dos negócios e remoção em `team_members`) via ferramenta de insert; mudanças de função via migration (respeitando o limite de migrations/dia).
- Nenhuma venda nova é criada — apenas a visão/meta passa a refletir o que já existe.

## Validação
- Query confirmando que a Gabrielle vê negócios das duas equipes + os de `gerente_id` dela, e nenhum da Taynah.
- Query confirmando 0 negócios ativos no nome da Taynah e 0 linhas em `team_members` para ela.
- Conferir no preview (`/negocios` logada como Gabrielle / via admin) que o board mostra as duas equipes e o VGV assinado do mês aparece.
