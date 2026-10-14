# Uhome Performance — Credenciamento e Meritocracia

Plano para aprovação da direção. Nada será construído antes da aprovação. Cada fase segue a regra do projeto: desenho → plano da fase → construção → teste ao vivo com cliente de teste → ok para publicar.

## 1. O que já existe hoje (diagnóstico)

- **Roleta:** o corretor se credencia por turno (manhã, tarde, noite). Hoje ele é barrado por: mais de 100 descartes no mês, mais de 10 leads "vermelhos" (só na noite), regras de presença e de domingo (4 presenças + 2 visitas na semana).
- **Ponto fraco:** essa checagem só acontece **na hora de se credenciar**. Na hora de entregar o lead, a Roleta não confere de novo. Quem se credenciou de manhã continua recebendo mesmo se ficar irregular.
- **Visitas:** já têm status realizada, marcada, reagendada, no show e cancelada, com a data real da visita. Já existe a regra "1 visita por cliente por dia" e a tela que obriga o feedback da visita vencida.
- **Tarefas, sininho e push** já funcionam (módulo Tarefas e aba "Sem próximo passo").
- **One-on-one:** já existe um relatório de one-on-one (396 registros) que pode ser aproveitado.
- **VGV:** já tem regra única (venda assinada, data da assinatura, parceria 50/50, equipe da época da venda).
- **Gerente / time:** a relação gerente-corretor e a equipe histórica já existem.

## 2. O que será reaproveitado

Roleta atual (sem reescrever), regra de visitas válidas, tarefas e "sem próximo passo", aviso de visita vencida, sininho + push, relatórios de one-on-one, regra de VGV, equipes históricas, painel do CEO e Minha rotina do corretor.

## 3. Fases

**Fase 0 — Urgente: CRM mínimo de 90% na Roleta noturna de hoje (14/10)**
- Na hora de entregar cada lead da noite, o sistema confere a saúde do CRM do corretor (mesma régua da "Saúde da carteira"). Abaixo de 90%: não recebe e o lead vai para o próximo. Não mexe nos clientes que ele já tem.
- O corretor vê na Minha rotina o % e o aviso "abaixo de 90% — atualize seus clientes para voltar a receber".
- Só liga depois de testar e de você aprovar. Antes de ligar, te mostro quantos corretores ficariam abaixo de 90% agora, para não esvaziar a noite sem aviso.

**Fase 1 — Regra de credenciamento por visitas**

Regra oficial da direção:

| Visitas válidas na semana | Situação |
|---|---|
| 3 ou mais | Apto à Roleta (se CRM ≥ 90% e demais regras) |
| 1 ou 2 | Fora da Roleta — trabalha carteira, Oferta Ativa e indicações |
| 0 | Fora da Roleta + one-on-one obrigatório com um sócio na segunda |

- Estados: **Em integração**, **Credenciado**, **Em recuperação** (visitas) e **Bloqueado por CRM**, com **todos** os motivos.
- **Visita válida:** ligada a um cliente que já existia no CRM antes da visita; cliente não excluído; status realizada; feedback preenchido; 1 por cliente por dia. Não contam: sem cliente, cancelada, reagendada, no show. Indicação, prospecção própria e Oferta Ativa contam se o cliente foi cadastrado antes. Checagem no sistema, não só na tela.
- **Datas (regra definitiva):** a primeira apuração é a **semana atual, 12/10 a 18/10/2026**. Na **segunda 19/10** o resultado dela já decide quem entra na Roleta. A partir daí, quem está fora volta **na hora** em que completar a 3ª visita válida da semana (com CRM ≥ 90%). Quem fez 3+ numa semana começa a seguinte apto.
- **Integração de 30 dias para corretor novo** (desde a data oficial de ingresso): fora da Roleta mesmo com várias visitas; usa Oferta Ativa e prospecção; CRM em dia desde o primeiro dia. Ao terminar, só entra com CRM ≥ 90% + 3 visitas válidas na semana atual ou na anterior. Exceção só pela direção, com motivo, prazo e registro.
- Outras exceções (férias, afastamento, aprovação da direção) com motivo, responsável, início e fim.
- **Na entrega de cada lead** a Roleta confere tudo de novo — não só quando o corretor se credencia. Irregular para de receber na hora, sem perder seus clientes e negócios.
- Chave liga/desliga para emergência. Nada é publicado sem teste e aprovação explícita da direção.

**Fase 2 — Painel do corretor na Minha rotina + ligação com a Roleta**

Quadro obrigatório no topo da Minha rotina, compacto, na cor #4969FF:

```text
+--------------------------------------------------------------+
| MINHA META DE VISITAS        2/3     [#########-----] 67%    |
| Falta 1 visita                         Agenda de visitas >   |
|--------------------------------------------------------------|
| SAÚDE DO MEU CRM             94%     [############--] mín 90%|
| Dentro da meta · 3 clientes para atualizar   Ver clientes >  |
|--------------------------------------------------------------|
| ROLETA: Bloqueada por falta de visitas                       |
| Falta 1 visita realizada. Seu CRM está dentro da meta.       |
|--------------------------------------------------------------|
| [Minhas visitas] [Atualizar clientes] [Oferta Ativa]         |
| [Meu credenciamento]                                         |
+--------------------------------------------------------------+
```

- **Meta de visitas:** visitas válidas da semana / 3, barra, quantas faltam, link para a Agenda. Com 4 ou mais mostra o número real (ex.: 5/3).
- **Saúde do meu CRM:** exatamente o mesmo % que já aparece hoje em "Saúde da carteira" na Minha rotina. Barra com marca no mínimo de 90%, "Dentro da meta" ou "Abaixo da meta", quantos clientes precisam de atualização (Atenção + Desatualizado, que a régua atual já informa) e link para o Pipeline já filtrado nesses clientes. Sem clientes ativos: "Sem carteira ativa".
- **Situação da Roleta:** Roleta liberada / Bloqueada por falta de visitas / Bloqueada por CRM (abaixo de 90%) / Bloqueada por múltiplos motivos / Em integração — X dias restantes. Sempre diz exatamente o que falta. Ex.: "Parabéns! Você atingiu a meta de visitas e seu CRM está atualizado. Sua Roleta está liberada."
- **Botões** levam para páginas que já existem: Agenda de visitas, Pipeline filtrado nos clientes a atualizar, Oferta Ativa e uma tela "Meu credenciamento" com todos os motivos.
- **Atualiza sozinho** depois de registrar visita, registrar atividade/contato com cliente, virada da semana e exceção da direção. Os números vêm da mesma regra da Roleta — nada calculado duas vezes.
- Em modo observação o quadro mostra o aviso "Prévia — ainda não afeta sua Roleta".

- Roleta: na hora de entregar cada lead, confere a regra. Se o corretor estiver bloqueado, o lead vai para o próximo da fila (ou Fila CEO). Todas as outras regras atuais continuam.
- Bloqueado continua com seus leads, Pipeline, Agenda e Oferta Ativa.
- **Dependência:** só precisa da Fase 1.

**Fase 3 — Saúde do CRM: reaproveitar a régua atual (sem criar outra)**

Decisão da direção: **não** existe régua nova. O Uhome Performance só lê o % que o CRM já calcula e aplica o mínimo de **90%**.

O que já existe hoje (conferido):
1. **Quem calcula:** a "Saúde da carteira" da Minha rotina, que usa a régua oficial de saúde do lead do sistema.
2. **Critério:** saúde pelo **último contato real** registrado com o cliente (atividade, ligação, WhatsApp etc.) — não depende de ter tarefa marcada. Prazos de "em dia" por etapa: Novo Lead 1 dia, Sem Contato 2, Qualificação 7, Aquecimento 15, Visita 2, Proposta/Contrato 7. Passou do prazo = Atenção; passou do dobro = Desatualizado; Qualificação/Aquecimento parados mais de 21 dias e Sem Contato mais de 15 = Estagnado. Carência de transição já existente é respeitada.
3. **Lead atualizado:** está "Em dia" (verde). Clientes ganhos, descartados, caídos e arquivados não entram.
4. **Indicador reutilizado:** "% em dia" = clientes em dia ÷ clientes ativos (os estagnados ficam fora da conta, como já é hoje).
5. **Ligação com a Roleta:** a regra de credenciamento chama esse mesmo cálculo para o corretor e compara com 90%. Nenhuma fórmula duplicada.
6. **Atualização automática:** o % muda assim que o corretor registra um contato (o sistema já atualiza o "último contato" do cliente). O painel recarrega depois de registrar atividade, concluir tarefa ou visita.

Regras:
- 90% a 100%: critério atendido. Abaixo de 90%: bloqueado por CRM. Voltou a 90%: libera na hora (se as visitas também estiverem ok).
- **Não** bloqueia por falta de tarefa, tarefa vencida ou outra pendência fora da régua atual.
- Exemplos: 3 visitas + 94% = atende; 3 visitas + 87% = bloqueado por CRM; 1 visita + 100% = depende das visitas (ou da semana anterior).
- Página Performance: % de cada corretor e da equipe com a mesma régua (soma de em dia ÷ soma de ativos da equipe), sem esconder bloqueios individuais.

**Fase 4 — One-on-one, Botão Vermelho e gerentes**
- Semana com zero visitas → na segunda cria "One-on-one obrigatório" para gerente e direção, sem repetir.
- Corretor sem venda: aviso aos 30 e 45 dias; aos 60 dias "Botão Vermelho — revisão de parceria" para a direção registrar a decisão. Nada automático contra o corretor.
- Gerentes: meta mensal configurável (padrão R$ 1,5 milhão). 1 mês abaixo → revisão com a diretora; 2 meses seguidos → Botão Vermelho gerencial. Não bloqueia os corretores da equipe.

**Fase 1B (antecipada) — Página "Uhome Performance" só leitura**
- Uma primeira versão só de leitura já nesta semana, para a direção acompanhar a apuração de 12 a 18/10 antes de valer na segunda 19/10.

**Fase 5 — Página Uhome Performance completa, relatório semanal, central de regras e avisos**
- **Página "Uhome Performance" no menu** (substitui/organiza o hub de Performance atual, sem criar um segundo). Filtros: semana atual e anteriores, mês, período, equipe, gerente, corretor, empreendimento.
- **Visão CEO/diretoria:** leads recebidos e trabalhados, visitas agendadas e válidas, meta e % da meta, negócios, propostas, vendas, VGV, conversões lead→visita e visita→venda, credenciados / em recuperação / bloqueados por CRM, corretores com 0, 1–2 e 3+ visitas, one-on-ones pendentes, alertas 30/45/60, gerentes abaixo da meta, comparação com a semana anterior.
- **Tabela por equipe** (clica e abre os corretores) e **tabela por corretor** ordenável por qualquer coluna; clicar no corretor abre o histórico semanal, alertas e pendências.
- **Pontos de Atenção:** semana zerada, abaixo da meta, bloqueados, perdeu/recuperou credenciamento, 30/45/60 dias sem venda, one-on-one não feito, queda de conversão de equipe, gerente abaixo do VGV (1 e 2 meses). Separados em informativo, operacional e "exige intervenção", cada um com link para o registro.
- **Minha Equipe — Performance (gerente):** só a própria equipe — meta semanal da equipe, visitas feitas e quanto falta, credenciados, em recuperação, com pendências, negócios em andamento, VGV do mês x meta, one-on-ones e alertas, com atalho para a carteira de cada corretor.
- **Relatório Executivo Semanal:** toda segunda às 07h30 (Brasília), sobre a semana anterior (seg 00h a dom 23h59). Fecha a semana e guarda uma "foto" fixa. CEO e Gabrielle recebem a empresa toda; cada gerente só a sua equipe. 5 partes: resumo, equipes, corretores, alertas e intervenções, evolução. Sem inventar causas — só números e comparações.
- **Entrega:** fica arquivado na página (consulta e PDF) + aviso no sininho/push. **E-mail:** hoje o CRM não tem envio de e-mail automático pronto para isso (existe só a parte de e-mail marketing). Antes de construir apresento a opção de e-mail do próprio Lovable Cloud, que precisa de um domínio de envio (ex.: avisos@uhomesales.com). O e-mail leva só o resumo + link seguro que exige login. Registro de envio, sem duplicar, com botão de reenviar.
- **Central de regras:** a direção muda metas, prazos, destinatários e canais sem programador, tudo registrado.
- Avisos no sininho (e push) sem repetir o mesmo evento.

**Fase 6 — Preparação para WhatsApp**
- Só deixar os eventos prontos (inclusive o do relatório semanal) para futuros modelos aprovados na Meta. Nenhum disparo.

**Estimativa (cada fase com desenho → plano → construção → teste):** Fase 1 + 1B: ~1 semana (pronta para 19/10 em observação). Fase 2: 3–4 dias. Fase 3: ~1 semana. Fase 4: ~1 semana. Fase 5: 1,5–2 semanas. Fase 6: 1–2 dias.

## 4. Quem vê o quê

| Perfil | Vê | Pode mudar |
|---|---|---|
| Corretor | Só a própria situação e pendências | Nada nas regras |
| Gerente | Seu time | Registrar diagnóstico do one-on-one |
| Diretoria / CEO | Tudo | Regras, exceções, decisões do Botão Vermelho |

Conteúdo dos one-on-ones: só gerente do corretor e diretoria.

## 5. Histórico e auditoria

Toda mudança de situação grava: quando, motivo, o que causou (visita, pendência resolvida, virada da semana, exceção) e quem aprovou. Toda mudança de regra também fica registrada.

## 6. Riscos e conflitos com o que existe hoje

- **Barrar a Roleta por engano:** o prazo é curto (CRM 90% hoje à noite, visitas em 19/10). Antes de cada ligação mostro a lista de quem ficaria fora, e só ligo com aprovação.
- **Muitos corretores bloqueados no primeiro dia:** a Fila CEO pode encher. Vamos medir na observação antes de ligar.
- **Data de ingresso:** hoje o CRM não tem um campo "data oficial de ingresso" do corretor, só a data em que o acesso foi criado (que pode ser diferente). Precisamos criar esse campo e a direção/RH preencher para quem entrou nos últimos 30 dias.
- **Carência atual de 14 dias:** não encontrei uma regra de 14 dias funcionando hoje na Roleta. A nova carência de 30 dias será criada do zero, e só passa a barrar quando a política for ligada.
- **Visitas sem cliente:** nos últimos 60 dias, todas as 240 visitas realizadas estão ligadas a um cliente — o impacto prático é pequeno. A regra protege o futuro.
- **"Cliente cadastrado antes da visita":** vamos comparar a data de cadastro do cliente com a data em que a visita foi registrada. Um cliente cadastrado na mesma hora só para lançar a visita não conta.
- **Feedback:** a visita já pede feedback na tela de visita vencida; a regra passa a conferir isso também no sistema.
- **Regras atuais da Roleta** (descartes, leads vermelhos, presença, domingo) continuam até a direção decidir.
- Limite de 2 alterações de banco por dia no horário comercial: as fases mais pesadas ficam fora do expediente.

## 7. Testes (critérios de aceite)

Os 15 cenários do documento original e os 12 novos serão testados com corretores e clientes de teste, apagando tudo no final. Novos incluídos:

1. Visita sem cliente válido não conta.
2. Visita com cliente criado na hora, só para lançar a visita, não conta.
3. Visita com cliente real, realizada e com feedback conta.
4. Visita de prospecção própria conta se o cliente foi cadastrado antes.
5. Cancelada ou no show não conta.
6. Visitas antes de 12/10/2026 não contam; as de 12 a 18/10 decidem quem entra em 19/10.
7. Nenhum bloqueio por visitas antes de 19/10 (só o de CRM 90%, se aprovado para hoje à noite).
8. Corretor com menos de 30 dias não recebe lead da Roleta (com a política ligada).
9. Corretor novo usa Oferta Ativa e cadastra seus próprios clientes.
10. Corretor novo vê pendências de CRM desde o primeiro dia.
11. Corretor com 30 dias completos sem 3 visitas continua fora da Roleta.
12. Corretor com carência encerrada, CRM em dia e meta cumprida entra na Roleta.

## 8. Decisões que a direção ainda precisa tomar

Já decididas: visita válida (cliente real + feedback), início em 19/10/2026, carência de 30 dias.

1. **Regras atuais da Roleta** (descartes, leads vermelhos, presença, domingo): continuam junto com as novas, ou as novas substituem?
2. **CRM 90% hoje à noite:** confirma ligar na Roleta noturna de hoje (14/10), depois de ver a lista de quem ficaria fora?
3. **Corretor que fica bloqueado no meio do turno:** sai da fila na hora, ou termina o turno?
4. **Estagnados na conta do CRM:** hoje os clientes estagnados ficam fora do % (régua atual). Mantemos assim, conforme a orientação de não mudar a régua?
5. **Meta do gerente Junior** (equipe menor): também R$ 1,5 milhão?
6. **Diretoria responsável** pelas revisões gerenciais: Gabrielle continua nessa função?
7. **Data de ingresso:** quem preenche (RH, gerente ou direção)?

## Detalhes técnicos

- Nova função única no banco (ex.: `fn_credenciamento_corretor`) com estados `integracao | credenciado | recuperacao | bloqueado_crm` e lista de motivos. Saúde do CRM = mesmo cálculo de `rpc_carteira_saude` / `lead_saude_status` (extrair o miolo para uma função interna por corretor, chamada pelas duas, sem mudar o resultado atual) comparado com `crm_minimo_pct = 90`. Chamada dentro de `distribuir_lead_atomico` a cada entrega. Configuração: `data_inicio_apuracao = 2026-10-12`, `data_inicio_exigencia_visitas = 2026-10-19`, `crm_gate_ativo` (Fase 0) e `visitas_gate_ativo` separados. Tabelas novas: situação, histórico, exceções, ocorrências (one-on-one/Botão Vermelho), metas de gerente e configuração — todas com permissões por perfil.
- Visita válida: `pipeline_lead_id` não nulo, lead existente e não arquivado/excluído, `pipeline_leads.created_at < visitas.created_at`, `status = 'realizada'`, `resultado_visita`/`observacoes` preenchidos, `data_visita >= data_inicio_apuracao`, 1 por `cliente_key` + dia via `v_fato_visita`.
- Fase 0 entra em 1 migração (função de saúde por corretor + filtro na distribuição com chave), fora do horário de pico, antes das 18h30.
- Novo campo `profiles.data_ingresso` (nulo por padrão; sem ele, usa `created_at` só como sugestão para conferência). Carência tem prioridade sobre visitas.
- Roleta: filtro extra dentro de `distribuir_lead_atomico` (que hoje não chama nenhuma checagem), só quando `politica_ativa = true`. `credenciar_na_roleta` e `get_elegibilidade_roleta` passam a ler a mesma fonte.
- Reaproveitar `one_on_one_reports`, `notifications`/`criar_notificacao`, push existente e a regra de VGV com `fn_equipe_na_data`.
- Rotinas: virada de domingo 23:59 BRT, auditoria diária do CRM e checagem diária de dias sem venda.
- Página Performance e relatório leem a mesma função de credenciamento e a mesma visita válida — nenhuma segunda regra de contagem.
- Fotos semanais: tabela `performance_fechamento_semanal` (semana, data da consolidação, versão das regras, totais) + linhas por equipe e por corretor (situação no fechamento, alertas). Correção = nova versão com motivo e autor; a anterior fica guardada. Reprocessar não muda a situação atual do corretor.
- Envio: tabela de envios (destinatário, canal, data, status, erro), chave única semana+destinatário+canal para não duplicar; reenvio manual pela direção.
- PDF: gerado a partir da foto da semana (mesmo padrão dos PDFs de relatório já usados), guardado em armazenamento privado com link temporário.
- E-mail: e-mail transacional do Lovable Cloud, depois de configurar domínio de envio; o e-mail só traz resumo e link para a página com login.
- Rotina de segunda 07h30 BRT (10h30 UTC) via cron + função de backend.
- Permissões: gerente só a própria equipe (via `team_members` e equipe histórica); CEO/diretoria tudo; corretor só o próprio.

## Testes do adendo (relatório e página)

Período semanal correto; visitas da semana anterior certas; visitas inválidas fora; soma dos corretores = equipe; soma das equipes = empresa (respeitando parceria 50/50); gerente só vê a sua equipe; CEO e diretoria veem tudo; corretores zerados identificados; one-on-one sem duplicar; bloqueios com motivos certos; relatório enviado uma vez por pessoa; falha registrada e reenvio possível; fotos antigas disponíveis; PDF fiel; números iguais aos do painel do corretor e do gerente.

## Decisões extras do adendo

- **Domínio de e-mail:** podemos usar um endereço como avisos@uhomesales.com? (precisa configurar uma vez no domínio).
- **Página atual de Performance:** a nova "Uhome Performance" substitui a atual (recomendado) ou fica ao lado?
