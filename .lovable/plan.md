# Leads de AWA respeitando o foco do corretor na roleta

## O que está acontecendo

A regra de distribuição já é a que você quer: **se o lead tem produto identificado, só recebe quem está alocado naquele produto e ativo no turno; senão o lead fica na Fila do CEO** (`sem_alocado_produto`).

O problema é que os leads de AWA vindos do anúncio **não estão sendo identificados como AWA**. Eles chegam com campanha/empreendimento `"AWA - Preview v1"`, e o único apelido cadastrado hoje é o texto exato `"AWA"`. O casamento é por igualdade exata do texto normalizado, então `"AWA - Preview v1"` não bate com `"awa"` → o lead fica com produto vazio → cai no rodízio por segmento, ignorando o foco.

Confirmado no banco:

- 3 leads recentes com `campanha = "AWA - Preview v1"` e produto canônico nulo (Marcelo Moura, Ricardo Dutra, Matheus Beck) — distribuídos pelo pote de segmento.
- Os leads de AWA que vieram do reengajamento (texto exato "AWA") estão corretos, com produto AWA.

## O que vai ser feito

1. **Cadastrar os apelidos que faltam para AWA**: `AWA - Preview v1` como campanha e como texto de empreendimento (e as variações que aparecerem na lista de não identificados).
2. **Corrigir os leads já afetados**: preencher o produto AWA nos leads recentes que ficaram sem produto e que vieram dessa campanha. Leads já aceitos por corretor não são redistribuídos — só passam a contar como AWA. Os que ainda estiverem pendentes voltam a ser distribuídos pela regra de foco (ou ficam na Fila do CEO se não houver alocado ativo).
3. **Evitar repetição do problema**: casamento por prefixo/contém no reconhecimento de produto — se a campanha começa com um apelido conhecido (`AWA - Preview v1` → `AWA`), o produto é reconhecido. Fica valendo a prioridade atual: apelido exato primeiro, prefixo só como segunda tentativa.
4. **Visibilidade**: o card "Produtos não identificados" em Foco Corretores já lista esses textos; ele passa a ser o ponto para o CEO vincular apelidos novos antes de subir campanha.

## Detalhes técnicos

- Inserts em `public.empreendimento_aliases` (tipos `campanha` e `empreendimento_texto`) apontando para `empreendimentos_canonicos` AWA (`cda11585…`) — via `vincular_alias_com_backfill`, que já faz o backfill dos leads.
- Ajuste em `public.resolve_empreendimento_canonico` e `public.resolver_empreendimento_canonico`: após as tentativas exatas, tentar `alias_norm` como prefixo do texto normalizado do lead, escolhendo o apelido mais longo (evita casar "awa" dentro de outra palavra — o casamento exige limite de palavra/prefixo seguido de separador).
- `public.distribuir_lead_atomico` **não muda**: a regra de foco + Fila do CEO já está correta.
- Uma única migration (DDL + inserts de apelido), dentro do limite diário.

## Validação depois do build

1. Conferir que os 3 leads de `AWA - Preview v1` aparecem com produto AWA.
2. Criar um lead de teste com campanha `AWA - Preview v1` e confirmar em `distribuicao_historico` que o registro sai com `pool = 'alocado'` (ou `fila_ceo` com motivo `sem_alocado_produto` se ninguém alocado estiver ativo) — nunca `pool = 'segmento'`.
3. Conferir que os demais empreendimentos continuam distribuindo normalmente (nenhum texto genérico passou a casar com AWA).
