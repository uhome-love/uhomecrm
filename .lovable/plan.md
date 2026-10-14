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

**Fase 0 — Base das chaves + CRM 80% na Roleta (execução detalhada)**

**Cronograma oficial da direção:**
- **Quinta 15/10/2026, a partir da primeira Roleta (manhã):** CRM ≥ 80% passa a valer em todos os turnos (manhã, tarde, noite e domingo). `crm_gate_ativo = true`.
- **Segunda 19/10/2026:** meta de 2 visitas passa a valer. Até lá `visitas_gate_ativo = false`. Nunca ligar as visitas antes.
- Horário sempre de Brasília. Tudo condicionado aos testes e à autorização final.

**Dado atual (14/10, 15h):** dos 29 corretores ativos com carteira, **13 estão com CRM ≥ 80% e 15 estão abaixo** (1 sem cálculo). Se nada mudar até amanhã, cerca de metade do time ficaria fora da primeira Roleta. Junto com o resultado dos testes entrego a lista nominal com o % de cada um, para os gerentes avisarem o time hoje e a Fila CEO ser acompanhada amanhã.

Passo a passo:
1. **Chaves independentes** na configuração da Roleta: `crm_gate_ativo` e `visitas_gate_ativo`, ambas **desligadas**, e `crm_minimo_pct = 80`, `meta_visitas_semanais = 2`. Só CEO/diretoria mudam, com registro (quem, quando, antes, depois, motivo).
2. **Cálculo da saúde por corretor** usando exatamente a régua atual (mesmo resultado da "Saúde da carteira", estagnados fora da conta). Nada muda na tela de hoje.
3. **Conferência na entrega de cada lead** (todos os turnos, inclusive domingo e leads de integrações): se `crm_gate_ativo` estiver ligada e o corretor estiver abaixo de 80%, ele é pulado e o lead vai ao próximo apto da mesma regra de produto/turno/equipe; se ninguém estiver apto, vai para a Fila CEO como hoje. Quem perde a condição para de receber na hora, mesmo já credenciado; nunca perde os leads que já tem.
4. **Troca das regras antigas** (só quando a chave do CRM for ligada): sai o limite de 10 leads vermelhos; sai a exigência de 4 presenças (inclusive no domingo); continua o limite de 100 descartes no mês.
5. **Registro** de cada vez que um corretor foi pulado (corretor, lead, motivo, % no momento) e de cada mudança de situação (bloqueou / liberou).
6. **Aviso claro de bloqueio (regra obrigatória)** — na tela de credenciamento da Roleta, na Minha rotina e no aviso do sininho. Nunca "Bloqueado" sozinho. Sempre: **situação + motivo exato + como resolver + botão**. Exemplo desta fase:

```text
+--------------------------------------------------------------+
| Sua Roleta está temporariamente bloqueada                    |
| Seu CRM está em 76% e o mínimo exigido é 80%.                |
| Atualize sua carteira para recuperar seu credenciamento.     |
|                                                              |
| [Atualizar meus clientes]   [Entender meu credenciamento]    |
| Assim que chegar a 80%, você volta automaticamente.          |
+--------------------------------------------------------------+
```
   - Na Minha rotina, o card de saúde mostra "Meta Uhome: 80%", o % atual e o mesmo aviso quando estiver abaixo. O card completo "Minha evolução" vem na Fase 2.
   - Com mais de um motivo (a partir de 19/10), mostra todos em lista com checklist (✓ no que já cumpriu) e "Resolva os pontos acima e seu credenciamento será reavaliado automaticamente." Exemplos por motivo: CRM (76% de 80%), visitas ("1 de 2 — falta 1 visita válida", botão Ver minhas visitas / Oferta Ativa), integração ("12 de 30 dias", botão Minha Oferta Ativa), 100 descartes (quantos tem e quando zera).
   - Tom claro, respeitoso e motivador; destaque elegante, sem vermelho agressivo. Reavalia sozinho ao corrigir.
   - Antes de construir, mostro o fluxo visual (mockup) para aprovação.
7. **Campo de data de ingresso** do corretor criado vazio + lista dos corretores que entraram nos últimos 30 dias (hoje: 1) para Lucas e Gabrielle confirmarem as datas. A carência só bloqueia depois dessa confirmação.

Testes antes de pedir para ligar (com corretor e lead de teste, apagando tudo no fim):
- Chave desligada: Roleta entrega exatamente como hoje.
- Chave ligada: corretor com 79,99% é pulado; com 80%, 85%, 90% e 100% recebe.
- Corretor regulariza e volta a 80%: recebe no próximo lead, sem precisar se credenciar de novo.
- Ligar o CRM não ativa a regra de visitas.
- 100 descartes continua barrando; 10 vermelhos e 4 presenças não barram mais.
- Leads já recebidos continuam com o corretor.

Testes extras pedidos pela direção: conferir o cálculo dos 80% com os dados reais (comparando com a "Saúde da carteira" de cada um), ver o impacto na Fila CEO (quantos leads iriam para lá com o time atual) e testar o desligamento imediato da chave (rollback).

**Status: construção e testes da Fase 0 autorizados; ligar o bloqueio em produção NÃO autorizado.** As duas chaves são construídas desligadas. Não existe nenhuma chave geral que ligue as duas regras juntas. A mesma checagem (fonte única) é usada no credenciamento e na entrega de cada lead.

**CRM sem cálculo — tratamento separado (nunca vira bloqueio silencioso):**
- **Percentual calculado:** compara com 80%.
- **Sem carteira ativa** (nenhum cliente ativo): não bloqueia por CRM; mostra "Sem carteira ativa".
- **Dados insuficientes** (só clientes estagnados, que ficam fora da conta): hoje é o caso de **Junior Padilha** (10 clientes, todos estagnados). Proposta: não bloqueia; mostra "Seus clientes estão parados — atualize para gerar seu percentual".
- **Erro técnico** no cálculo: não bloqueia, entrega normalmente e registra alerta para a equipe técnica.

**Segurança da distribuição (antes de pedir para ligar):**
- Simulação por turno, equipe e empreendimento: quantos corretores ficam aptos e quantos leads iriam para a Fila CEO, usando os leads reais dos últimos 7 dias.
- Nenhum apto: o lead vai para a Fila CEO como hoje — nunca se perde, nunca é entregue duas vezes (a trava atual contra entrega dupla continua).
- **Alerta operacional** no sininho do CEO/diretoria quando a Fila CEO acumular leads (ex.: 5 ou mais aguardando há 15 min).
- Testar volta imediata ao chegar a 80% e desligar a chave sem perder nenhum lead.

**Aviso de bloqueio:** aparece na tentativa de credenciamento, na Minha rotina e na área de credenciamento. Sempre com motivo, dado atual, meta, instrução, botão e todos os motivos juntos. Explica separado CRM, visitas, integração, descartes e demais. Só promete "volta automaticamente" quando depende do corretor (CRM, visitas); para integração, descartes ou aprovação da direção mostra a data ou quem decide.

**Entrega para aprovação final (antes de ligar):**
1. Funções e tabelas alteradas.
2. Resultado dos testes.
3. Lista dos corretores abaixo de 80%.
4. Casos sem percentual calculável.
5. Simulação de impacto na Roleta e na Fila CEO.
6. Demonstração do aviso de bloqueio e da volta.
7. Plano de rollback (desligar a chave = volta ao comportamento atual na hora).
8. Confirmação de que a regra de visitas segue desligada até a autorização de 19/10.

Só depois disso peço a aprovação final para ligar o CRM 80% na primeira Roleta de 15/10.

**Fase 1 — Regra de credenciamento por visitas**

Regra oficial da direção:

| Visitas válidas na semana | Situação |
|---|---|
| 2 ou mais — **Meta conquistada** | Apto à Roleta (se CRM ≥ 80% e demais regras) |
| 1 — **Em evolução** | Fora da Roleta — trabalha carteira, Oferta Ativa e indicações; volta ao fazer a 2ª visita |
| 0 — **Plano de retomada** | Fora da Roleta + one-on-one obrigatório com um sócio na segunda; gerente acompanha |

**Meta inicial: 2 visitas por semana** (decisão da direção). Fica na Central de regras (`meta_visitas_semanais = 2`); só Lucas ou Gabrielle podem mudar (futuramente para 3), com registro. Sem aumento automático. Mudar a meta não altera semanas já fechadas — cada semana guarda a meta que valia nela.

- Estados: **Em integração**, **Credenciado**, **Em recuperação** (visitas) e **Bloqueado por CRM**, com **todos** os motivos.
- **Visita válida:** ligada a um cliente real do CRM; cliente não excluído; status realizada; feedback preenchido; 1 por cliente por dia. Não contam: sem cliente, cancelada, reagendada, no show. Indicação, prospecção própria e Oferta Ativa contam. Checagem no sistema, não só na tela.
- **Antifraude (proposta para aprovação):** uma visita legítima **não** é invalidada só porque o cliente foi cadastrado pouco antes. Em vez disso, o sistema marca para revisão do gerente (sem tirar da conta automaticamente) quando: cliente criado menos de 2h antes da visita **e** sem nenhum contato registrado antes; visita lançada ou alterada como realizada mais de 3 dias depois da data; data da visita mudada para trás depois de registrada; mesmo telefone em visitas de corretores diferentes na mesma semana; mais de 3 visitas realizadas no mesmo dia com clientes criados no mesmo dia. O gerente/direção pode confirmar ou invalidar, com registro de quem e por quê. Toda criação e alteração de visita fica registrada (data efetiva, criação, mudanças, vínculo e feedback).
- **Fechamento semanal:** roda só depois do fim real do domingo (segunda 00h05, horário de Brasília), apurando segunda 00h a domingo 23h59. A foto da semana não é sobrescrita; one-on-one nunca duplica (1 por corretor por semana).
- **Datas:** a primeira apuração é a **semana atual, 12/10 a 18/10/2026**. Na **segunda 19/10** (após testes e aprovação) o resultado dela decide: 2+ começa apto, 1 em recuperação, 0 em plano de retomada com one-on-one. A partir daí, quem está fora volta **na hora** em que completar a 2ª visita válida da semana (com CRM ≥ 80%). Quem fez 2+ numa semana fica apto por visitas durante a seguinte.
- **Integração de 30 dias para corretor novo** (desde a data oficial de ingresso): fora da Roleta mesmo com várias visitas; usa Oferta Ativa e prospecção; CRM em dia desde o primeiro dia. Ao terminar, só entra com CRM ≥ 80% + meta de visitas na semana atual ou na anterior. Exceção só pela direção, com motivo, prazo e registro.
- Outras exceções (férias, afastamento, aprovação da direção) com motivo, responsável, início e fim.
- **Na entrega de cada lead** a Roleta confere tudo de novo — não só quando o corretor se credencia. Irregular para de receber na hora, sem perder seus clientes e negócios.
- Chave liga/desliga para emergência. Nada é publicado sem teste e aprovação explícita da direção.

**Fase 2 — "Minha evolução — Uhome Performance" na Minha rotina + ligação com a Roleta**

Reformula a parte de cima da Minha rotina (não cria outra página), com tom positivo e motivador. **Mantém o visual atual do CRM** (mesmas cores, letras, cantos arredondados e cartões que já usamos, azul #4969FF), sem tela vermelha. Frase de apoio: "Sua produtividade gera oportunidades." O que já existe (saudação, barra da Roleta, Saúde da carteira, Sua fila de hoje com Tarefas) continua; a Saúde da carteira passa a ser o card 2.

Ordem dos cards (computador em grade, celular um embaixo do outro):

```text
+------------------------------+  +------------------------------+
| MINHA META DE VISITAS        |  | SAÚDE DO MEU CRM             |
| 1 de 2 visitas realizadas    |  | 84% — Meta Uhome 80%: ok!    |
| (o)--------( )        50%    |  | [##########|##]  mín. 80%    |
| "Você está muito perto!      |  | "Sua carteira está dentro do |
|  Falta apenas 1 visita."     |  |  padrão Uhome..."            |
| Semana anterior: 4 ✓ apto    |  | [Atualizar meus clientes]    |
+------------------------------+  +------------------------------+
+---------------------------------------------------------------+
| MINHA ROLETA — ROLETA CONQUISTADA!                            |
| [✓] CRM 84% (mín. 80%)                                        |
| [✓] Produtividade: 4 visitas na semana anterior — apto        |
|     até domingo. Esta semana: 1 de 2 (garante a próxima).     |
| Você está apto a receber novas oportunidades.                 |
+---------------------------------------------------------------+
+---------------------------------------------------------------+
| O QUE POSSO FAZER AGORA?                                      |
| 5 clientes precisam de contato            [Abrir]             |
| 2 visitas para confirmar                  [Ver agenda]        |
| Oferta Ativa disponível                   [Começar]           |
+---------------------------------------------------------------+
```

1. **Minha meta semanal:** "X de 2 visitas realizadas", 2 etapas (acompanham a meta configurada), %, número real mesmo acima da meta. Mensagens: 0/2 "Uma nova semana de oportunidades! Vamos conquistar sua primeira visita?"; 1/2 "Você já está na metade do caminho! Falta apenas 1 visita para conquistar sua meta."; 2/2 "Parabéns! Você conquistou sua meta semanal!"; 3+ "Excelente! Você superou sua meta e está construindo uma semana de alta performance!". Mostra **separado** o resultado da semana anterior ("Semana anterior: 3 visitas — você começou a semana apto"), para nunca mostrar bloqueio errado na segunda com 0/2.
2. **Saúde do meu CRM:** o mesmo % da régua atual, barra com marca nos 80%, "Meta Uhome: 80% — Conquistada!" e quantos clientes precisam de atualização. 80% ou mais: "Parabéns! Sua carteira está dentro do padrão Uhome. Continue valorizando suas oportunidades!". Abaixo de 80%: "Seu CRM está em 76%. Atualize seus clientes para conquistar o padrão Uhome de 80% e recuperar sua elegibilidade." Não mostra nenhuma meta futura (85% ou 90%). Botão "Atualizar meus clientes" → Pipeline com o filtro que já existe.
3. **Minha Roleta**, 5 cenários: **Roleta conquistada!**; **Em evolução — falta 1 visita** (botão Oferta Ativa); **Atualização do CRM necessária** (abaixo de 80%; se forem vários clientes, o texto fala em "atualizar seus clientes"); **Vamos conquistar sua Roleta** (checklist com check verde no que já cumpriu e o que falta no resto); **Sua jornada Uhome começou!** ("Integração: X de 30 dias"). Semana encerrada com 1 visita: selo **Em evolução**; zerada: **Plano de retomada**, com o one-on-one da segunda (construtivo, não público).
4. **O que posso fazer agora?** Só com dados reais que já existem: clientes que precisam de contato, visitas para confirmar, negociações em andamento, Oferta Ativa disponível. Cada linha com botão para a tela certa. Nada inventado, nada duplicado.

- **Reconhecimento discreto** (um aviso pequeno, uma vez por evento): 1ª visita da semana, 2ª visita (meta conquistada), 3ª visita (meta superada), CRM voltou a 80%, Roleta recuperada, consistência semanal. Se o CRM ainda estiver abaixo de 80%, não diz que a Roleta foi liberada — mostra o que falta. Sem prêmios e sem ranking negativo.
- **Atualiza sozinho** depois de registrar visita, registrar contato, virada da semana e exceção da direção. Os números vêm da mesma regra da Roleta.
- Roleta: na hora de entregar cada lead, confere a regra. Bloqueado continua com seus leads, Pipeline, Agenda e Oferta Ativa.
- Antes de construir: **mockup** desta tela no visual do CRM (computador e celular) para sua aprovação.
- **Dependência:** só precisa da Fase 1.

**Fase 3 — Saúde do CRM: reaproveitar a régua atual (sem criar outra)**

Decisão da direção: **não** existe régua nova. O Uhome Performance só lê o % que o CRM já calcula e aplica o mínimo de **80%**.

O que já existe hoje (conferido):
1. **Quem calcula:** a "Saúde da carteira" da Minha rotina, que usa a régua oficial de saúde do lead do sistema.
2. **Critério:** saúde pelo **último contato real** registrado com o cliente (atividade, ligação, WhatsApp etc.) — não depende de ter tarefa marcada. Prazos de "em dia" por etapa: Novo Lead 1 dia, Sem Contato 2, Qualificação 7, Aquecimento 15, Visita 2, Proposta/Contrato 7. Passou do prazo = Atenção; passou do dobro = Desatualizado; Qualificação/Aquecimento parados mais de 21 dias e Sem Contato mais de 15 = Estagnado. Carência de transição já existente é respeitada.
3. **Lead atualizado:** está "Em dia" (verde). Clientes ganhos, descartados, caídos e arquivados não entram.
4. **Indicador reutilizado:** "% em dia" = clientes em dia ÷ clientes ativos (os estagnados ficam fora da conta, como já é hoje).
5. **Ligação com a Roleta:** a regra de credenciamento chama esse mesmo cálculo para o corretor e compara com 80%. Nenhuma fórmula duplicada.
6. **Atualização automática:** o % muda assim que o corretor registra um contato (o sistema já atualiza o "último contato" do cliente). O painel recarrega depois de registrar atividade, concluir tarefa ou visita.

Regras:
- **Mínimo oficial: 80%** (decisão da direção). 80% a 100%: critério atendido. Abaixo de 80%: bloqueado por CRM. Voltou a 80%: libera na hora (se as visitas também estiverem ok). Sem aumento automático para 85% ou 90% — só a direção muda, na Central de regras, com data, responsável, valor anterior, novo valor e justificativa.
- **Não** bloqueia por falta de tarefa, tarefa vencida ou outra pendência fora da régua atual.
- Exemplos: 2 visitas + 84% = atende; 2 visitas + 76% = bloqueado por CRM; 1 visita + 100% = depende das visitas (ou da semana anterior).
- Página Uhome Performance e relatórios: saúde média da empresa, por equipe e por corretor; % de corretores acima de 80%; quem está abaixo; evolução semanal da média; quantos recuperaram o credenciamento.
- Testes do limite: 79,99% abaixo; 80%, 85%, 90% e 100% atendem.
- Página Performance: % de cada corretor e da equipe com a mesma régua (soma de em dia ÷ soma de ativos da equipe), sem esconder bloqueios individuais.

**Fase 4 — One-on-one, Botão Vermelho e gerentes**
- Semana com zero visitas → na segunda cria "One-on-one obrigatório" para gerente e direção, sem repetir.
- Corretor sem venda: aviso aos 30 e 45 dias; aos 60 dias "Botão Vermelho — revisão de parceria" para a direção registrar a decisão. Nada automático contra o corretor.
- Gerentes: meta mensal configurável (padrão R$ 1,5 milhão). 1 mês abaixo → revisão com a diretora; 2 meses seguidos → Botão Vermelho gerencial. Não bloqueia os corretores da equipe.

**Fase 1B (antecipada) — Página "Uhome Performance" só leitura**
- Uma primeira versão só de leitura já nesta semana, para a direção acompanhar a apuração de 12 a 18/10 antes de valer na segunda 19/10.

**Fase 5 — Página Uhome Performance completa, relatório semanal, central de regras e avisos**
- **Página "Uhome Performance" no menu** (substitui/organiza o hub de Performance atual, sem criar um segundo). Filtros: semana atual e anteriores, mês, período, equipe, gerente, corretor, empreendimento.
- **Visão CEO/diretoria:** meta semanal vigente, leads recebidos e trabalhados, visitas agendadas e válidas, % de corretores que bateram a meta, negócios, propostas, vendas, VGV, conversões lead→visita e visita→venda, credenciados / em recuperação / bloqueados por CRM, corretores com 0, 1 e 2+ visitas, one-on-ones pendentes, alertas 30/45/60, gerentes abaixo da meta, comparação com a semana anterior. Histórico guarda a meta que valia em cada semana.
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

- **Barrar a Roleta por engano:** o prazo é curto (CRM 80% hoje à noite, visitas em 19/10). Antes de cada ligação mostro a lista de quem ficaria fora, e só ligo com aprovação.
- **Muitos corretores bloqueados no primeiro dia:** a Fila CEO pode encher. Vamos medir na observação antes de ligar.
- **Data de ingresso:** hoje o CRM não tem um campo "data oficial de ingresso" do corretor, só a data em que o acesso foi criado (que pode ser diferente). Precisamos criar esse campo e a direção/RH preencher para quem entrou nos últimos 30 dias.
- **Carência atual de 14 dias:** não encontrei uma regra de 14 dias funcionando hoje na Roleta. A nova carência de 30 dias será criada do zero, e só passa a barrar depois que as datas de ingresso forem confirmadas e a regra for aprovada.
- **Visitas sem cliente:** nos últimos 60 dias, todas as 240 visitas realizadas estão ligadas a um cliente — o impacto prático é pequeno. A regra protege o futuro.
- **"Cliente cadastrado antes da visita":** vamos comparar a data de cadastro do cliente com a data em que a visita foi registrada. Um cliente cadastrado na mesma hora só para lançar a visita não conta.
- **Feedback:** a visita já pede feedback na tela de visita vencida; a regra passa a conferir isso também no sistema.
- **Regras atuais da Roleta (decidido):** limite de **100 descartes no mês continua**; os **10 leads vermelhos saem** e no lugar entra o **CRM ≥ 80%** (que vale para todos os turnos, não só a noite); a exigência de **4 presenças sai** (inclusive para o domingo). Turno, produto e equipe continuam iguais. Essas trocas entram junto com a Fase 0 (CRM 80%), com aprovação antes de ligar.
- Limite de 2 alterações de banco por dia no horário comercial: as fases mais pesadas ficam fora do expediente.

## 7. Testes (critérios de aceite)

Os 15 cenários do documento original e os 12 novos serão testados com corretores e clientes de teste, apagando tudo no final. Novos incluídos:

1. Visita sem cliente válido não conta.
2. Visita com cliente criado na hora, só para lançar a visita, não conta.
3. Visita com cliente real, realizada e com feedback conta.
4. Visita de prospecção própria conta se o cliente foi cadastrado antes.
5. Cancelada ou no show não conta.
6. Visitas antes de 12/10/2026 não contam; as de 12 a 18/10 decidem quem entra em 19/10.
7. Nenhum bloqueio por visitas antes de 19/10 (só o de CRM 80%, se aprovado para hoje à noite).
8. Corretor com menos de 30 dias não recebe lead da Roleta (depois de aprovada a carência).
9. Corretor novo usa Oferta Ativa e cadastra seus próprios clientes.
10. Corretor novo vê pendências de CRM desde o primeiro dia.
11. Corretor com 30 dias completos sem a meta de visitas continua fora da Roleta.

Testes da meta de 2 visitas: 0 ou 1 visita sem semana anterior = fora; 2 visitas + CRM ≥ 80% = apto; 3 = meta superada; 2 visitas + CRM abaixo de 80% = bloqueado por CRM; bateu na semana anterior = começa apto; em recuperação faz a 2ª = libera na hora; semana zerada = 1 one-on-one só; integração = não recebe; mudar a meta de 2 para 3 não muda semanas fechadas; demais regras da Roleta mantidas.
12. Corretor com carência encerrada, CRM em dia e meta cumprida entra na Roleta.

## 8. Decisões

Já decididas pela direção:
- Meta inicial de **2 visitas** por semana; CRM mínimo **80%** (régua atual, estagnados fora da conta, sem novas obrigações de tarefa).
- Primeira apuração 12 a 18/10; exigência de visitas a partir de 19/10, após testes e aprovação.
- Duas chaves independentes: CRM pode ser ligado sem visitas.
- **Domingo unificado** com os outros dias: meta de visitas + CRM ≥ 80%, mantendo produto, turno e equipe.
- Quem perde a condição **para de receber na hora**, mesmo já credenciado; não perde leads já recebidos.
- Mantém 100 descartes no mês; saem 10 leads vermelhos e 4 presenças.
- Carência de 30 dias com campo oficial de ingresso; Lucas e Gabrielle confirmam as datas antes de bloquear.
- Meta de **R$ 1,5 milhão por gerente, inclusive Junior**; revisões e decisões gerenciais com **Lucas e Gabrielle**.
- Página Uhome Performance **reformula a atual** (sem duplicar).
- Relatórios de segunda 07h30 depois de validar o envio.

Pendente:
1. **Autorização final do CRM 80% para 15/10:** depois de ver os testes e a lista nominal (hoje 15 de 29 abaixo).
2. **Domínio de e-mail** para o relatório (ex.: avisos@uhomesales.com).

## Detalhes técnicos

- Nova função única no banco (ex.: `fn_credenciamento_corretor`) com estados `integracao | credenciado | recuperacao | bloqueado_crm` e lista de motivos. Saúde do CRM = mesmo cálculo de `rpc_carteira_saude` / `lead_saude_status` (extrair o miolo para uma função interna por corretor, chamada pelas duas, sem mudar o resultado atual) comparado com `crm_minimo_pct = 80`. Chamada dentro de `distribuir_lead_atomico` a cada entrega. Configuração: `data_inicio_apuracao = 2026-10-12`, `data_inicio_exigencia_visitas = 2026-10-19`, `crm_gate_ativo` (Fase 0) e `visitas_gate_ativo` separados. Tabelas novas: situação, histórico, exceções, ocorrências (one-on-one/Botão Vermelho), metas de gerente e configuração — todas com permissões por perfil.
- Visita válida: `pipeline_lead_id` não nulo, lead existente e não arquivado/excluído, `status = 'realizada'`, `resultado_visita`/`observacoes` preenchidos, `data_visita >= data_inicio_apuracao`, 1 por `cliente_key` + dia via `v_fato_visita`. Sinais antifraude gravados em tabela de revisão (não removem da contagem sem decisão humana); gatilho de auditoria em `visitas` para criação/alteração.
- Ativação só por `crm_gate_ativo` e `visitas_gate_ativo` (independentes), lidas por uma única função consultada em `credenciar_na_roleta`, `get_elegibilidade_roleta` e `distribuir_lead_atomico`.
- Estados do CRM: `calculado | sem_carteira | dados_insuficientes | erro` — só `calculado` abaixo de 80% bloqueia.
- Rotinas: fechamento semanal segunda 00h05 BRT (após o fim do domingo), checagem diária de dias sem venda.
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
