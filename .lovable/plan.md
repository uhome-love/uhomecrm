# Destravar a distribuição do Richard Aykiev (e casos iguais)

## Situação encontrada

O lead **Richard Aykiev Casa Tua** (51992777514) está na Fila do CEO, em "Novo Lead", sem corretor, depois de responder "Sim" ao disparo de Canoas hoje às 15:00.

Ele **não aparece como ganho** em nenhuma tela: não conta em VGV, não está na visão "Ganhos" e não tem venda ligada ao cartão.

O erro ao distribuir vem de um registro de venda antigo, criado em 11/05, que ficou marcado como "ganho" mas foi **arquivado**, sem data de assinatura e sem valor. A regra de segurança da distribuição olha só a palavra "ganho" e bloqueia o lead com o motivo `lead_ganho`, mesmo a venda estando arquivada e nunca tendo sido concluída.

Histórico do lead: visita em 09/05 → caiu em 09/07 → descartado e arquivado em 12/08 → reativado hoje pelo disparo.

## O que muda

1. **Regra de bloqueio mais precisa**: a distribuição só barra o lead quando existir uma venda **ativa** marcada como ganho (ou quando o lead estiver em etapa de venda/contrato). Vendas arquivadas ou perdidas deixam de bloquear.
2. **Richard volta a ser distribuível** — nada muda na etapa, no interesse (Casa Tua Canoas) nem no histórico dele.
3. **Nenhuma venda real deixa de ser protegida**: leads com venda ativa ganha continuam fora da roleta e da Fila do CEO.

Hoje existe exatamente **1 lead ativo travado por esse motivo** (o Richard). Outros 5 casos com a mesma marca estão em leads já arquivados e não são afetados.

## Detalhes técnicos

- Ajuste na função `distribuir_lead_atomico`: a checagem `EXISTS (... negocios n WHERE n.pipeline_lead_id = p_lead_id AND n.fase = 'ganho')` passa a exigir também `n.status = 'ativo'`. A checagem por `pipeline_stages.tipo IN ('venda','contrato_gerado')` fica inalterada.
- Alteração via migration (só a função, sem mudança de tabela, RLS ou grants). Conta como 1 migration no limite diário.
- Sem deploy de edge function: `distribute-lead` apenas chama a RPC.
- Sem alteração de frontend.

## Validação ao vivo (antes de declarar pronto)

1. Rodar a distribuição da Fila do CEO para o Richard no preview e confirmar que ele sai da fila com corretor atribuído.
2. Conferir nos logs da distribuição que não há mais `lead_ganho` para esse lead.
3. Conferir que um lead com venda ativa ganha continua bloqueado (checagem por consulta, sem disparar distribuição real).
