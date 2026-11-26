# Oferta Ativa: cliente que já está no Pipeline com um corretor não pode aparecer de novo

## O que aconteceu (conferido no banco)
- Caroline Vieira (51 98234-0689) entrou na lista "Open Bosque · Oferta Ativa" em 01/10.
- Em 07/10 ela chegou pelo anúncio (Instagram) e foi para o Pipeline do Ebert. Hoje está em Aquecimento com ele.
- A ficha dela na lista nunca saiu. Hoje, entre 14h46 e 14h58, a Oferta Ativa mostrou a Caroline para a Géssica.
- Causa: a busca do próximo cliente da Oferta Ativa ("modo campanha") só tira quem pediu para não ser contatado ou já comprou. Ela não confere se o telefone já está com um corretor no Pipeline. A limpeza automática também não retirou essa ficha da lista.
- Isso não acontece só com ela: **177 clientes** das listas da Oferta Ativa estão hoje com um corretor no Pipeline (111 deles em listas liberadas).

## O que vou mudar
1. **Trava na hora de mostrar o cliente**: antes de entregar um cliente da Oferta Ativa a qualquer corretor, o CRM confere se o telefone (últimos 8 dígitos, telefone 1 ou 2) já está no Pipeline com um corretor, fora do descarte e dos arquivados. Se estiver, ele é pulado e não aparece. Vale para os dois caminhos de busca (lista normal e campanha).
2. **Limpeza dos 177**: retirar essas fichas das listas da Oferta Ativa, seguindo a regra que já existe (apaga só a ficha da Oferta Ativa; não muda nada no Pipeline, nem o corretor, nem a etapa). Antes de apagar, passo a lista para você conferir.
3. **Caroline**: continua com o Ebert. A parceria com a Géssica fica a critério dele, como ele disse no áudio.

## O que não muda
- Distribuição, Roleta, etapas e corretores do Pipeline.
- Clientes descartados ou arquivados continuam podendo ser trabalhados na Oferta Ativa.

## Validação
- Teste com transação revertida: cliente com dono no Pipeline não volta na busca; cliente sem dono continua aparecendo.
- Conferência no banco: zero clientes da Oferta Ativa com dono ativo no Pipeline depois da limpeza.

## Detalhes técnicos
- Funções `fetch_next_lead_campaign` e `fetch_next_lead`: adicionar `NOT EXISTS` em `pipeline_leads` por `right(regexp_replace(telefone,'\D','','g'),8)` (telefone e telefone2), `corretor_id IS NOT NULL`, `arquivado=false`, `stage_id <> descarte`, inclusive no fallback. Índice de expressão nos 8 dígitos se necessário.
- Limpeza via run_sql apagando de `oferta_ativa_leads` (status na_fila/em_cooldown) com a mesma condição; tentativas/eventos ficam pelo FK existente.
- 1 migration (dentro do limite do dia).
