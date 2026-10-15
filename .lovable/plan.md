# Fase 2 — Nova Minha rotina ("Minha evolução")

Base: o desenho aprovado (versão 2), com as tarefas do dia e o atalho da Oferta Ativa.

## O que o corretor vai ver (de cima para baixo)
1. **Saudação:** igual à de hoje (foto, "Bom dia/Boa tarde/Boa noite, Nome", frase do dia e data). Ganha um selo "Padrão Uhome conquistado" quando o CRM estiver em 80% ou mais.
2. **Roleta do turno:** um bloco único que substitui o aviso atual do CRM. Mostra um destes estados: Pode se credenciar / Já credenciado / Fora do horário / Bloqueado / Plano de retomada. Embaixo aparecem 3 regras com ✓ ou ✗: CRM (mín. 80%), visitas da semana passada (mín. 2) e descartes do mês (máx. 100). O botão "Credenciar agora" usa o credenciamento manual de hoje e nunca inscreve ninguém sozinho.
3. **Minha evolução:** 3 quadros:
   - Saúde do CRM, com barra e "X clientes para atualizar".
   - Visitas desta semana: "1 de 2".
   - Minha situação: Apto / Em evolução / Plano de retomada.
4. **Meu foco de hoje:** visitas de hoje, clientes para atualizar e as próximas 3 tarefas do dia, cada uma com botão "Concluir". Concluir abre a janela atual, que pede tipo de contato e observação. Embaixo: "X vencidas · Ver todas as tarefas".
5. **Gráfico das últimas 4 semanas:** visitas realizadas por semana.
6. **Lateral:** agenda do dia (a mesma de hoje) e atalhos, com Oferta Ativa em destaque, Meus clientes, Tarefas e Agenda.

## O que não muda
- Regras da Roleta, horários, distribuição e Fila CEO.
- Banner do Mutirão e boas-vindas de corretor novo continuam no topo.
- Nada muda no banco de dados: a tela só lê informações que já existem.

## Validação depois de construir
- Ver a tela no preview em computador e celular.
- Conferir que os números batem com a régua usada no credenciamento.
- Concluir uma tarefa de teste pela tela e cancelar, sem mexer em leads reais.
- O teste em conta de corretor fica com você, como combinado.

## Detalhes técnicos
- `CorretorDashboard.tsx` passa a montar: saudação (mantida) → novo `RoletaTurnoCard` → `MinhaEvolucaoKpis` → `MeuFocoHoje` → `EvolucaoSemanasChart`. A lateral fica com `AgendaResumoWidget` e o novo `AtalhosRotina`.
- Dados:
  - CRM e gates vêm de `useRoletaPerformanceStatus` (rpc `roleta_performance_status`).
  - Visitas vêm de rpc `roleta_visitas_realizadas_periodo`, na semana atual, na anterior e nas últimas 4 semanas (BRT, semana de segunda a domingo).
  - Motivo do bloqueio vem de `roleta_motivo_bloqueio`.
  - Tarefas reaproveitam o hook de `/tarefas` e o `RegistrarAtividadeModal`.
- `CrmMetaAviso` e os requisitos antigos do `RoletaStatusBar` saem da Minha rotina e passam a viver dentro do `RoletaTurnoCard`. O credenciamento continua chamando o mesmo fluxo atual.
- Cada componente novo fica abaixo de 300 linhas e usa só as cores do tema.
