# Fila CEO — produto correto no reengajamento + botão "Repassar"

## O problema (confirmado no banco)

1. **Produto não atualiza.** Os dois leads que estão hoje na aba Reengajamento (Montanha e Marcus) responderam ao template `awa_reengajamento_v1` (disparo de hoje, 15:23/15:24 BRT, origem Base Única), mas continuam gravados como **Connect JW - v2** e **Shift** — o produto antigo. Motivo: as funções de reativação (`reativar_base_lead_para_fila_ceo`, `reativar_oferta_ativa_para_fila_ceo`, `reativar_lead_para_fila_ceo`) têm a lista de templates → empreendimento escrita à mão, e nela existem Casa Tua, Casa Tua Canoas, Vivid, Flow, Lake Baikal, Connect JW e Átrio — **AWA não está na lista**. Sem match, o produto simplesmente não é reescrito e o lead chega na Fila CEO com o interesse velho.

2. **Sem repasse manual.** O botão "Repassar" existe nas abas Novos e LIA, mas **não existe na aba Reengajamento** — hoje só dá para jogar esses leads na roleta ou na Oferta Ativa.

## O que será feito

### 1. AWA passa a re-rotular o lead
Incluir AWA no mapa de templates das três funções de reativação, com a mesma regra já usada nas outras: ao responder SIM, o lead passa a ser AWA (produto, campanha e observação "[NOVO INTERESSE] AWA"), zerando formulário/anúncio antigos, exatamente como acontece hoje com Casa Tua Canoas.

### 2. Corrigir os dois leads que já entraram
Reaplicar o produto AWA (com a observação de novo interesse) nos leads reativados hoje pelo template `awa_reengajamento_v1` que ficaram com o produto antigo — Montanha e Marcus.

### 3. Botão "Repassar" na aba Reengajamento
Cada lead da aba Reengajamento ganha o mesmo botão "Repassar" das abas Novos e LIA, abrindo o mesmo seletor de corretor/gestor (busca por nome, escolhe quem atende, entrega direto sem passar pela roleta). Nada muda no comportamento das outras abas nem nos botões de roleta/Oferta Ativa.

### 4. Badge do produto
Na lista de reengajamento, o badge do empreendimento passa a mostrar AWA para esses leads, já que o produto real terá sido corrigido.

## Detalhes técnicos

- **Migration**: `CREATE OR REPLACE` das funções `reativar_base_lead_para_fila_ceo`, `reativar_oferta_ativa_para_fila_ceo` e `reativar_lead_para_fila_ceo`, adicionando a regra `v_tpl ILIKE '%awa%'` → `AWA`, posicionada de forma a não colidir com outros nomes (checagem por palavra), resolvendo o `empreendimento_canonico_id` via `empreendimentos_canonicos`/`empreendimento_aliases` como já é feito.
- **DML** (ferramenta de dados, não migration): update dos leads `138d12aa…` (Montanha) e `503f076d…` (Marcus) para `empreendimento`/`campanha` = AWA + `empreendimento_canonico_id` do AWA + observação de novo interesse; `formulario`/`conjunto_anuncio`/`anuncio` zerados.
- **Frontend**: em `src/components/pipeline/FilaCeoDispatchModal.tsx`, adicionar o botão que chama `setRepasseLead({ id, nome })` dentro do card da aba Reengajamento, reusando `FilaCeoRepassarDialog` já montado no componente.
- Sem alterações em edge functions e sem alterar a lógica de distribuição da roleta.
