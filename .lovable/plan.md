Plano para fazer Gabrielle enxergar o pipeline de negócios das equipes Gabriel + Bruno:

1. Ajustar a permissão de leitura dos negócios
- Atualizar a política/função de acesso de `negocios` para usar `resolve_managed_brokers(auth.uid())`.
- Hoje o frontend já tenta buscar os corretores resolvidos, mas o banco ainda limita a leitura apenas à equipe direta do gestor. Isso bloqueia a visão consolidada de diretoria.
- A nova regra permitirá que uma gestora diretora veja negócios dos corretores ativos das equipes vinculadas em `diretoria_equipes`.

2. Manter o histórico da antiga equipe da Gabrielle
- Preservar a regra já planejada/implantada: Gabrielle também vê negócios onde `negocios.gerente_id` é o `profile.id` dela.
- Isso mantém a atribuição como antiga equipe dela, sem criar vendas novas.

3. Corrigir o card “Negócios em andamento” do dashboard de gestora
- Atualizar `get_dashboard_gerente_v4_dia` para incluir o mesmo escopo do pipeline: corretores resolvidos por diretoria + negócios com `gerente_id` da Gabrielle.
- Assim o resumo do dashboard e a tela `/negocios` ficam consistentes.

4. Validar com dados reais
- Confirmar que `diretoria_equipes` tem Gabrielle como diretora de Bruno e Gabriel.
- Confirmar que `resolve_managed_brokers(Gabrielle)` retorna os 29 corretores ativos.
- Confirmar que a consulta de negócios para Gabrielle passa a retornar negócios das duas equipes e não traz Taynah arquivada/inativa.

Técnico:
- Criar uma migration SQL para redefinir `can_access_negocio` e a policy `negocios_select_scoped`, adicionando o escopo de diretoria.
- Redefinir `get_dashboard_gerente_v4_dia` com filtro `n.corretor_id = ANY(v_team_prof) OR n.gerente_id = v_gestor_prof` no mini pipeline.
- Não alterar dados de vendas nem inventar VGV; é correção de visibilidade/permissão.