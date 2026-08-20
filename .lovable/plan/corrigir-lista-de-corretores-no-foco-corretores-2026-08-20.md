# Corrigir lista de corretores no Foco Corretores

## O que está acontecendo

Camila Mota Dias, Guilherme Dias, Halime Maarouf, Leo Dorneles e Thalia Pereira **já estão inativos** no banco (`profiles.ativo = false`). Mesmo assim aparecem em Foco Corretores, porque a consulta que monta a lista busca todo mundo com papel "corretor" e **não filtra por perfil ativo**.

Gabriel Vieira aparece em "Sem equipe" porque o registro dele na tabela de equipes está com status "inativo" — ele é gerente da própria equipe ("Gabriel"), mas o vínculo está desligado, então o sistema não sabe a qual equipe ele pertence.

## O que será feito

1. **Filtrar inativos na lista** — passar a considerar apenas perfis ativos em Foco Corretores. Isso remove os 5 ex-colaboradores da tela automaticamente (Camila, Guilherme, Halime, Leo e Thalia Pereira), sem apagar histórico nem métricas passadas.
2. **Reativar o vínculo de equipe do Gabriel Vieira** — deixar o registro dele na equipe "Gabriel" como ativo, com ele mesmo como gerente. Ele passa a aparecer sob a equipe "Gabriel" em vez de "Sem equipe".

Nada de dados de leads, vendas ou histórico é alterado.

## Observações

- Thalia de Oliveira (equipe Gabriel) continua ativa e na lista — o pedido cita Thalia Pereira, que é outra pessoa e já está inativa.
- Se algum desses 5 ainda tiver leads ativos na carteira, isso não muda com esta correção; posso auditar depois se quiser.

## Detalhes técnicos

- `src/hooks/useFocoCorretores.ts` → `useCorretoresComAlocacao`: adicionar `.eq("ativo", true)` no select de `profiles` (a lista já usa `profiles` como base das linhas, então o filtro corta as linhas na origem).
- Ajuste de dados (via ferramenta de dados, não migration): `UPDATE public.team_members SET status = 'ativo' WHERE id = '464333ac-7279-4f55-acd3-39b3544e8781'` (Gabriel Vieira, equipe "Gabriel", gerente_id = próprio user_id).
- Validação ao vivo em `/foco-corretores` após o build: conferir que "Sem equipe" fica só com quem realmente não tem equipe e que Gabriel aparece na equipe "Gabriel".
