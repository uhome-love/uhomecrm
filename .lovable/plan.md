# Gerente encontrar e repassar leads livres na Busca de Leads

## O que encontrei
- A Busca de Leads pesquisa em dois lugares: Oferta Ativa e Pipeline.
- **Oferta Ativa:** o gerente já enxerga tudo. Aqui não há problema.
- **Pipeline:** o gerente só enxerga leads de corretores da equipe dele, ou leads que ele mesmo criou. Por isso não aparecem leads descartados ou inativados de outras equipes, leads de ex-corretores e leads sem corretor. Também não aparecem leads que estão na Fila do CEO.
- O botão Repassar grava direto no lead e esbarra na mesma trava. Mesmo quando o gerente encontra o lead, não consegue repassar se ele for de fora da equipe.

## A regra nova
O gerente encontra, além do que já vê hoje, qualquer lead do Pipeline que esteja **livre**:
- em Descarte;
- inativado/arquivado;
- sem corretor;
- com corretor desligado ou inativo.

**Não aparece** quando o lead está ativo no Pipeline (fora de Descarte e não arquivado) com outro corretor ativo de fora da equipe do gerente. Nesse caso o repasse fica bloqueado.

O gerente repassa só para corretores da equipe dele. O lead vai para o corretor escolhido em Novo Lead, com o histórico registrado ("repassado via Busca por <gerente>"). O ciclo recomeça limpo pela regra de reentrada que já existe.

Para quem vê o resultado da busca, só muda isto: os leads livres de fora da equipe aparecem com a etiqueta **"Livre para repasse"**. Telas, botões e o modal de repasse continuam iguais.

## O que não muda
- Admin, diretora e corretores continuam vendo exatamente o que já veem hoje.
- Roleta, Bolsão, Oferta Ativa e as regras de distribuição não são tocadas.
- O gerente não passa a ver dados de leads em atendimento de outras equipes.

## Validação
- Com um lead de teste em cada situação (descartado, arquivado, sem corretor, ativo com corretor de outra equipe), conferir no papel de gerente quais aparecem.
- Testar o repasse para um corretor da equipe e confirmar que foi recusado o repasse para corretor de fora.
- Conferir no computador e no celular (390px).
- Apagar os leads de teste no final.

## Detalhes técnicos
- Nova RPC `buscar_leads_repasse_gestor(filtros)`, com SECURITY DEFINER e exigência de `has_role(gestor)`. Ela retorna os mesmos campos que `useBuscaLeads` usa hoje, com no máximo 200 linhas e os mesmos filtros (nome, telefone, email, empreendimento, origem, datas). Critério de "livre":
  - `arquivado`;
  - etapa `descarte`;
  - `corretor_id` nulo;
  - corretor sem perfil ativo.
- Nova RPC `repassar_lead_gestor(p_lead_id, p_corretor_id, p_motivo)`. Ela confere de novo que o lead está livre ou já é da equipe, e que o destino está em `team_members` do gerente. Depois atualiza corretor, aceite, `arquivado=false` e etapa Novo Lead, e grava `pipeline_historico` e `pipeline_anotacoes` na mesma transação.
- `useBuscaLeads.ts`: para gestor (não admin/diretor), faz merge do resultado atual com a RPC, sem duplicar por id e com a flag `livre_repasse`. `repassarPipelineLead` usa a RPC nova quando o usuário é gestor. Admin continua no caminho atual.
- `BuscaLeads.tsx`: só ganha a etiqueta "Livre para repasse".
- Uma migration, com GRANT EXECUTE para `authenticated`.
