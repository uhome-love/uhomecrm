# Lead estagnado com novo interesse vai para a Fila CEO

## O que muda
Quando um cliente que está **estagnado** (15 dias ou mais sem ação do corretor) entra de novo por qualquer anúncio ou formulário (Meta, site, landing page, RD Station, ImovelWeb), o cartão:
1. Sai do corretor atual e vai para a **Fila CEO** (sem corretor, aguardando distribuição manual).
2. Recebe uma anotação: "Novo interesse em [produto] com o lead estagnado há X dias com [corretor]. Enviado para a Fila CEO."
3. **Nenhum aviso** é enviado ao corretor antigo.

Exemplo de hoje: Matheus Beck (Rafaela, 22 dias parado, voltou pelo Alfa) teria ido para a Fila CEO.

## O que NÃO muda
- Lead ativo e em dia (menos de 15 dias) continua com o mesmo corretor, como hoje.
- Ficam de fora (continuam com o corretor): Documentação, Proposta, Contrato, Ganho, leads com visita marcada e leads em parceria — mesma régua do Bolsão.
- Descartados/arquivados seguem a regra de reativação atual.
- Roleta, Fila CEO obrigatória por produto e demais regras ficam iguais. Ninguém recebe o lead automaticamente: a Fila CEO segue manual.
- Leads de teste ficam de fora.

## Detalhes técnicos
- "Estagnado" usa a mesma régua da página Leads estagnados: `_pipeline_referencia_estagnacao(lead_id)` com 15 dias (FOCUS_STAGNANT_DAYS).
- Nova função no banco `estagnado_novo_interesse_para_fila_ceo(p_lead_id, p_produto)` SECURITY DEFINER (só service_role): confere elegibilidade, faz `corretor_id = null`, `aceite_status = 'pendente_distribuicao'`, grava anotação e auditoria (sem notificação ao corretor antigo). Idempotente e protegida com EXCEPTION para nunca derrubar a entrada do lead.
- O gatilho `reset_ciclo_reentrada` já cuida de relógios, tarefas antigas e parcerias ao trocar o corretor.
- Chamada em `_shared/novoInteresseUpdate.ts` (helper novo), usada pelos receivers `receive-meta-lead`, `receive-landing-lead`, `receive-rdstation-lead`, `receive-imovelweb-lead` e `crm-webhook` logo após gravar o novo interesse.
- 1 migration (fora do limite? hoje é sexta 16h57 — conta como 1 das 2 do dia).

## Validação
- Teste em transação revertida com um lead estagnado simulado: vai para a Fila CEO, anotação criada e nenhum aviso ao corretor antigo.
- Teste com lead em dia, em Documentação e com visita marcada: não muda.
- Publicar as funções e acompanhar o próximo lead real nos logs.
