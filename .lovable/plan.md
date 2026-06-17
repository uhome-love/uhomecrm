## Objetivo
Garantir que a Gabrielle, como gestora diretora, tenha acesso completo às duas equipes (Gabriel e Bruno) em todas as visões: agenda de visitas, pipeline de leads e pipeline de negócios.

## Diagnóstico (o que já funciona x o que falta)

A hierarquia de diretoria já está corretamente configurada:
- `diretoria_equipes`: Gabrielle é diretora de Gabriel e Bruno.
- `resolve_managed_brokers(Gabrielle)` retorna os 29 corretores ativos das duas equipes.

Visões já corrigidas em sessões anteriores (nada a fazer):
- **Pipeline de leads** — a policy de `pipeline_leads` usa `is_lead_in_my_team()`, que já chama `resolve_managed_brokers`. Cobre as duas equipes.
- **Pipeline de negócios** — `can_access_negocio` e a policy de `negocios` já usam `resolve_managed_brokers`. Dashboard (`get_dashboard_gerente_v4_dia`) também já usa o time resolvido.

Lacuna encontrada:
- **Agenda de visitas** — as policies de leitura da tabela `visitas` para gestor só enxergam a equipe DIRETA (`gerente_id = auth.uid()` e `team_members` com `gerente_id = auth.uid()`). Não usam a hierarquia de diretoria, então a Gabrielle NÃO vê as visitas das equipes do Gabriel e do Bruno.
- **Criação/edição de visita** (`useVisitas.createVisita`) — a validação restringe o gestor a corretores cujo `gerente_id = user.id`. Uma diretora não consegue agendar/editar visita para um corretor das equipes geridas.

## Mudanças

### 1. RLS de leitura de `visitas` (migration)
Adicionar uma policy de SELECT para diretoria, espelhando o padrão já usado em leads/negócios:

```text
CREATE POLICY "Diretores can view managed teams visitas"
ON public.visitas FOR SELECT
USING (corretor_id IN (SELECT user_id FROM public.resolve_managed_brokers(auth.uid())));
```

Com isso a Gabrielle passa a ver, na Agenda de Visitas e nos cards do dashboard, as visitas das duas equipes. As policies atuais (equipe direta, corretor próprio, parcerias) permanecem intactas — a nova é aditiva.

### 2. Criação/edição de visita para times geridos (`src/hooks/useVisitas.ts`)
Ajustar a validação de `createVisita` para que um gestor diretor possa agendar para qualquer corretor das equipes geridas:
- Trocar a checagem `team_members.gerente_id = user.id` por uma validação baseada em `resolve_managed_brokers(user.id)` (RPC) para autorizar o `corretor_id`.
- Definir `gerente_id` da visita como o `gerente_id` real do corretor em `team_members` (gerente direto: Gabriel ou Bruno), em vez de forçar `user.id`. Isso mantém a atribuição correta da visita ao gerente direto e ainda fica visível para a diretora via a policy do item 1.

### 3. Verificação
- Confirmar via consulta que a Gabrielle passa a contar visitas das duas equipes.
- Validar no preview: Agenda de Visitas (filtro "Meu time"), pipeline de leads e pipeline de negócios mostrando ambas as equipes.
- Conferir que nada vaza para fora das equipes geridas (sem Taynah, sem corretores de outros gestores).

## Observações
- Não haverá criação de dados nem alteração de VGV; são ajustes de visibilidade/permissão e de fluxo de criação de visita.
- Migration apenas DDL (1 policy), dentro das regras de limite diário.
