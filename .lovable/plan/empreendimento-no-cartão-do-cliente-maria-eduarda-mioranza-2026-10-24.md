# Empreendimento no cartão do cliente (Maria Eduarda Mioranza)

## O que encontrei
- O negócio da Maria Eduarda já tem empreendimento: **Casa Tua Porto Alegre, unidade 505**.
- O cartão mostra "—" porque lê o empreendimento da **ficha do cliente**, que está vazia. Ou seja, o dado existe, mas está em outro lugar.
- Na ficha do cliente não há um campo simples para escrever/escolher o empreendimento ou um imóvel de interesse.

## O que vou fazer
1. **Cartão mostra o empreendimento do negócio quando o do cliente estiver vazio** (ex.: "Casa Tua Porto Alegre · 505"). Resolve a Maria Eduarda e casos iguais na hora, sem mexer em dados.
2. **Campo "Empreendimento / imóvel de interesse" na ficha do cliente**, com lápis para editar:
   - busca nos empreendimentos cadastrados (ativos e inativos), mesmo buscador já usado na venda;
   - botão "Adicionar imóvel ou empreendimento" para avulso/terceiros (fica fora de Roleta, Foco e anúncios, como já combinado);
   - ao salvar, grava o produto também no campo de campanha, para o valor antigo não voltar sozinho.
3. Cartão vazio ganha atalho "+ Adicionar empreendimento" que abre esse campo.
4. Preencher os clientes que estão em negociação sem empreendimento na ficha mas com empreendimento no negócio (lista conferida antes, sem mexer em etapa nem corretor).

## Validação
- Abrir Maria Eduarda no preview: cartão mostra Casa Tua Porto Alegre · 505.
- Com cliente de teste: escolher empreendimento, adicionar imóvel avulso, conferir que não volta ao valor antigo e que não muda etapa/corretor; apagar o teste.

## Detalhes técnicos
- `CardMinimal.tsx`: fallback para `negocioInfo.empreendimento` + unidade.
- Novo editor na ficha do lead reutilizando `EmpreendimentoVendaPicker` / `criar_empreendimento_venda`; update em `pipeline_leads.empreendimento` + `campanha` (trigger de canônico recalcula).
- Backfill via consulta de dados (não migration), só `empreendimento` nulo.
