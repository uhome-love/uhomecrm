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

**Fase 1 — Regra de credenciamento (sem mudar nada na Roleta ainda)**
- Uma única regra no sistema que responde: o corretor está Credenciado, Em recuperação ou Bloqueado por CRM, com **todos** os motivos.
- Meta: 3 visitas realizadas na semana (segunda a domingo, horário de Brasília), contando 1 por cliente por dia, sem no show, cancelada ou reagendada.
- Libera na hora da 3ª visita; quem bateu a meta começa a semana seguinte credenciado.
- Exceções (recém-chegado, férias, afastamento, aprovação da direção) com motivo, responsável, início e fim.
- Chave liga/desliga. Começa **desligada**: o sistema só calcula e mostra, ninguém é barrado.

**Fase 2 — Painel do corretor + ligação com a Roleta**
- Quadro compacto "Minha performance da semana" na Minha rotina: visitas 2/3 com barra, situação da Roleta, pendências do CRM, próxima ação e botões (Oferta Ativa, Atualizar CRM, Minhas visitas, Meu credenciamento).
- Roleta: na hora de entregar cada lead, confere a regra. Se o corretor estiver bloqueado, o lead vai para o próximo da fila (ou Fila CEO). Todas as outras regras atuais continuam.
- Bloqueado continua com seus leads, Pipeline, Agenda e Oferta Ativa.

**Fase 3 — Saúde do CRM**
- Pendências: lead novo sem primeiro atendimento no prazo, lead ativo sem próxima ação, tarefa vencida, visita realizada sem resultado.
- Cada pendência mostra cliente, prazo vencido, o que fazer e link para corrigir. Resolveu tudo → libera na hora.
- Direção escolhe quais pendências bloqueiam e quais são só aviso.

**Fase 4 — One-on-one, Botão Vermelho e gerentes**
- Semana com zero visitas → na segunda cria "One-on-one obrigatório" para gerente e direção, sem repetir.
- Corretor sem venda: aviso aos 30 e 45 dias; aos 60 dias "Botão Vermelho — revisão de parceria" para a direção registrar a decisão. Nada automático contra o corretor.
- Gerentes: meta mensal configurável (padrão R$ 1,5 milhão). 1 mês abaixo → revisão com a diretora; 2 meses seguidos → Botão Vermelho gerencial. Não bloqueia os corretores da equipe.

**Fase 5 — Painel da diretoria, central de regras e avisos**
- Visão da empresa: credenciados, em recuperação, bloqueados, semana zerada, one-on-ones pendentes, alertas 30/45/60, gerentes abaixo da meta, histórico semanal, com filtros.
- Central de regras: a direção muda metas e prazos sem programador, tudo registrado.
- Avisos no sininho (e push) sem repetir o mesmo evento.

**Fase 6 — Preparação para WhatsApp**
- Só deixar os eventos prontos para futuros modelos aprovados na Meta. Nenhum disparo.

## 4. Quem vê o quê

| Perfil | Vê | Pode mudar |
|---|---|---|
| Corretor | Só a própria situação e pendências | Nada nas regras |
| Gerente | Seu time | Registrar diagnóstico do one-on-one |
| Diretoria / CEO | Tudo | Regras, exceções, decisões do Botão Vermelho |

Conteúdo dos one-on-ones: só gerente do corretor e diretoria.

## 5. Histórico e auditoria

Toda mudança de situação grava: quando, motivo, o que causou (visita, pendência resolvida, virada da semana, exceção) e quem aprovou. Toda mudança de regra também fica registrada.

## 6. Riscos

- **Barrar a Roleta por engano:** por isso começa desligado, rodando em "modo observação" por 1 a 2 semanas para conferir os números antes de valer.
- **Muitos corretores bloqueados no primeiro dia:** hoje poucos fazem 3 visitas por semana em todas as equipes; a Fila CEO pode encher. Vamos medir antes de ligar.
- **Visita marcada como realizada sem ter acontecido** para liberar a Roleta: a regra de "validada" precisa ser definida (pergunta abaixo).
- Limite de 2 alterações de banco por dia no horário comercial: as fases mais pesadas ficam fora do expediente.

## 7. Testes (critérios de aceite)

Os 15 cenários do documento serão testados com corretores e clientes de teste, apagando tudo no final. Exemplos: 2 visitas não libera; a 3ª libera na hora; 3 visitas com CRM pendente continua bloqueado; resolver a pendência libera; bloqueado continua usando Oferta Ativa; semana zerada gera 1 one-on-one só; Roleta continua respeitando produto, turno e equipe.

## 8. Decisões que a direção precisa tomar

1. **Visita "validada":** basta o corretor registrar como realizada com feedback, ou precisa confirmação do gerente / do cliente?
2. **Regras atuais da Roleta** (descartes, leads vermelhos, presença, domingo): continuam junto com as novas, ou as novas substituem?
3. **Início:** quando ligar de verdade? Proposta: observação por 2 semanas, depois liga.
4. **Corretor bloqueado credenciado no turno:** sai da fila na hora, ou termina o turno?
5. **Recém-chegados:** quantos dias de carência?
6. **Prazos do CRM:** quanto tempo para o primeiro atendimento e para registrar a visita?
7. **Meta do gerente Junior** (equipe menor): também R$ 1,5 milhão?
8. **Diretoria responsável** pelas revisões gerenciais: Gabrielle continua nessa função?

## Detalhes técnicos

- Nova função única no banco (ex.: `fn_credenciamento_corretor`) com tabela de situação atual por corretor, recalculada por gatilho em `visitas`, `pipeline_tarefas` e `pipeline_leads`, e por rotina na virada da semana. Tabelas novas: situação, histórico, exceções, pendências, ocorrências (one-on-one/Botão Vermelho), metas de gerente e configuração — todas com permissões e regras de acesso por perfil.
- Roleta: só um filtro extra dentro de `distribuir_lead_atomico` (que hoje não chama nenhuma checagem), respeitando a chave liga/desliga. `credenciar_na_roleta` e `get_elegibilidade_roleta` passam a ler a mesma fonte.
- Reaproveitar `one_on_one_reports`, `notifications`/`criar_notificacao`, push existente, `v_fato_visita` (1 por cliente/dia) e a regra de VGV com `fn_equipe_na_data`.
- Rotinas: virada de domingo 23:59 BRT, auditoria diária do CRM e checagem diária de dias sem venda.
