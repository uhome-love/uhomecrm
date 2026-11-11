# Lead com ação futura nunca fica "Desatualizado"

## O problema (conferido no banco)
A saúde do lead (Em dia / Atenção / Desatualizado / Estagnado) olha só para o **último contato registrado**. Ela ignora visitas e tarefas futuras. Hoje há leads ativos com visita marcada ou confirmada para hoje ou depois que aparecem como desatualizados. Pelo menos 5 deles estão há mais de 3 dias sem contato.

## Nova regra
Se o lead tem uma **ação futura**, ele fica **Em dia**:
- visita marcada ou confirmada com data de hoje em diante; ou
- tarefa pendente com data de hoje em diante.

Quando a data passa sem registro, a regra normal volta a valer. A visita vencida continua cobrada pelo bloqueio de "visita pendente", que já existe.

## Onde muda
1. Cartões, contagens e filtros do Pipeline, visão de equipes e gerente.
2. Ficha do lead: o aviso de dias sem contato não aparece como alerta quando há ação futura.
3. Contagem de "leads desatualizados" e percentual de CRM em dia.
4. **Roleta (aprovado):** o credenciamento (mínimo 70% de CRM em dia) também considera a ação futura. Uma régua só.

## Validação
- Abrir os 5 leads encontrados: devem aparecer "Em dia" no Pipeline e na ficha, no computador e no celular 390px.
- Conferir que um lead sem ação futura continua igual.
- Testes automáticos: visita futura = em dia; tarefa futura = em dia; visita de ontem = regra normal.
- Sem alterar dados de leads reais.

## Detalhes técnicos
- `src/lib/leadSaude.ts`: novo campo opcional `tem_acao_futura` em `LeadSaudeInput`. Se for verdadeiro e a etapa não for terminal, o resultado é "verde". O campo é preenchido nos hooks do Pipeline a partir das visitas e tarefas já carregadas.
- Servidor: função privada `lead_tem_acao_futura(lead_id)`. Ela olha visitas com status marcada/confirmada e data >= hoje BRT, e `pipeline_tarefas` pendentes com vencimento >= hoje BRT. É usada por `contar_leads_desatualizados` e `crm_saude_corretor`, e por consequência pela régua da Roleta (`roleta_crm_apto`). Uma migration, fora do horário de pico.
- Testes em `leadSaude.test.ts`.
