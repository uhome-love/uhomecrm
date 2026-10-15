# Fase 1 — Fechamento semanal das visitas válidas

Mockup: /mnt/documents/mockup-fase1-fechamento-semanal.html

## O que faz
Toda segunda às 00h05 (horário de Brasília), o sistema fecha a semana que acabou (segunda a domingo) e grava para cada corretor ativo:
- visitas válidas: cliente pré-existente, visita realizada, com feedback, uma por cliente por dia (a mesma conta que a Roleta já usa);
- saúde do CRM naquele momento;
- situação: 2 ou mais = Apto, 1 = Em evolução, 0 = Plano de retomada.

O fechamento é um registro fixo: não muda depois. Ele serve de histórico para cobrança e para o 1:1.

## Onde aparece
- **Sino do corretor (segunda 00h05):** "Fechamento da semana 12–18/10: 1 visita válida — Em evolução".
- **Sino do gerente:** resumo da equipe dele (quantos aptos, em evolução e em plano de retomada).
- **Painel do gerente:** nova aba "Fechamento semanal" com seletor de semana, a lista dos corretores com visitas, CRM e situação, e a marca "1:1 pendente" para quem ficou em Plano de retomada.
- **Minha Rotina:** a faixa "Situação" mostra a situação gravada no último fechamento.

## O que NÃO muda
- As regras da Roleta e o credenciamento continuam iguais. O fechamento só registra, nunca bloqueia nem libera.
- O primeiro fechamento roda na segunda, 19/10, fechando a semana de 12 a 18/10.

## Validação
- Rodar o fechamento da semana passada uma vez em teste e comparar os números com a contagem que a Roleta usa. Apagar o teste depois.
- Conferir os avisos no sino e a aba do gerente.

## Detalhes técnicos
- Nova tabela `roleta_fechamento_semanal` (semana_inicio, corretor_id auth, visitas_validas, crm_pct, situacao, um_a_um_pendente, created_at), com chave única por semana e corretor. GRANT + RLS: o corretor vê a própria linha; gestor vê a equipe (`team_members`); admin e diretor veem tudo; escrita só por `service_role`.
- Função `roleta_fechar_semana(p_semana_inicio date)`, idempotente (upsert), que reaproveita `roleta_visitas_realizadas_periodo` e `crm_saude_corretor`, cria as notificações via `criar_notificacao` e grava sem nada que possa derrubar a função (EXCEPTION por corretor).
- pg_cron `5 3 * * 1` (00h05 BRT).
- Front: aba nova no painel do gerente e ajuste em `useMinhaEvolucao` para ler a situação gravada.
- Uma migração, fora do horário comercial.
