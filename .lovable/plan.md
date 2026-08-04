# Vincular a campanha "Casa Tua Canoas - Pré-venda" ao empreendimento canônico Casa Tua Canoas

## Situação atual (verificada no banco)

Os 6 leads do produto de Canoas chegam com:

- campanha: `Casa Tua Canoas - Pré-venda`
- empreendimento (texto): `Casa Tua Canoas - Pré` (cortado pelo Meta)
- formulário: `1766681441306699` (ID cru) nos 5 antigos; só o mais recente veio com o nome `Uhome - Casa Tua Canoas - Pré-lançamento`

Hoje só existem apelidos para `Casa Tua Canoas` (exato) e para o nome do formulário. Por isso apenas 1 dos 6 leads ficou vinculado — os outros 5 estão com o empreendimento canônico vazio.

## O que vou fazer

1. Cadastrar os apelidos que faltam apontando para **Casa Tua Canoas** (`5f28344e-...`):
   - campanha: `Casa Tua Canoas - Pré-venda`
   - empreendimento (texto): `Casa Tua Canoas - Pré`
   - formulário por ID: `1766681441306699` (trava mais forte, imune a mudança de nome)
2. Backfill: vincular os 5 leads existentes de Canoas ao empreendimento canônico Casa Tua Canoas.
3. Conferir depois que os 6 leads estão com o produto certo e que nenhum lead do Casa Tua Porto Alegre foi tocado.

## Ponto de atenção (fora do escopo, só aviso)

Existe 1 lead antigo (Marco Contreiras, 02/05) com o texto `Caasa Tua (canoas)` mas campanha de **Vértice - Las Casas**, hoje vinculado ao canônico de Las Casas. Como a origem real dele é a campanha do Vértice, deixo como está — me avise se quiser mover para Canoas.

## Detalhes técnicos

- Data change (sem migration de schema): `INSERT` em `empreendimento_aliases` (`alias_raw`, `alias_norm = normalize_alias(...)`, `tipo`, `empreendimento_id`) com `ON CONFLICT DO NOTHING`.
- Para o apelido por ID, `resolve_empreendimento_canonico` compara `tipo='formulario' AND alias_raw = p_form_id` (comparação crua), então o registro entra com `alias_raw = '1766681441306699'`.
- Backfill: `UPDATE pipeline_leads SET empreendimento_canonico_id = '5f28344e-...' WHERE empreendimento_canonico_id IS NULL AND campanha = 'Casa Tua Canoas - Pré-venda'` (atinge exatamente os 5 leads listados).
- Nenhuma função, RLS ou arquivo de frontend é alterado.
