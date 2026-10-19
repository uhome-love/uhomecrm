# Registrar a venda do Lucas Andrey (Jéssica França, Open Bosque)

## O que foi encontrado
- **Lucas Andrey** (+55 51 98523-1634, aandrey-@hotmail.com) **não existe no Pipeline** e não tem venda registrada. Por isso a venda não aparece para a Jéssica.
- Ele só existe na **Oferta Ativa**: lista "Open Bosque", na fila para ligação, entrou pela Base Única em 01/10. Um cliente que já comprou não deveria estar nessa fila.

## O que será feito
1. **Criar o lead no Pipeline**, no nome da Jéssica, já na etapa **Ganho**. Ele não entra na Roleta, não recebe aviso e não aparece no quadro de trabalho do dia a dia; aparece só no filtro "🏆 Ganhos".
2. **Registrar a venda**: Open Bosque, Torre 1, unidade 1211, **R$ 289.325,00**, assinada em **20/04/2026**, sem parceria.
3. **Equipe Gabrielle**: a venda conta para a equipe da época (Gabrielle), como as outras vendas da Jéssica de abril (ex.: Melissa Moreira).
4. **Tirar o Lucas da fila da Oferta Ativa**, para ninguém ligar oferecendo imóvel para quem já comprou.
5. Anotação no lead: "Venda registrada na auditoria de 19/10 — feita em 20/04 na equipe Gabrielle".

**Sobre deixar arquivado:** o sistema não deixa arquivar um lead com venda ganha. Essa trava existe para a venda não sumir dos relatórios. Na etapa Ganho o lead já fica fora do quadro de trabalho, que é o mesmo efeito prático.

## Resultado esperado
- VGV da Jéssica em 2026: R$ 2.946.940,85 → **R$ 3.236.265,85**.
- Vendas de abril: +1 venda, +R$ 289.325 na equipe Gabrielle.

## Detalhes técnicos
- INSERT em `pipeline_leads` (corretor_id = auth da Jéssica `c988f004-…`, stage = Ganho, `aceite_status='aceito'`, `aceito_em` preenchido, origem `base_unica`, empreendimento "Open Bosque", `campanha` "Open Bosque" para o canônico) e INSERT em `negocios` (`corretor_id` = profile `476f21f2-…`, `auth_user_id` = `c988f004-…`, `fase='ganho'`, `status='ativo'`, `vgv_final=289325`, `unidade='Torre 1 - 1211'`, `data_assinatura='2026-04-20'`), ligando `pipeline_leads.negocio_id`. Lead criado já com dono e aceito para a distribuição automática não pegar.
- Remover só a linha `oferta_ativa_leads` `accd948b-…` (regra de exclusividade da Oferta Ativa).
- Depois: conferir em `v_fato_venda` (equipe = Gabrielle, R$ 289.325) e em Vendas Realizadas, período abril, buscando "Jéssica".
- Somente dados; sem migration.
