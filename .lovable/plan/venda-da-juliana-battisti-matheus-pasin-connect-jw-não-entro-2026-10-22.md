# Venda da Juliana Battisti (Matheus Pasin, Connect JW) não entrou no VGV

## O que aconteceu (confirmado nos dados)
- Hoje às 11:42 o Bruno moveu a cliente **Juliana Battisti** direto de **Pós-Visita para Ganho**, com R$ 298.000, assinatura 22/10 e unidade 321.
- O cliente foi para Ganho e o aviso "Venda assinada" saiu, mas **a venda não foi gravada**. Sem venda gravada, nada entra no VGV, na meta do Bruno nem no ranking do Matheus.
- Por que falhou: como a cliente nunca passou por "Em Negociação", ela ainda não tinha negócio aberto. O sistema tenta criar o negócio já como "ganho", mas sem a data de assinatura. A trava que exige essa data recusa a criação. A data informada só seria gravada no passo seguinte, que nem chegou a rodar.
- Conferi todo o Pipeline: **é o único cliente em Ganho sem venda**. Nenhuma outra venda foi perdida.

## O que será feito

### Fase 1 — Gravar a venda da Juliana
- Criar a venda com os dados que o Bruno informou: Connect JW, unidade 321, **R$ 298.000**, assinada em **22/10/2026**, corretor Matheus Pasin, gerente Bruno Schuler, sem parceria.
- Ligar a venda ao cliente, que continua em Ganho.
- Resultado esperado: meta do Bruno sobe de R$ 990 mil para cerca de **R$ 1,29 milhão**, e o Matheus ganha +1 venda em outubro.
- Não envio de novo o aviso "Venda assinada", que já saiu.

### Fase 2 — Impedir que se repita
- Quando o cliente vai direto para Ganho, sem negócio aberto, a venda passa a ser criada já com valor, data de assinatura e unidade informados na confirmação.
- Se mesmo assim a gravação falhar, o cliente **não fica em Ganho**. Aparece um erro claro ("A venda não foi registrada, tente de novo"), e o aviso de venda não é enviado.
- Quem já passa por "Em Negociação" ou "Contrato" continua igual.

### Fase 3 — Conferir
- Ver a venda em Vendas Realizadas (outubro, Matheus) e a meta no painel do Bruno.
- Testar o caminho "direto para Ganho" com um cliente de teste e apagá-lo depois. Nenhum cliente real será usado.

## Detalhes técnicos
- Causa: `src/hooks/usePipeline.ts` (`moveLead`, passo 2) faz um INSERT em `negocios` com `fase='ganho'` sem `data_assinatura`. O gatilho `enforce_data_assinatura_ganho` recusa a criação, e o erro é só registrado no console. O lead já foi movido antes disso.
- Fase 1: inserir em `negocios` (`pipeline_lead_id=6aefa114-…`, `corretor_id` = profile `6a0e1357-…`, `gerente_id` = profile `da6ea081-…`, `auth_user_id=00a26f80-…`, `fase='ganho'`, `status='ativo'`, `vgv_final=vgv_estimado=298000`, `data_assinatura='2026-10-22'`, `unidade='321'`, `origem='pipeline_convertido'`) e atualizar `pipeline_leads.negocio_id`. Também registrar uma linha em `negocios_atividades` como auditoria. Isso altera só dados, sem migration.
- Fase 2: no INSERT, quando `dealFase==='ganho'`, incluir `status`, `data_assinatura` (popup ou hoje BRT), `vgv_final` e `unidade` vindos de `dealDetails`. Se a criação falhar com `ganho`, reverter o lead para a etapa anterior e mostrar `toast.error`. Não mexer no banco.
- Validação: `v_fato_venda` deve mostrar a Juliana com equipe Bruno e R$ 298.000.
