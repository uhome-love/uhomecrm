# Auditoria dos avisos de novo lead no WhatsApp

## O que a auditoria mostrou

**1. O canal Meta está saudável.** Desde a correção de ontem (22:12 UTC / 19:12 BRT), **zero falhas**: 32 envios com sucesso nas últimas 24h, todos pelo canal `meta` (template `novo_leaduhome`). Os erros antigos (`#100 Invalid parameter` e `#132001 template não existe`) pararam completamente.

**2. Mas metade dos leads distribuídos não gera aviso.** Nas últimas ~3h houve **21 distribuições** e apenas **12 avisos de novo lead**. Corretores como Rafaela Sandin, Rafaela Campos, Ebert Silva, Luiza Clós, Thalia de Oliveira e Paula Medeiros receberam lead **sem receber WhatsApp**.

Causa confirmada: existem dois caminhos de distribuição no sistema.

```text
Caminho A (avisa)        →  distribute-lead  →  sino + WhatsApp + push
  Fila do CEO, aceite manual, ações em massa, painel de pendentes

Caminho B (NÃO avisa)    →  distributeLeadDirect  →  nada
  receive-meta-lead, receive-landing-lead, receive-imovelweb-lead,
  receive-rdstation-lead, crm-webhook, reativação de reengajamento,
  lead-escalation (redistribuição automática)
```

Ou seja: **justamente o lead que entra sozinho pelo Meta/site — o mais urgente — é o que não avisa ninguém.** O corretor só descobre abrindo o CRM, e o prazo de 10 minutos corre do mesmo jeito.

**3. Dois corretores ativos seguem sem telefone cadastrado:** Misael Silva e Thalia Pereira. Enquanto não cadastrarem, nunca receberão o aviso.

## O que será feito

1. **Unificar o aviso nos dois caminhos.** O `distributeLeadDirect` passa a disparar os mesmos três avisos do `distribute-lead` (sino no CRM, WhatsApp pelo template Meta e push na tela bloqueada), com nome do lead e empreendimento canônico — sem telefone/e-mail, como já definido.
2. **Sem duplicar.** O aviso só sai quando a distribuição realmente prendeu o lead naquele corretor; redistribuição por inatividade avisa somente o corretor novo.
3. **Monitoramento.** Cada envio continua registrado em `ops_events`, permitindo comparar "distribuições x avisos" no painel de saúde e detectar qualquer nova lacuna.
4. **Cobrança dos dois telefones faltantes** — o banner e o push já implementados cobrem Misael e Thalia; conferimos depois se cadastraram.

## Detalhes técnicos

- Extrair de `supabase/functions/distribute-lead/index.ts` o bloco de avisos (busca do lead + `notifications.insert` + `sendWhatsApp` + `sendPush`) para `supabase/functions/_shared/lead-notify.ts`.
- `distribute-lead` passa a usar o helper (comportamento idêntico ao de hoje).
- `_shared/roleta-distribution.ts` chama o helper após um `result.success` com `corretor_id`, respeitando o `excludeAuthUserId` (não avisa o corretor anterior).
- Sem migration, sem mudança na regra de distribuição, sem mexer em nutrição/reengajamento.

## Validação

- Lead de teste entrando pelo caminho Meta: conferir que chega WhatsApp com nome + empreendimento reais.
- Consulta comparando distribuições x avisos na mesma janela: a diferença deve ir a zero (exceto corretores sem telefone).
