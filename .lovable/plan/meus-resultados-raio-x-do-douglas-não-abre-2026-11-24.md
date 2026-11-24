# Meus Resultados (Raio-X) do Douglas não abre

## O que acontece
A página mostra "Não consegui carregar o raio-x desse corretor. Motivo: canceling statement due to statement timeout": uma das buscas demora mais que o limite (~8s) e o banco a cancela.

## Causa encontrada
Entre as buscas da página, a do histórico de etapas (quantos leads foram para Documentação/Proposta/Contrato/Descarte no período) é a mais lenta: média 2,8s e picos de 7,9s, no limite do corte. Ela cruza o histórico com os leads do corretor e passa pelas regras de permissão linha a linha. Corretor com muito histórico (como o Douglas) estoura o tempo. Isso pode atingir qualquer corretor com bastante movimento, e não só ele.

## O que vou fazer
1. Medir a página para cada corretor ativo e listar quem também recebe o erro.
2. Trocar só essa busca por uma consulta no servidor que já devolve a contagem pronta para o corretor logado (o gestor vê os da sua equipe). Os números continuam os mesmos.
3. Se faltar uma das buscas, a página mostra o resto em vez de travar tudo.
4. Conferir no computador e no celular com o Douglas e com mais 2 corretores, comparando os números de antes e depois.

Nenhuma regra, distribuição ou dado muda: é só velocidade.

## Detalhes técnicos
- Nova função `raiox_movimentos_etapa(p_corretor uuid, p_de, p_ate)` SECURITY DEFINER com checagem (próprio, gestor da equipe via team_members, admin/diretor), usando os índices (stage_novo_id, created_at) e join direto em pipeline_leads.
- `useRaioXCorretor.ts`: substitui a query de pipeline_historico pela RPC; buscas usam allSettled para falha parcial.
- 1 migration (dentro do limite diário).
