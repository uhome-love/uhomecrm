# Venda da Melissa Moreira (Casa Tua) aparecer nas vendas da Jéssica

## O que foi verificado
- A venda está correta no sistema: **Melissa Moreira — Casa Tua — R$ 658.200 — assinada em 14/04/2026**, ativa, em parceria 50/50 entre **Leo Dorneles** (dono do lead) e **Jéssica França**.
- O VGV oficial já dá R$ 329.100 para cada um dos dois.
- A venda está registrada **no nome do Leo**. Na tela Vendas Realizadas, ao procurar "Jéssica", a busca só olha o nome do **dono** da venda e ignora o parceiro. Por isso a Melissa não aparece quando você filtra pela Jéssica. O mesmo acontece em todas as parcerias (ex.: Dieison, que é do Flávio, não aparece ao buscar "Leo").
- Ela também só aparece com o período em **abril** ou **ano**, porque foi assinada em 14/04.

## O que será feito
1. A busca de Vendas Realizadas passa a encontrar a venda pelo nome **de qualquer um dos parceiros**, e não só do dono.
2. Quando a busca é pelo nome de um corretor, o VGV do topo soma **só a parte dele** nas parcerias (50%), igual ao VGV oficial. A busca por cliente ou empreendimento continua somando o valor cheio.

## Validação
- Abrir Vendas Realizadas, período "ano", buscar "Jéssica": a Melissa (Casa Tua, parceria com Leo) e o José Lauro (parceria com Gustavo) aparecem, além do Rodrigo Generoso.
- Buscar "Leo": aparecem a Melissa e o Dieison.
- Sem busca, o total da empresa não muda.

## Detalhes técnicos
- `src/pages/VendasRealizadas.tsx`, `filtered` (~linha 467): incluir no filtro os nomes de `parceriaPartners[v.pipeline_lead_id].auth_user_ids` resolvidos por `authProfiles`.
- `totalVGV`: quando o termo bate com o nome de um parceiro (e não com cliente/empreendimento), aplicar `fator_split` na venda em parceria.
- Sem mudança no banco.
