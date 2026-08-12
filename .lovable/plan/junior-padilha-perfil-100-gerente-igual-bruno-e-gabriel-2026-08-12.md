# Junior Padilha — perfil 100% gerente (igual Bruno e Gabriel)

## O que foi verificado

- Papéis de acesso: Junior já tem exatamente os mesmos papéis do Bruno e do Gabriel (`gestor` + `corretor`). Nada a mudar aqui — o `corretor` é o mesmo que os outros dois gerentes têm.
- Equipe: Junior é gerente de 5 pessoas, com equipe "Junior" ativa. Preservada como está.
- Carteira: 24 leads ativos (Bruno tem 32 como gerente). Mantidos com ele, conforme sua decisão.
- Diferenças reais encontradas em relação ao Bruno/Gabriel:
  1. No menu lateral existe uma lista fixa no código que dá a ele um bloco extra "Modo Corretor" (Minha rotina, Agenda, Aceite de leads, Oferta ativa corretor). Bruno e Gabriel não têm esse bloco.
  2. O cadastro dele está com cargo "corretor"; Bruno e Gabriel estão como "gerente".
  3. Histórico de credenciamento na roleta como corretor (último em 01/08). Bruno e Gabriel não têm nenhum.

## O que será feito

1. Remover o bloco "Modo Corretor" do menu do Junior — o menu dele passa a ser idêntico ao do Bruno e do Gabriel.
2. Corrigir o cargo dele para "gerente" no cadastro (afeta como ele aparece nas telas de usuários/equipe).
3. Encerrar credenciamentos de roleta ainda abertos em nome dele, para ele não voltar a receber lead como corretor. Histórico antigo é preservado (nada é apagado).

## O que NÃO muda

- Papéis de acesso (fica igual ao Bruno/Gabriel).
- Equipe e liderança dos 5 corretores.
- Os 24 leads da carteira dele, negócios, metas e todo o histórico de vendas/VGV.
- Aparições dele como gerente em Placar do Dia, filtros de equipe do Pipeline e Dashboard CEO.

## Detalhes técnicos

- `src/components/layout/Sidebar.tsx`: remover o auth_id `7a270cc1…` de `CORRETOR_MODE_GESTORES` (a lista fica vazia; a constante e o `MODO_CORRETOR_GROUP` permanecem para uso futuro).
- Data change (sem migration/DDL): `UPDATE public.profiles SET cargo = 'gerente' WHERE user_id = '7a270cc1…'`.
- Data change: `UPDATE public.roleta_credenciamentos SET status = 'saiu'` para linhas com status `aprovado` do profile `295c6c03…` que ainda estejam vigentes hoje. Sem DELETE.
- Sem mudanças em `user_roles`, `team_members`, `pipeline_leads` ou `negocios`.

## Validação após o build

- Abrir o preview como Junior (ou simular o papel) e conferir que o menu lateral bate item a item com o do Bruno.
- Conferir na Central de Usuários que ele aparece como gerente, com a equipe intacta.
- Conferir na Roleta que ele não figura como corretor credenciado, e que a fila/distribuição da equipe dele segue normal.
