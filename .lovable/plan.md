# Corrigir produto errado no reengajamento de Casa Tua Canoas

Você está certo: quem respondeu ao disparo do **Casa Tua Canoas** está sendo etiquetado como **Casa Tua Porto Alegre**.

## O que está acontecendo (confirmado)

- A Maristela Câmara recebeu e respondeu "Sim" ao modelo `abertura_casatuadecanoas` hoje às 15:24/15:35.
- A regra que traduz o nome do modelo em produto reconhece "casatua**canoas**", mas o nome do modelo é
  "casatua**de**canoas". Como não bate, cai na regra genérica de "casatua" e vira **Casa Tua Porto Alegre**.
- Esse mesmo defeito está em três lugares do backend (as duas rotinas de reativação que têm a regra,
  uma terceira que nem tem regra de Canoas, e o recebimento de mensagens do WhatsApp).
- A correção que fiz mais cedo foi só na tela (rótulo do disparo). Quem grava o produto no lead é o backend.

## O que vou fazer

1. **Passar a reconhecer Canoas de verdade** em todos os pontos que decidem o produto pelo nome do modelo:
   qualquer modelo que contenha "canoas" vira **Casa Tua Canoas**, sempre antes da regra genérica de Casa Tua.
   Isso cobre `abertura_casatuadecanoas`, `casatuacanoas_novidade` e futuros nomes com Canoas.
2. **Incluir a regra de Canoas onde ela nem existe** (a rotina de reativação vinda de listas de Oferta Ativa
   e o recebimento de mensagens), para não sobrar caminho errado.
3. **Corrigir a Maristela** (e conferir se houve outros respondentes do mesmo disparo de hoje): trocar o
   produto para Casa Tua Canoas, mantendo o lead onde está, sem redistribuir nem apagar nada.
4. **Validar ao vivo**: abrir a Fila CEO e conferir que o lead aparece com a etiqueta **Casa Tua Canoas**;
   e conferir num teste sem enviar nada que o próximo respondente cairia no produto certo.

## Detalhes técnicos

- Migration só de funções (`CREATE OR REPLACE`), sem DDL de tabela:
  `reativar_base_lead_para_fila_ceo`, `reativar_lead_para_fila_ceo`, `reativar_oferta_ativa_para_fila_ceo` —
  trocar o teste de Canoas por `v_tpl ILIKE '%canoas%'` mantendo a precedência antes de `%casatua%`.
- `supabase/functions/whatsapp-webhook/index.ts`: em `empreendimentoFromTemplate`, adicionar
  `if (t.includes("canoas")) return "Casa Tua Canoas";` antes da regra de Casa Tua; redeploy da função.
- Correção de dados da Maristela: `UPDATE pipeline_leads SET empreendimento='Casa Tua Canoas',
  campanha='Casa Tua Canoas', empreendimento_canonico_id=<id do Casa Tua Canoas>` — `campanha` precisa mudar
  junto, senão o gatilho canônico devolve o produto antigo.
- `src/lib/reengajamentoEmpreendimento.ts` já cobre "canoas" (ajuste feito antes) — sem mudança adicional.
