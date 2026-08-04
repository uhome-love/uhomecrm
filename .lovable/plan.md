# Vincular a campanha "Casa Tua Canoas - Pré-venda" ao empreendimento canônico Casa Tua Canoas

## Conferência da campanha (só leitura, feita agora)

Sim, com certeza. Checagem cruzada no banco:

- Existem **7 leads** ligados a Canoas e os 7 têm o **mesmo ID de campanha do Meta: `120250824500980030`** ("Casa Tua Canoas - Pré-venda") e o **mesmo formulário `1766681441306699`**. Nenhum outro nome de campanha aparece (contagem de campanhas distintas = 1).
- Nenhum lead do Casa Tua Porto Alegre (campanha "Casa Tua - v3" e formulários antigos) entrou nesse grupo, e nenhum lead do formulário de Canoas foi parar no POA.

Um detalhe importante que a checagem revelou: **2 dos 7 são contatos que já existiam no CRM** e preencheram agora o formulário de Canoas — o histórico deles registra "NOVO INTERESSE 04/08 · Casa Tua Canoas - Pré":

- Leonardo Bueno — antes estava em Casa Tua (Porto Alegre)
- Ana Júlia Azambuja — antes estava em Vivid

Ou seja: 100% dos 7 têm interesse na campanha de Canoas; 5 são contatos inéditos e 2 são reaproveitados de outros produtos (comportamento correto da regra de "novo interesse").

O que está errado: 6 dos 7 leads estão **sem empreendimento canônico**, porque chegam com o formulário como ID cru (`1766681441306699`) e o texto do empreendimento cortado (`Casa Tua Canoas - Pré`), e não existe apelido para nenhum dos dois.


## O que vou fazer

1. Cadastrar os apelidos que faltam apontando para **Casa Tua Canoas** (`5f28344e-...`):
   - campanha: `Casa Tua Canoas - Pré-venda`
   - empreendimento (texto): `Casa Tua Canoas - Pré`
   - formulário por ID: `1766681441306699` (trava mais forte, imune a mudança de nome do formulário)
2. Backfill: vincular ao Casa Tua Canoas os 6 leads da campanha que estão sem produto.
3. Conferir depois: os 7 leads com o produto certo, e nenhum lead do Casa Tua Porto Alegre tocado.

## Ponto de atenção (fora do escopo, só aviso)

Existe 1 lead antigo (Marco Contreiras, 02/05) com o texto `Caasa Tua (canoas)` mas campanha de **Vértice - Las Casas**, hoje vinculado ao canônico de Las Casas. Como a origem real é a campanha do Vértice, deixo como está — me avise se quiser mover.

## Detalhes técnicos

- Data change (sem migration de schema): `INSERT` em `empreendimento_aliases` (`alias_raw`, `alias_norm = normalize_alias(...)`, `tipo`, `empreendimento_id`) com `ON CONFLICT DO NOTHING`.
- Para o apelido por ID, `resolve_empreendimento_canonico` compara `tipo='formulario' AND alias_raw = p_form_id` (comparação crua), então o registro entra com `alias_raw = '1766681441306699'`.
- Backfill: `UPDATE pipeline_leads SET empreendimento_canonico_id = '5f28344e-...' WHERE empreendimento_canonico_id IS NULL AND campanha = 'Casa Tua Canoas - Pré-venda'`.
- Nenhuma função, RLS ou arquivo de frontend é alterado.
