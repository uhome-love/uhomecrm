# Lead com ação futura nunca fica "Desatualizado"

## O problema (conferido no banco)
A saúde do lead (Em dia / Atenção / Desatualizado / Estagnado) olha só para o **último contato registrado**. Ela ignora visitas e tarefas futuras. Hoje há leads ativos com visita marcada/confirmada para hoje ou depois que aparecem como desatualizados (5 deles estão há mais de 3 dias sem contato).

## Nova regra
Se o lead tem uma **ação futura**, ele fica **Em dia**:
- visita marcada ou confirmada com data de hoje em diante; ou
- tarefa pendente com data de hoje em diante.

Quando a data passa sem registro, a regra normal volta a valer (a visita vencida continua cobrada pelo bloqueio de "visita pendente" que já existe).

## Onde muda
1. Cartões, contagens e filtros do Pipeline (Em dia / Atenção / Desatualizado / Estagnado), visão de equipes e gerente.
2. Ficha do lead (aviso de dias sem contato não aparece como alerta quando há ação futura).
3. Contagem de "leads desatualizados" no servidor e o percentual de CRM em dia.

## Ponto para você decidir
O percentual de CRM em dia também é usado no **credenciamento da Roleta** (mínimo 70%). Com a nova regra, corretores com visitas marcadas ganham pontos e podem passar a ser liberados. Proposta: aplicar também na Roleta (uma régua só). Se preferir que a Roleta continue como está, eu deixo de fora.

## Validação
- Abrir os 5 leads encontrados: devem aparecer "Em dia" no Pipeline e na ficha, computador e celular 390px.
- Conferir que um lead sem ação futura continua igual.
- Testes automáticos: visita futura = em dia; tarefa futura = em dia; visita de ontem = regra normal.
- Sem mexer em dados de leads reais.

## Detalhes técnicos
- `src/lib/leadSaude.ts`: novo campo opcional `tem_acao_futura` em `LeadSaudeInput`; se verdadeiro e etapa não terminal → "verde". Preencher nos hooks do Pipeline a partir das visitas/tarefas já carregadas (`usePipeline`, `useNegociosBoard`, `useFilaDoDia`, `PipelineLeadDetail`).
- Servidor: função privada `lead_tem_acao_futura(lead_id)` (visitas status marcada/confirmada com data_visita >= hoje BRT; pipeline_tarefas pendente com vence_em >= hoje BRT) usada por `contar_leads_desatualizados` e `crm_saude_corretor` (e, se aprovado, pela régua da Roleta via a mesma fonte). 1 migration, fora do horário de pico.
- Testes em `leadSaude.test.ts`.
